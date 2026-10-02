// AI Investigation Planner — uses the LLM to generate a structured investigation plan
// from a natural language objective.
//
// The planner:
//   1. Receives an objective (e.g., "Investigate this startup for investment due diligence")
//   2. Knows the target + type + available sources
//   3. Generates a JSON plan with ordered steps, each with specific sources + reasoning
//   4. Returns the plan for execution
//
// Design:
// - No hardcoded investigation sequences — the AI decides the optimal strategy
// - The plan is generated UPFRONT (before execution begins)
// - Each step has: name, reasoning, target, sources, expected outcomes, parallelizable flag
// - 3 retries with exponential backoff on failure

import ZAI from "z-ai-web-dev-sdk";
import type { InputType } from "../types";
import type { SourceKey } from "../router";
import { SOURCE_LABELS } from "../router";
import type { InvestigationPlan, PlanStep, PlanConfig } from "./plan-types";

// =====================
// ZAI client (singleton, shared with other modules)
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

const PLAN_AI_TIMEOUT_MS = 45_000;
async function withPlanTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Plan AI call timed out after 45s")), PLAN_AI_TIMEOUT_MS);
    }),
  ]);
}

// =====================
// Planner Prompt
// =====================

const PLANNER_SYSTEM_PROMPT = `You are the investigation planner module of an OSINT intelligence platform. Your job is to generate a structured investigation plan from a natural language objective.

You will receive:
1. The investigation objective (natural language, e.g., "Investigate this startup for investment due diligence")
2. The target being investigated
3. The target's detected type (domain, ip, email, person, organization, etc.)
4. The list of all available sources with their labels

TASK:
Generate a structured investigation plan with 3-8 steps. Each step specifies:
- A name (what the step does)
- Reasoning (why this step is valuable for the objective)
- The target to investigate (usually the original target, but could be derived)
- The target type
- Which sources to query (from the AVAILABLE SOURCES list)
- Expected outcomes (what the AI expects to discover)
- Whether the step can run in parallel with the next step

PLAN DESIGN PRINCIPLES:
1. Start with broad reconnaissance (DNS, WHOIS, certificates) before deep-dive analysis
2. Prioritize sources based on the objective: "due diligence" → corporate/financial sources; "infrastructure" → DNS/SSL/IP; "person" → social/news/academic
3. Include threat intelligence steps for any target type
4. Include news/media steps for persons and organizations
5. Consider cross-referencing: if step 1 discovers IPs, step 2 might investigate those IPs
6. Balance thoroughness with efficiency — don't exceed the max steps limit
7. Each step should have a clear purpose tied to the objective

OUTPUT FORMAT:
Respond with ONLY a valid JSON object (no markdown fences, no prose):
{
  "strategy_summary": "2-3 sentence summary of the overall investigation strategy",
  "categories": ["infrastructure", "corporate", "threat_intel", "news", ...],
  "estimated_time_seconds": 60,
  "steps": [
    {
      "name": "Step name (e.g., 'Certificate Transparency Lookup')",
      "reasoning": "Why this step is valuable for the objective",
      "target": "<target value>",
      "targetType": "<person|organization|domain|ip|wallet|cve|email|username|phone|url|hash>",
      "sources": ["source_key1", "source_key2", ...],
      "expectedOutcomes": ["What we expect to discover", ...],
      "parallelizable": true
    }
  ]
}

RULES:
- Only use source keys from the AVAILABLE SOURCES list
- Produce between 3 and 8 steps (never more than the maxSteps limit)
- Each step should have 1-5 sources (never more than maxSourcesPerStep)
- The first step should always target the original target
- Later steps may target discovered entities (use the original target as placeholder if unknown)
- Every step must have a clear reasoning tied to the objective`;

// =====================
// Main planner function
// =====================

/**
 * Generate an investigation plan from an objective.
 * @param objective The natural language investigation objective.
 * @param target The target being investigated.
 * @param inputType The detected type of the target.
 * @param config The plan configuration (maxSteps, maxSourcesPerStep).
 * @returns The generated investigation plan, or null if planning failed.
 */
export async function generatePlan(
  objective: string,
  target: string,
  inputType: Exclude<InputType, "auto">,
  config: PlanConfig
): Promise<{ plan: InvestigationPlan | null; notes: string; error?: string }> {
  const zai = await getZai();
  const userPrompt = buildUserPrompt(objective, target, inputType, config);
  const systemPrompt = buildSystemPrompt();

  let lastErr: string | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const completion = await withPlanTimeout(zai.chat.completions.create({
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
        const plan = validateAndBuildPlan(obj, objective, target, inputType, config);
        if (plan) {
          return { plan, notes: `Plan generated successfully on attempt ${attempt}: ${plan.steps.length} steps, ${plan.categories.length} categories` };
        }
        lastErr = "Plan validation failed";
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      } catch {
        lastErr = "Planner response was not valid JSON";
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "Planner call failed";
      const isRateLimit = lastErr.includes("429") || lastErr.includes("Too many requests");
      const waitMs = isRateLimit ? 10000 : attempt * 2000;
      console.warn(`[plan-planner] attempt ${attempt} failed: ${lastErr}. Retrying in ${waitMs}ms...`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
  }

  return { plan: null, notes: `Planning failed after 3 attempts: ${lastErr}`, error: lastErr };
}

// =====================
// Prompt builders
// =====================

function buildSystemPrompt(): string {
  const sourceEntries = Object.entries(SOURCE_LABELS);
  const sourceList = sourceEntries
    .map(([key, label]) => `  - ${key}: ${label}`)
    .join("\n");
  return PLANNER_SYSTEM_PROMPT.replace("{{SOURCE_LIST}}", sourceList);
}

function buildUserPrompt(
  objective: string,
  target: string,
  inputType: Exclude<InputType, "auto">,
  config: PlanConfig
): string {
  return `INVESTIGATION OBJECTIVE: ${objective}

TARGET: ${target}
TARGET TYPE: ${inputType}

CONFIGURATION:
- Max steps: ${config.maxSteps}
- Max sources per step: ${config.maxSourcesPerStep}
- Parallel execution allowed: ${config.allowParallelExecution}

Generate the investigation plan now. Respond with the JSON object as specified.`;
}

// =====================
// Validation
// =====================

function validateAndBuildPlan(
  obj: Record<string, unknown>,
  objective: string,
  target: string,
  inputType: Exclude<InputType, "auto">,
  config: PlanConfig
): InvestigationPlan | null {
  const strategySummary = typeof obj.strategy_summary === "string" ? obj.strategy_summary : "No strategy summary provided.";
  const categories = Array.isArray(obj.categories) ? obj.categories.filter((c) => typeof c === "string") : [];
  const estimatedTimeSeconds = typeof obj.estimated_time_seconds === "number" ? obj.estimated_time_seconds : 60;
  const rawSteps = Array.isArray(obj.steps) ? obj.steps : [];

  const validTypes = ["person", "organization", "domain", "ip", "wallet", "cve", "email", "username", "phone", "url", "hash"];
  const steps: PlanStep[] = [];

  for (let i = 0; i < rawSteps.length && steps.length < config.maxSteps; i++) {
    const raw = rawSteps[i] as Record<string, unknown>;
    if (typeof raw !== "object" || raw === null) continue;

    const name = typeof raw.name === "string" ? raw.name : `Step ${i + 1}`;
    const reasoning = typeof raw.reasoning === "string" ? raw.reasoning : "No reasoning provided.";
    const stepTarget = typeof raw.target === "string" && raw.target.trim() ? raw.target : target;
    const targetType = validTypes.includes(raw.targetType as string)
      ? (raw.targetType as Exclude<InputType, "auto">)
      : inputType;

    // Filter sources to only valid keys
    const rawSources = Array.isArray(raw.sources) ? raw.sources : [];
    const sources = rawSources
      .filter((s) => typeof s === "string" && s in SOURCE_LABELS)
      .slice(0, config.maxSourcesPerStep) as SourceKey[];

    if (sources.length === 0) continue; // Skip steps with no valid sources

    const expectedOutcomes = Array.isArray(raw.expectedOutcomes)
      ? raw.expectedOutcomes.filter((o) => typeof o === "string")
      : [];
    const parallelizable = typeof raw.parallelizable === "boolean" ? raw.parallelizable : true;

    steps.push({
      stepNumber: steps.length + 1,
      name,
      reasoning,
      target: stepTarget,
      targetType,
      sources,
      expectedOutcomes,
      parallelizable,
      status: "pending",
      findingCount: 0,
      durationMs: 0,
    });
  }

  if (steps.length === 0) return null;

  return {
    objective,
    target,
    inputType,
    strategySummary,
    steps,
    categories: categories.length > 0 ? categories : ["general"],
    estimatedTimeSeconds,
  };
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
