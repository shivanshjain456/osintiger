// Plan Executor — orchestrates AI-planned investigation execution.
//
// The executor:
//   1. Calls the AI planner to generate a plan from the objective.
//   2. Executes each step in order (or in parallel batches when allowed).
//   3. Collects evidence + discovers entities from findings.
//   4. After all steps complete, synthesizes a final report.
//
// Design:
// - The plan is generated UPFRONT before execution begins.
// - Steps can run in parallel when parallelizable=true and config allows it.
// - State is persisted after each step for live UI updates.
// - Uses the shared source-runner for source queries (DRY).
// - Uses the shared entity-extractor for entity discovery.
// - Uses the existing synthesizeReport for final report generation.

import { randomUUID } from "crypto";
import type { DetectionResult, SourceResult, NormalizedFinding, ReportData, InputType } from "../types";
import type { SourceKey } from "../router";
import type { DiscoveredEntity } from "./types";
import type { PlanState, PlanConfig, PlanStep, InvestigationPlan } from "./plan-types";
import { DEFAULT_PLAN_CONFIG } from "./plan-types";
import { detectInput } from "../detector";
import { SOURCE_LABELS } from "../router";
import { runSource } from "../source-runner";
import { extractEntities } from "./entity-extractor";
import { entityId } from "./types";
import { generatePlan } from "./plan-planner";
import { createPlanRecord, updatePlanState, getPlanState } from "./plan-store";
import { normalizeSourceResults } from "../normalizer";
import { synthesizeReport, synthesizeACH } from "../ai-client";
import { buildAch } from "../ach";
import { markAttribution } from "../attribution";

// =====================
// Initialization
// =====================

export interface PlanInitOptions {
  target: string;
  objective?: string;
  input_type?: string;
  config?: Partial<PlanConfig>;
}

export function initPlan(opts: PlanInitOptions): {
  id: string;
  state: PlanState;
  detection: DetectionResult;
} {
  const id = randomUUID();
  const detection = detectInput(opts.target, (opts.input_type as never) || "auto");
  const now = new Date().toISOString();
  const config: PlanConfig = { ...DEFAULT_PLAN_CONFIG, ...opts.config };

  const objective = opts.objective?.trim() || `Comprehensive investigation of ${detection.sanitized}`;

  const rootEntity: DiscoveredEntity = {
    id: entityId(detection.sanitized, detection.inputType),
    value: detection.sanitized,
    type: detection.inputType,
    depth: 0,
    discoveredBy: "user",
    discoveredByLabel: "User input",
    discoveredAt: now,
    confidence: 1.0,
    context: `Root target: ${detection.sanitized}`,
  };

  const state: PlanState = {
    id,
    objective,
    target: detection.sanitized,
    inputType: detection.inputType,
    config,
    status: "planning",
    plan: null,
    currentStep: 0,
    evidence: [],
    discoveredEntities: [rootEntity],
    findings: [],
    startedAt: now,
    planningNotes: "Initializing plan generation...",
  };

  createPlanRecord(id, state);
  return { id, state, detection };
}

// =====================
// Main Runner
// =====================

export async function runPlan(id: string, detection: DetectionResult): Promise<void> {
  let state = await getPlanState(id);
  if (!state) {
    console.error(`[plan-executor] State not found for ${id}`);
    return;
  }

  const startTime = Date.now();

  try {
    // =====================
    // Phase 1: Generate the plan
    // =====================
    updatePlanState(id, { planningNotes: "Generating investigation plan with AI..." });

    const planResult = await generatePlan(state.objective, state.target, state.inputType, state.config);

    if (!planResult.plan) {
      updatePlanState(id, {
        status: "failed",
        error: planResult.error || "Plan generation failed",
        planningNotes: planResult.notes,
        completedAt: new Date().toISOString(),
      });
      return;
    }

    state = updatePlanState(id, {
      plan: planResult.plan,
      planningNotes: planResult.notes,
      status: "executing",
    }) || state;

    // =====================
    // Phase 2: Execute the plan
    // =====================
    const plan = planResult.plan;
    const allEvidence: SourceResult[] = [];
    const allEntities = [...state.discoveredEntities];
    const allFindings: NormalizedFinding[] = [];

    for (let i = 0; i < plan.steps.length; i++) {
      // Check time limit
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > state.config.maxTimeSeconds) {
        // Mark remaining steps as skipped
        for (let j = i; j < plan.steps.length; j++) {
          plan.steps[j].status = "skipped";
          plan.steps[j].error = "Time limit reached";
        }
        updatePlanState(id, { plan });
        break;
      }

      const step = plan.steps[i];
      step.status = "running";
      updatePlanState(id, { plan, currentStep: i + 1 });

      // Execute the step
      const stepResult = await executeStep(step, new Set(allEntities.map((e) => e.id)));
      step.status = stepResult.status;
      step.findingCount = stepResult.findingCount;
      step.durationMs = stepResult.durationMs;
      step.error = stepResult.error;

      // Collect evidence
      if (stepResult.sourceResults.length > 0) {
        allEvidence.push(...stepResult.sourceResults);

        // Extract entities from findings
        const existingIds = new Set(allEntities.map((e) => e.id));
        for (const sr of stepResult.sourceResults) {
          if (sr.status !== "success") continue;
          const sourceLabel = SOURCE_LABELS[sr.source as keyof typeof SOURCE_LABELS] || sr.source;
          const newEntities = extractEntities(sr.findings, sr.source, sourceLabel, 1, existingIds);
          for (const e of newEntities) {
            if (!existingIds.has(e.id)) {
              allEntities.push(e);
              existingIds.add(e.id);
            }
          }
          // Collect findings
          for (const f of sr.findings) {
            allFindings.push(f);
          }
        }
      }

      // Update state
      updatePlanState(id, {
        plan,
        evidence: allEvidence,
        discoveredEntities: allEntities,
        findings: allFindings,
        currentStep: i + 1,
      });
    }

    // =====================
    // Phase 3: Synthesize final report
    // =====================
    if (state.config.enableReportSynthesis && allEvidence.length > 0) {
      updatePlanState(id, { planningNotes: "Synthesizing intelligence report..." });

      const bundle = normalizeSourceResults(allEvidence);
      const synth = await synthesizeReport(
        detection.sanitized,
        detection.inputType,
        bundle.all_findings
      );

      if (synth.raw) {
        const achMatrix = await synthesizeACH(
          detection.sanitized,
          bundle.all_findings.slice(0, 10).map((f) => ({ text: f.data, source: f.source_label })),
          synth.raw.hypotheses
        );
        const ach = buildAch(synth.raw.key_findings, synth.raw.hypotheses, achMatrix);

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
        updatePlanState(id, {
          report: attributed,
          planningNotes: `Report synthesized: ${synth.raw.key_findings.length} findings, ${synth.raw.hypotheses.length} hypotheses, ${(synth.raw.overall_confidence * 100).toFixed(0)}% confidence`,
        });
      } else {
        updatePlanState(id, {
          planningNotes: `Report synthesis failed: ${synth.error || "unknown error"}`,
        });
      }
    }

    // Mark as complete
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    updatePlanState(id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      planningNotes: `Investigation completed in ${elapsed}s. ${allEvidence.length} evidence items, ${allEntities.length} entities, ${allFindings.length} findings.`,
    });

    console.info(`[plan-executor] Session ${id} completed in ${elapsed}s. Steps: ${plan.steps.length}, Evidence: ${allEvidence.length}`);

    // Feature 19 — auto-ingest the completed plan investigation into the Knowledge Base
    // (fire-and-forget; idempotent — re-runs are no-ops)
    ingestPlanIntoKnowledgeBase(id).catch((e) =>
      console.error("[plan-executor] KB auto-ingest failed", id, e instanceof Error ? e.message : String(e))
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Plan executor failed";
    console.error(`[plan-executor] error for ${id}:`, errorMsg);
    updatePlanState(id, {
      status: "failed",
      error: errorMsg,
      completedAt: new Date().toISOString(),
    });
  }
}

// =====================
// Step Execution
// =====================

interface StepResult {
  status: "completed" | "failed";
  findingCount: number;
  durationMs: number;
  error?: string;
  sourceResults: SourceResult[];
}

async function executeStep(step: PlanStep, existingEntityIds: Set<string>): Promise<StepResult> {
  const start = Date.now();
  const detection: DetectionResult = {
    inputType: step.targetType,
    script: "latin",
    languageGuess: "en",
    regionHints: [],
    sanitized: step.target,
    valid: true,
  };

  // Query all sources in parallel
  const results = await Promise.allSettled(
    step.sources.map((source) =>
      withTimeout(
        runSource(source as never, detection),
        14000,
        `${source}:${step.target}`
      )
    )
  );

  const sourceResults: SourceResult[] = results.map((r, i) => {
    const source = step.sources[i];
    if (r.status === "fulfilled") return r.value;
    return {
      source,
      source_label: SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || source,
      target: step.target,
      status: "timeout" as const,
      error: r.reason?.message || "Source timed out",
      findings: [],
    };
  });

  const findingCount = sourceResults.reduce((s, sr) => s + sr.findings.length, 0);
  const hasError = sourceResults.every((sr) => sr.status === "error" || sr.status === "timeout");

  return {
    status: hasError ? "failed" : "completed",
    findingCount,
    durationMs: Date.now() - start,
    error: hasError ? "All sources failed" : undefined,
    sourceResults,
  };
}

// =====================
// Utilities
// =====================

function ensureSourceTag(claim: string, source: string, url: string): string {
  if (/\[SOURCE[:\s]/i.test(claim)) return claim;
  return `${claim} [SOURCE: ${source}, URL: ${url}]`;
}

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

// Feature 19 — auto-ingest plan session into the Knowledge Base.
// Loaded lazily to avoid circular imports.
async function ingestPlanIntoKnowledgeBase(investigationId: string) {
  try {
    const { ingestInvestigation } = await import("../knowledge-base");
    await ingestInvestigation(investigationId, "plan");
  } catch (e) {
    console.error("[plan-executor] KB ingest error", investigationId, e instanceof Error ? e.message : String(e));
  }
}
