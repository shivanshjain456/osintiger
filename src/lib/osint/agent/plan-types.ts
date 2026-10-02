// AI Investigation Planner — domain models.
// The planner generates a structured InvestigationPlan from a natural language objective.
// Each plan contains ordered steps, each with specific sources, targets, and expected outcomes.
// The executor runs the plan deterministically (no re-planning during execution).

import type { InputType, NormalizedFinding, SourceResult, ReportData } from "../types";
import type { SourceKey } from "../router";
import type { DiscoveredEntity } from "./types";

// =====================
// Plan Steps
// =====================

/** A single step in an AI-generated investigation plan. */
export interface PlanStep {
  /** Step number (1-based). */
  stepNumber: number;
  /** Step name (e.g., "Certificate Transparency Lookup"). */
  name: string;
  /** The AI's reasoning for why this step is valuable. */
  reasoning: string;
  /** Target value to investigate (may be the original target or a discovered entity). */
  target: string;
  /** Expected entity type of the target. */
  targetType: Exclude<InputType, "auto">;
  /** Sources to query for this step. */
  sources: SourceKey[];
  /** Expected outcomes (what the AI expects to discover). */
  expectedOutcomes: string[];
  /** Whether this step can run in parallel with the next step. */
  parallelizable: boolean;
  /** Step status (updated during execution). */
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  /** Findings collected (updated during execution). */
  findingCount: number;
  /** Duration in ms (updated during execution). */
  durationMs: number;
  /** Error message if failed. */
  error?: string;
}

// =====================
// Investigation Plan
// =====================

/** A complete AI-generated investigation plan. */
export interface InvestigationPlan {
  /** The natural language objective. */
  objective: string;
  /** The target being investigated. */
  target: string;
  /** Detected input type. */
  inputType: Exclude<InputType, "auto">;
  /** The AI's overall strategy summary. */
  strategySummary: string;
  /** Ordered list of steps. */
  steps: PlanStep[];
  /** Categories the plan covers (e.g., "infrastructure", "corporate", "threat_intel"). */
  categories: string[];
  /** Estimated time in seconds. */
  estimatedTimeSeconds: number;
}

// =====================
// Configuration
// =====================

/** Configuration for plan-based investigation. */
export interface PlanConfig {
  /** Maximum number of steps in the plan. Default: 8. */
  maxSteps: number;
  /** Maximum sources per step. Default: 5. */
  maxSourcesPerStep: number;
  /** Maximum wall-clock time in seconds. Default: 120. */
  maxTimeSeconds: number;
  /** Whether to synthesize a final report. Default: true. */
  enableReportSynthesis: boolean;
  /** Whether to allow parallel step execution. Default: true. */
  allowParallelExecution: boolean;
}

export const DEFAULT_PLAN_CONFIG: PlanConfig = {
  maxSteps: 8,
  maxSourcesPerStep: 5,
  maxTimeSeconds: 120,
  enableReportSynthesis: true,
  allowParallelExecution: true,
};

// =====================
// Plan Session State
// =====================

/** Status of a plan-based investigation. */
export type PlanStatus = "planning" | "executing" | "completed" | "failed";

/** The complete state of a plan-based investigation. */
export interface PlanState {
  /** Session ID. */
  id?: string;
  /** The natural language objective. */
  objective: string;
  /** The target being investigated. */
  target: string;
  /** Detected input type. */
  inputType: Exclude<InputType, "auto">;
  /** Configuration. */
  config: PlanConfig;
  /** Current status. */
  status: PlanStatus;
  /** The AI-generated plan (null while planning). */
  plan: InvestigationPlan | null;
  /** Current step being executed (1-based, 0 = planning). */
  currentStep: number;
  /** All collected evidence (source results). */
  evidence: SourceResult[];
  /** All discovered entities. */
  discoveredEntities: DiscoveredEntity[];
  /** All findings flattened. */
  findings: NormalizedFinding[];
  /** When the session started. */
  startedAt: string;
  /** When the session completed. */
  completedAt?: string;
  /** Error message if failed. */
  error?: string;
  /** Final report (when synthesis is complete). */
  report?: ReportData | null;
  /** Planning trace — the AI's reasoning during plan generation. */
  planningNotes: string;
}

// =====================
// API Response Types
// =====================

/** Response for starting a plan-based investigation. */
export interface PlanStartResponse {
  plan_id: string;
  status: string;
  objective: string;
  target: string;
  input_type: string;
}

/** Response for polling a plan-based investigation. */
export interface PlanPollResponse {
  plan_id: string;
  status: PlanStatus;
  objective: string;
  target: string;
  input_type: string;
  config: PlanConfig;
  plan: InvestigationPlan | null;
  current_step: number;
  evidence_count: number;
  entity_count: number;
  finding_count: number;
  started_at: string;
  completed_at?: string;
  error?: string;
  report?: ReportData | null;
  planning_notes: string;
  stats: {
    total_steps: number;
    completed_steps: number;
    failed_steps: number;
    elapsed_seconds: number;
  };
}
