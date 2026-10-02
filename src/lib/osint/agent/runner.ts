// Agent Runner — the main autonomous investigation loop.
//
// The loop:
//   1. PLAN: Ask the AI planner what actions to take next.
//   2. EXECUTE: Run all planned actions in parallel.
//   3. EXTRACT: Parse findings for new entities, add to discovered set + frontier.
//   4. CHECK: Should we stop? (max iterations, max entities, max time, no new entities, empty plan)
//   5. If not stopping: go to 1.
//   6. If stopping: synthesize final report from all collected evidence.
//
// Design:
// - Fire-and-forget: runs in background, state is persisted after each phase.
// - Resumable: if interrupted, the state in DB reflects the last completed iteration.
// - Observable: every decision and action is logged to the trace.
// - Defensive: all errors are caught and logged; the agent continues with other actions.
// - Configurable: stopping conditions are read from AgentConfig.

import { randomUUID } from "crypto";
import type { DetectionResult, SourceResult, ReportData, NormalizedFinding, SourceConsulted, Geopoint, KeyFinding } from "../types";
import type { AgentState, AgentConfig, AgentAction, DiscoveredEntity, FrontierItem, AgentEvidence, AgentTraceEntry } from "./types";
import { DEFAULT_AGENT_CONFIG, entityId, visitedKey } from "./types";
import { detectInput } from "../detector";
import { routeSources, SOURCE_LABELS } from "../router";
import { planNextActions } from "./planner";
import { executeActionsParallel, toEvidence, assignDepths } from "./executor";
import { extractEntities } from "./entity-extractor";
import { createAgentRecord, updateAgentState, getAgentState } from "./store";
import { synthesizeReport, synthesizeACH } from "../ai-client";
import { buildAch } from "../ach";
import { markAttribution } from "../attribution";
import { normalizeSourceResults } from "../normalizer";

// =====================
// Initialization
// =====================

export interface AgentInitOptions {
  target: string;
  objective?: string;
  input_type?: string;
  config?: Partial<AgentConfig>;
}

export function initAgentInvestigation(opts: AgentInitOptions): {
  id: string;
  state: AgentState;
  detection: DetectionResult;
} {
  const id = randomUUID();
  const detection = detectInput(opts.target, (opts.input_type as never) || "auto");
  const now = new Date().toISOString();

  const config: AgentConfig = { ...DEFAULT_AGENT_CONFIG, ...opts.config };
  const objective = opts.objective || `Comprehensive autonomous OSINT investigation of ${detection.sanitized}`;

  // The original target is the first discovered entity (depth 0)
  const targetEntity: DiscoveredEntity = {
    id: entityId(detection.sanitized, detection.inputType),
    value: detection.sanitized,
    type: detection.inputType,
    depth: 0,
    discoveredBy: "agent",
    discoveredByLabel: "User input",
    discoveredAt: now,
    confidence: 1.0,
    context: `Original investigation target: ${detection.sanitized}`,
  };

  const state: AgentState = {
    objective,
    target: detection.sanitized,
    inputType: detection.inputType,
    config,
    status: "queued",
    iteration: 0,
    discoveredEntities: [targetEntity],
    evidence: [],
    frontier: [],
    visited: [],
    trace: [],
    startedAt: now,
    currentPhase: "idle",
  };

  createAgentRecord(id, state);
  return { id, state, detection };
}

// =====================
// Main runner loop
// =====================

export async function runAgent(id: string, detection: DetectionResult): Promise<void> {
  let state = await getAgentState(id);
  if (!state) {
    console.error(`[agent-runner] State not found for ${id}`);
    return;
  }

  const startTime = Date.now();
  state = updateAgentState(id, { status: "running", currentPhase: "planning" }) || state;

  try {
    // =====================
    // Iteration 1: Use the routing matrix for the initial target
    // (The planner might not know all available sources on the first iteration,
    // so we seed it with the routing matrix's recommendations.)
    // =====================
    const initialSources = routeSources(detection);
    const initialActions: AgentAction[] = initialSources.slice(0, state.config.maxActionsPerIteration).map((source) => ({
      source,
      target: detection.sanitized,
      reason: `Initial routing: ${SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || source} is recommended for ${detection.inputType} targets`,
      targetType: detection.inputType,
    }));

    // Add planning trace entry for the initial seed
    state = addTraceEntry(id, state, {
      iteration: 1,
      phase: "planning",
      timestamp: new Date().toISOString(),
      actions: initialActions,
      strategyNote: `Seeded with ${initialActions.length} actions from routing matrix for ${detection.inputType} target`,
    });

    state = updateAgentState(id, { currentStrategy: `Seeded with ${initialActions.length} actions from routing matrix`, currentPhase: "executing" }) || state;

    // Execute initial actions
    await executeIteration(id, state, initialActions, 1, startTime);

    // Refresh state from store
    state = (await getAgentState(id)) || state;

    // =====================
    // Subsequent iterations: use the AI planner
    // =====================
    while (state.iteration < state.config.maxIterations) {
      // Check time limit
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > state.config.maxTimeSeconds) {
        state = stopAgent(id, state, `Time limit reached (${elapsed.toFixed(0)}s)`, startTime);
        break;
      }

      // Check entity limit
      if (state.discoveredEntities.length >= state.config.maxEntities) {
        state = stopAgent(id, state, `Entity limit reached (${state.discoveredEntities.length} entities)`, startTime);
        break;
      }

      // Plan next actions
      state = updateAgentState(id, { currentPhase: "planning" }) || state;
      const planResult = await planNextActions(state);

      // Add planning trace
      state = addTraceEntry(id, state, {
        iteration: state.iteration + 1,
        phase: "planning",
        timestamp: new Date().toISOString(),
        actions: planResult.actions,
        strategyNote: planResult.strategyNote,
      });

      // Check if planner returned no actions → investigation complete
      if (planResult.actions.length === 0) {
        state = stopAgent(id, state, planResult.strategyNote || "Planner returned no more actions", startTime);
        break;
      }

      // Execute the planned actions
      state = updateAgentState(id, { currentStrategy: planResult.strategyNote, currentPhase: "executing" }) || state;
      await executeIteration(id, state, planResult.actions, state.iteration + 1, startTime);

      // Refresh state
      state = (await getAgentState(id)) || state;

      // Check if no new entities were discovered in this iteration
      // (If the planner keeps issuing actions but nothing new is found, we should stop)
      const lastExtractTrace = state.trace.filter((t) => t.phase === "extracting").slice(-1)[0];
      if (lastExtractTrace && lastExtractTrace.entitiesDiscovered && lastExtractTrace.entitiesDiscovered.length === 0) {
        // No new entities — check if we've also exhausted the frontier
        if (state.frontier.length === 0) {
          state = stopAgent(id, state, "No new entities discovered and frontier is empty", startTime);
          break;
        }
      }
    }

    // Check if we hit max iterations
    if (state.status === "running" && state.iteration >= state.config.maxIterations) {
      state = stopAgent(id, state, `Max iterations reached (${state.config.maxIterations})`, startTime);
    }

    // =====================
    // Synthesize final report
    // =====================
    if (state.config.enableReportSynthesis && state.status === "stopped") {
      state = updateAgentState(id, { currentPhase: "synthesizing", status: "running" }) || state;
      await synthesizeAgentReport(id, state, detection);
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Agent runner failed";
    console.error(`[agent-runner] error for ${id}:`, errorMsg);
    updateAgentState(id, {
      status: "failed",
      error: errorMsg,
      completedAt: new Date().toISOString(),
      currentPhase: "idle",
    });
  }
}

// =====================
// Iteration execution
// =====================

async function executeIteration(
  id: string,
  state: AgentState,
  actions: AgentAction[],
  iteration: number,
  startTime: number
): Promise<void> {
  // Build the visited set and existing entity IDs
  const visitedSet = new Set(state.visited);
  const existingEntityIds = new Set(state.discoveredEntities.map((e) => e.id));

  // Execute all actions in parallel
  const results = await executeActionsParallel(actions, visitedSet, existingEntityIds, iteration);

  // Process results
  const newEvidence: AgentEvidence[] = [];
  const newEntities: DiscoveredEntity[] = [];
  const newTraceEntries: AgentTraceEntry[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const action = actions[i];

    // Add executing trace entry
    newTraceEntries.push({
      iteration,
      phase: "executing",
      timestamp: new Date().toISOString(),
      action,
      result: {
        status: result.sourceResult.status as "success" | "error" | "skipped" | "timeout",
        findingCount: result.sourceResult.findings.length,
        newEntitiesFound: result.newEntities.length,
        summary: result.skipped
          ? `Skipped: ${result.skipReason}`
          : result.sourceResult.status === "success"
          ? `${result.sourceResult.findings.length} findings collected`
          : `Error: ${result.sourceResult.error || "unknown"}`,
        latencyMs: result.durationMs,
      },
    });

    // Add evidence (skip if skipped)
    if (!result.skipped) {
      newEvidence.push(toEvidence(action, result.sourceResult, iteration, result.durationMs));
    }

    // Assign correct depths to discovered entities
    const targetEntity = state.discoveredEntities.find((e) => e.value.toLowerCase() === action.target.toLowerCase());
    const targetDepth = targetEntity?.depth ?? 0;
    const entitiesWithDepth = assignDepths(result.newEntities, targetDepth, action.target);

    // Filter by max depth
    const filteredByDepth = state.config.enableRecursiveExpansion
      ? entitiesWithDepth.filter((e) => e.depth <= state.config.maxDepth)
      : entitiesWithDepth.filter((e) => e.depth <= 1); // Only direct discoveries if recursion is disabled

    newEntities.push(...filteredByDepth);
  }

  // Add extracting trace entry
  if (newEntities.length > 0) {
    newTraceEntries.push({
      iteration,
      phase: "extracting",
      timestamp: new Date().toISOString(),
      entitiesDiscovered: newEntities,
    });
  }

  // Update state
  const updatedEntities = [...state.discoveredEntities];
  const updatedFrontier = [...state.frontier];
  for (const entity of newEntities) {
    if (!updatedEntities.find((e) => e.id === entity.id)) {
      updatedEntities.push(entity);
      // Add to frontier if recursion is enabled and depth allows
      if (state.config.enableRecursiveExpansion && entity.depth < state.config.maxDepth) {
        updatedFrontier.push({
          entityValue: entity.value,
          entityType: entity.type,
          depth: entity.depth,
          priority: calculatePriority(entity),
          reason: `Discovered by ${entity.discoveredByLabel} (depth ${entity.depth}, confidence ${(entity.confidence * 100).toFixed(0)}%)`,
          addedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Update the state
  const currentState = await getAgentState(id);
  if (!currentState) return;

  updateAgentState(id, {
    discoveredEntities: updatedEntities,
    evidence: [...currentState.evidence, ...newEvidence],
    frontier: updatedFrontier,
    visited: [...visitedSet],
    trace: [...currentState.trace, ...newTraceEntries],
    iteration,
    currentPhase: "idle",
  });
}

// =====================
// Stopping
// =====================

function stopAgent(
  id: string,
  state: AgentState,
  reason: string,
  startTime: number
): AgentState {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const traceEntry: AgentTraceEntry = {
    iteration: state.iteration,
    phase: "stopping",
    timestamp: new Date().toISOString(),
    stopReason: `${reason} (elapsed: ${elapsed}s)`,
  };
  const updated = updateAgentState(id, {
    status: "stopped",
    completedAt: new Date().toISOString(),
    currentPhase: "idle",
    trace: [...state.trace, traceEntry],
  });
  return updated || state;
}

// =====================
// Report synthesis
// =====================

async function synthesizeAgentReport(
  id: string,
  state: AgentState,
  detection: DetectionResult
): Promise<void> {
  // Convert agent evidence to SourceResult[] for the normalizer
  const sourceResults: SourceResult[] = state.evidence.map((ev) => ({
    source: ev.source,
    source_label: ev.sourceLabel,
    target: ev.target,
    status: ev.status,
    error: ev.error,
    latency_ms: ev.latencyMs,
    findings: ev.findings,
  }));

  // Normalize all collected evidence
  const bundle = normalizeSourceResults(sourceResults);

  // Synthesize the report using the existing AI client
  const synth = await synthesizeReport(
    detection.sanitized,
    detection.inputType,
    bundle.all_findings
  );

  if (!synth.raw) {
    updateAgentState(id, {
      status: "failed",
      error: `Report synthesis failed: ${synth.error || "unknown"}`,
      currentPhase: "idle",
    });
    return;
  }

  // Build ACH
  const achMatrix = await synthesizeACH(
    detection.sanitized,
    bundle.all_findings.slice(0, 10).map((f) => ({ text: f.data, source: f.source_label })),
    synth.raw.hypotheses
  );
  const ach = buildAch(synth.raw.key_findings, synth.raw.hypotheses, achMatrix);

  // Build the report (same structure as the fixed pipeline)
  const baseReport: ReportData = {
    executive_summary: synth.raw.executive_summary,
    bluf: synth.raw.bluf,
    timeline: synth.raw.timeline,
    five_w1h: synth.raw.five_w1h,
    key_findings: synth.raw.key_findings.map((k) => ({
      claim: ensureSourceTag(k.claim, k.source, k.source_url),
      source: k.source,
      source_url: k.source_url,
      confidence: k.confidence,
    })),
    detailed_analysis: synth.raw.detailed_analysis,
    contradictions: synth.raw.contradictions,
    risk_matrix: synth.raw.risk_matrix,
    sources_consulted: bundle.sources_consulted,
    ach_analysis: ach,
    geopoints: bundle.geopoints,
    link_graph: synth.raw.link_graph,
    collection_gaps: synth.raw.collection_gaps,
    monitoring_recommendations: synth.raw.monitoring_recommendations,
    confidence_score: synth.raw.overall_confidence,
    attribution_valid: false,
    needs_manual_review: false,
    input_type: detection.inputType,
    script: detection.script,
    language_guess: detection.languageGuess,
    target: detection.sanitized,
  };

  const attributed = markAttribution(baseReport);

  // Add synthesis trace entry
  const currentState = await getAgentState(id);
  const traceEntry: AgentTraceEntry = {
    iteration: state.iteration,
    phase: "synthesizing",
    timestamp: new Date().toISOString(),
    strategyNote: `Report synthesized: ${synth.raw.key_findings.length} findings, ${synth.raw.hypotheses.length} hypotheses, ${(synth.raw.overall_confidence * 100).toFixed(0)}% confidence`,
  };

  updateAgentState(id, {
    status: "completed",
    report: attributed,
    currentPhase: "complete",
    trace: [...(currentState?.trace || state.trace), traceEntry],
  });

  // Feature 19 — auto-ingest the completed agent investigation into the Knowledge Base
  // (fire-and-forget; idempotent — re-runs are no-ops)
  ingestAgentIntoKnowledgeBase(id).catch((e) =>
    console.error("[agent-runner] KB auto-ingest failed", id, e instanceof Error ? e.message : String(e))
  );
}

// Feature 19 — auto-ingest agent investigation into the Knowledge Base.
// Loaded lazily to avoid circular imports.
async function ingestAgentIntoKnowledgeBase(investigationId: string) {
  try {
    const { ingestInvestigation } = await import("../knowledge-base");
    await ingestInvestigation(investigationId, "agent");
  } catch (e) {
    console.error("[agent-runner] KB ingest error", investigationId, e instanceof Error ? e.message : String(e));
  }
}

// =====================
// Utilities
// =====================

function addTraceEntry(id: string, state: AgentState, entry: AgentTraceEntry): AgentState {
  const updated = updateAgentState(id, {
    trace: [...state.trace, entry],
  });
  return updated || state;
}

function calculatePriority(entity: DiscoveredEntity): number {
  // Higher priority for: lower depth (closer to target), higher confidence, certain types
  let priority = 50;
  priority -= entity.depth * 10; // Closer to target = higher priority
  priority += Math.round(entity.confidence * 30); // Higher confidence = higher priority
  // Boost certain entity types
  if (entity.type === "ip") priority += 10;
  if (entity.type === "email") priority += 8;
  if (entity.type === "domain") priority += 5;
  return Math.max(0, Math.min(100, priority));
}

function ensureSourceTag(claim: string, source: string, url: string): string {
  if (/\[SOURCE[:\s]/i.test(claim)) return claim;
  return `${claim} [SOURCE: ${source}, URL: ${url}]`;
}
