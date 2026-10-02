// Agent Planner — the "brain" of the autonomous investigation agent.
// Uses the LLM to decide the next actions based on the current state.
//
// Design:
// - The planner receives a summary of the current state (discovered entities, evidence,
//   frontier, trace) and outputs a JSON array of next actions.
// - Each action has: source key, target, reason, target type.
// - The planner is aware of what sources are available and what entity types they support.
// - If the planner returns empty actions, the agent stops (investigation complete).
// - Strict JSON output enforcement with fallback parsing.
// - Retries on failure (up to 3 attempts with exponential backoff).

import ZAI from "z-ai-web-dev-sdk";
import type { AgentState, AgentAction, DiscoveredEntity, FrontierItem, AgentTraceEntry } from "./types";
import type { SourceKey } from "../router";
import { SOURCE_LABELS } from "../router";

// =====================
// ZAI client (singleton)
// =====================

let zaiPromise: Promise<unknown> | null = null;
async function getZai() {
  if (!zaiPromise) zaiPromise = ZAI.create();
  return zaiPromise as Promise<{
    chat: {
      completions: {
        create: (args: {
          messages: { role: string; content: string }[];
          thinking: { type: string };
        }) => Promise<{ choices: { message: { content: string } }[] }>;
      };
    };
  }>;
}

const PLANNER_AI_TIMEOUT_MS = 45_000;
async function withPlannerTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Planner AI call timed out after 45s")), PLANNER_AI_TIMEOUT_MS);
    }),
  ]);
}

// =====================
// Planner prompt
// =====================

const PLANNER_SYSTEM_PROMPT = `You are the planning module of an autonomous OSINT investigation agent. Your job is to decide the next actions to take based on the current investigation state.

You will receive:
1. The investigation objective
2. The original target and its type
3. All discovered entities so far (with types and depths)
4. A summary of collected evidence
5. The current frontier (entities awaiting investigation)
6. The trace of previous actions taken

AVAILABLE SOURCES:
{{SOURCE_LIST}}

TASK:
Based on the current state, determine the next 1-3 highest-value actions. Each action specifies a source to query and a target to query it with.

PRIORITIZATION RULES:
1. If the original target hasn't been fully investigated yet, prioritize sources for it.
2. If new entities were discovered (e.g., IPs from DNS, subdomains from crt.sh), investigate those.
3. Prioritize entities with higher confidence and relevance to the objective.
4. Avoid redundant work — don't re-query sources for targets that have already been queried.
5. Consider the investigation objective: for "infrastructure" focus on DNS/IP/SSL; for "corporate" focus on company registries; for "person" focus on social/news.
6. Respect max depth — don't investigate entities beyond the configured depth limit.

OUTPUT FORMAT:
Respond with ONLY a valid JSON object (no markdown fences, no prose):
{
  "actions": [
    {
      "source": "<source_key from the AVAILABLE SOURCES list>",
      "target": "<entity_value to investigate>",
      "reason": "<1-2 sentence explanation of why this action is valuable now>",
      "targetType": "<person|organization|domain|ip|wallet|cve|email|username|phone|url|hash>"
    }
  ],
  "strategy_note": "<1-2 sentence summary of current strategy and what the agent is trying to achieve>"
}

If you determine that sufficient evidence has been collected and no more valuable actions can be taken, respond with:
{
  "actions": [],
  "strategy_note": "<explanation of why the investigation is complete>"
}

RULES:
- Only use source keys from the AVAILABLE SOURCES list.
- The target must be an entity that has been discovered (in the discovered entities list or the original target).
- Produce between 0 and 3 actions (never more than 3).
- Every action must have a clear, specific reason.`;

// =====================
// Planner types
// =====================

export interface PlannerOutput {
  actions: AgentAction[];
  strategyNote: string;
}

// =====================
// Main planner function
// =====================

/**
 * Plan the next actions for the agent.
 * @param state The current agent state.
 * @returns The planned actions + strategy note. Empty actions = investigation complete.
 */
export async function planNextActions(state: AgentState): Promise<PlannerOutput> {
  const zai = await getZai();

  // Build the user prompt with current state
  const userPrompt = buildUserPrompt(state);

  // Build the system prompt with available sources
  const systemPrompt = buildSystemPrompt();

  let lastErr: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await withPlannerTimeout(zai.chat.completions.create({
        messages: [
          { role: "assistant", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        thinking: { type: "disabled" },
      }));
      const text = completion.choices?.[0]?.message?.content || "";
      if (!text) {
        lastErr = "Empty planner response";
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }

      const parsed = stripJsonFences(text);
      try {
        const obj = JSON.parse(parsed) as Record<string, unknown>;
        const rawActions = Array.isArray(obj.actions) ? obj.actions : [];
        // Validate and filter actions
        const validActions = rawActions
          .filter((a) => isValidAction(a))
          .slice(0, state.config.maxActionsPerIteration) as AgentAction[];
        const strategyNote = (typeof obj.strategy_note === "string" ? obj.strategy_note : null) ||
                             (typeof obj.strategyNote === "string" ? obj.strategyNote : null) ||
                             "No strategy note provided.";
        return {
          actions: validActions,
          strategyNote,
        };
      } catch {
        lastErr = "Planner response was not valid JSON";
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "Planner call failed";
      const isRateLimit = lastErr.includes("429") || lastErr.includes("Too many requests");
      const waitMs = isRateLimit ? 10000 : attempt * 2000;
      console.warn(`[agent-planner] attempt ${attempt} failed: ${lastErr}. Retrying in ${waitMs}ms...`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
  }

  // All retries failed — return empty actions with error note
  return {
    actions: [],
    strategyNote: `Planning failed after 3 attempts: ${lastErr}. Stopping investigation.`,
  };
}

// =====================
// Prompt builders
// =====================

function buildSystemPrompt(): string {
  // Build the source list with labels and descriptions
  const sourceEntries = Object.entries(SOURCE_LABELS);
  const sourceList = sourceEntries
    .map(([key, label]) => `  - ${key}: ${label}`)
    .join("\n");
  return PLANNER_SYSTEM_PROMPT.replace("{{SOURCE_LIST}}", sourceList);
}

function buildUserPrompt(state: AgentState): string {
  const lines: string[] = [];
  lines.push(`INVESTIGATION OBJECTIVE: ${state.objective}`);
  lines.push(`ORIGINAL TARGET: ${state.target} (type: ${state.inputType})`);
  lines.push(`ITERATION: ${state.iteration + 1} (max: ${state.config.maxIterations})`);
  lines.push(`MAX DEPTH: ${state.config.maxDepth}`);
  lines.push(`RECURSIVE EXPANSION: ${state.config.enableRecursiveExpansion ? "enabled" : "disabled"}`);
  lines.push("");

  // Discovered entities
  lines.push("DISCOVERED ENTITIES:");
  if (state.discoveredEntities.length === 0) {
    lines.push("  (none yet — this is the first iteration)");
  } else {
    const byType = groupByType(state.discoveredEntities);
    for (const [type, entities] of Object.entries(byType)) {
      lines.push(`  ${type} (${entities.length}):`);
      for (const e of entities.slice(0, 10)) {
        lines.push(`    - ${e.value} (depth: ${e.depth}, confidence: ${(e.confidence * 100).toFixed(0)}%, found by: ${e.discoveredByLabel})`);
      }
      if (entities.length > 10) {
        lines.push(`    ... and ${entities.length - 10} more`);
      }
    }
  }
  lines.push("");

  // Evidence summary
  lines.push("EVIDENCE COLLECTED:");
  if (state.evidence.length === 0) {
    lines.push("  (none yet)");
  } else {
    const bySource = new Map<string, number>();
    for (const ev of state.evidence) {
      bySource.set(ev.sourceLabel, (bySource.get(ev.sourceLabel) || 0) + ev.findings.length);
    }
    for (const [source, count] of bySource) {
      lines.push(`  - ${source}: ${count} findings`);
    }
    lines.push(`  TOTAL: ${state.evidence.length} evidence items, ${state.evidence.reduce((s, e) => s + e.findings.length, 0)} findings`);
  }
  lines.push("");

  // Frontier
  lines.push("FRONTIER (entities awaiting investigation):");
  if (state.frontier.length === 0) {
    lines.push("  (empty — all discovered entities have been investigated)");
  } else {
    for (const f of state.frontier.slice(0, 15)) {
      lines.push(`  - ${f.entityValue} (type: ${f.entityType}, depth: ${f.depth}, priority: ${f.priority}) — ${f.reason}`);
    }
    if (state.frontier.length > 15) {
      lines.push(`  ... and ${state.frontier.length - 15} more`);
    }
  }
  lines.push("");

  // Visited (to avoid redundant work)
  lines.push(`VISITED ACTIONS: ${state.visited.length} (already queried source:target pairs)`);
  if (state.visited.length > 0) {
    lines.push(`  Recent: ${state.visited.slice(-5).join(", ")}`);
  }
  lines.push("");

  // Recent trace (last 5 actions)
  lines.push("RECENT ACTIONS (last 5):");
  const recentTrace = state.trace.filter((t) => t.phase === "executing").slice(-5);
  if (recentTrace.length === 0) {
    lines.push("  (none yet)");
  } else {
    for (const t of recentTrace) {
      if (t.action && t.result) {
        lines.push(`  - [${t.action.source}] ${t.action.target} → ${t.result.status} (${t.result.findingCount} findings, ${t.result.newEntitiesFound} new entities)`);
      }
    }
  }
  lines.push("");

  lines.push("Based on the above state, determine the next actions to take. Respond with the JSON object as specified.");

  return lines.join("\n");
}

// =====================
// Validation
// =====================

function isValidAction(action: unknown): action is AgentAction {
  if (typeof action !== "object" || action === null) return false;
  const a = action as Record<string, unknown>;
  if (typeof a.source !== "string" || typeof a.target !== "string" || typeof a.reason !== "string") {
    return false;
  }
  // Check that the source key exists in SOURCE_LABELS
  if (!(a.source in SOURCE_LABELS)) return false;
  // targetType must be a valid InputType
  const validTypes = ["person", "organization", "domain", "ip", "wallet", "cve", "email", "username", "phone", "url", "hash"];
  if (typeof a.targetType !== "string" || !validTypes.includes(a.targetType)) {
    // Default to "domain" if not specified or invalid
    (a as Record<string, unknown>).targetType = "domain";
  }
  // Target must not be empty
  if (!a.target.trim()) return false;
  return true;
}

// =====================
// Utilities
// =====================

function stripJsonFences(s: string): string {
  let t = s.trim();
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return t;
}

function groupByType(entities: DiscoveredEntity[]): Record<string, DiscoveredEntity[]> {
  const groups: Record<string, DiscoveredEntity[]> = {};
  for (const e of entities) {
    if (!groups[e.type]) groups[e.type] = [];
    groups[e.type].push(e);
  }
  return groups;
}
