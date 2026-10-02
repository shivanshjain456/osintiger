// Agent Executor — executes planned actions by calling the existing source modules.
// Each action specifies a source key + target. The executor:
// 1. Checks if the action was already visited (dedup).
// 2. Calls the appropriate source function via the pipeline's runSource.
// 3. Returns the SourceResult + newly discovered entities.
//
// Design:
// - Reuses the existing runSource switch from the pipeline (DRY).
// - Adds per-action timeout (prevents slow sources from blocking the agent).
// - Handles errors gracefully (returns error result, doesn't throw).
// - Parallel execution: multiple actions in one iteration run concurrently.

import type { DetectionResult, SourceResult } from "../types";
import type { AgentAction, ActionResult, DiscoveredEntity, AgentEvidence } from "./types";
import { visitedKey, entityId } from "./types";
import { extractEntities } from "./entity-extractor";
import { runSource } from "../source-runner";
import { SOURCE_LABELS } from "../router";

/** Execute a single action. Returns the result + newly discovered entities. */
export async function executeAction(
  action: AgentAction,
  visited: Set<string>,
  existingEntityIds: Set<string>,
  iteration: number
): Promise<ActionResult> {
  const start = Date.now();
  const key = visitedKey(action.source, action.target);

  // Check if already visited
  if (visited.has(key)) {
    return {
      action,
      sourceResult: {
        source: action.source,
        source_label: SOURCE_LABELS[action.source as keyof typeof SOURCE_LABELS] || action.source,
        target: action.target,
        status: "skipped",
        error: "Already visited",
        findings: [],
      },
      newEntities: [],
      skipped: true,
      skipReason: "Already visited",
      durationMs: Date.now() - start,
    };
  }

  // Mark as visited
  visited.add(key);

  // Build a minimal DetectionResult for the source function
  const detection: DetectionResult = {
    inputType: action.targetType,
    script: "latin",
    languageGuess: "en",
    regionHints: [],
    sanitized: action.target,
    valid: true,
  };

  try {
    // Call the source function via the pipeline's runSource switch
    const sourceResult = await withTimeout(
      runSource(action.source as never, detection),
      14000,
      `${action.source}:${action.target}`
    );

    // Extract new entities from the findings
    const sourceLabel = SOURCE_LABELS[action.source as keyof typeof SOURCE_LABELS] || action.source;
    const newEntities = extractEntities(
      sourceResult.findings,
      action.source,
      sourceLabel,
      0, // depth will be set by the caller
      existingEntityIds
    );

    return {
      action,
      sourceResult,
      newEntities,
      skipped: false,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Execution failed";
    return {
      action,
      sourceResult: {
        source: action.source,
        source_label: SOURCE_LABELS[action.source as keyof typeof SOURCE_LABELS] || action.source,
        target: action.target,
        status: "error",
        error: errorMsg,
        findings: [],
      },
      newEntities: [],
      skipped: false,
      durationMs: Date.now() - start,
    };
  }
}

/** Execute multiple actions in parallel. Returns results in the same order. */
export async function executeActionsParallel(
  actions: AgentAction[],
  visited: Set<string>,
  existingEntityIds: Set<string>,
  iteration: number
): Promise<ActionResult[]> {
  const results = await Promise.allSettled(
    actions.map((action) => executeAction(action, visited, existingEntityIds, iteration))
  );
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      action: actions[i],
      sourceResult: {
        source: actions[i].source,
        source_label: SOURCE_LABELS[actions[i].source as keyof typeof SOURCE_LABELS] || actions[i].source,
        target: actions[i].target,
        status: "timeout" as const,
        error: r.reason?.message || "Action timed out",
        findings: [],
      },
      newEntities: [],
      skipped: false,
      durationMs: 0,
    };
  });
}

/** Convert a SourceResult + action into AgentEvidence. */
export function toEvidence(
  action: AgentAction,
  sourceResult: SourceResult,
  iteration: number,
  durationMs?: number
): AgentEvidence {
  const sourceLabel = SOURCE_LABELS[action.source as keyof typeof SOURCE_LABELS] || action.source;
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source: action.source,
    sourceLabel,
    target: action.target,
    findings: sourceResult.findings,
    status: sourceResult.status as AgentEvidence["status"],
    error: sourceResult.error,
    iteration,
    collectedAt: new Date().toISOString(),
    latencyMs: durationMs,
  };
}

/** Assign correct depth to discovered entities based on the action's target depth. */
export function assignDepths(
  entities: DiscoveredEntity[],
  targetDepth: number,
  targetValue: string
): DiscoveredEntity[] {
  return entities.map((e) => ({
    ...e,
    depth: targetDepth + 1,
    // If the entity is the same as the target, keep it at the target's depth
    ...(e.value.toLowerCase() === targetValue.toLowerCase() ? { depth: targetDepth } : {}),
  }));
}

// =====================
// Timeout utility
// =====================

async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
