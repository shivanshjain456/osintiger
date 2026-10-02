// Autonomous Investigation Agent — domain models.
// The agent maintains a mutable state that evolves through iterations.
// Each iteration: PLAN (AI decides next actions) → EXECUTE (query sources) → EXTRACT (discover new entities).
//
// Design principles:
// - Strong typing: every field is explicitly typed, no `any`.
// - Immutability: state transitions create new objects (avoids mutation bugs).
// - Serializability: all types are JSON-serializable for DB persistence.
// - Extensibility: new entity types, action types, and stopping conditions can be added without breaking existing code.

import type { InputType, NormalizedFinding, SourceResult, ReportData } from "../types";

// =====================
// Configuration
// =====================

/** Stopping conditions for the agent. All are configurable via env or API. */
export interface AgentConfig {
  /** Maximum number of plan→execute→extract iterations. Default: 5. */
  maxIterations: number;
  /** Maximum number of discovered entities (prevents graph explosion). Default: 50. */
  maxEntities: number;
  /** Maximum wall-clock time in seconds. Default: 120. */
  maxTimeSeconds: number;
  /** Maximum recursion depth (0 = original target only, 1 = direct discoveries, etc.). Default: 3. */
  maxDepth: number;
  /** Maximum actions per iteration (prevents the planner from issuing too many parallel queries). Default: 5. */
  maxActionsPerIteration: number;
  /** Whether to recursively expand discovered entities (false = only investigate the original target). Default: true. */
  enableRecursiveExpansion: boolean;
  /** Whether to synthesize a final report when the agent stops. Default: true. */
  enableReportSynthesis: boolean;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 5,
  maxEntities: 50,
  maxTimeSeconds: 120,
  maxDepth: 3,
  maxActionsPerIteration: 5,
  enableRecursiveExpansion: true,
  enableReportSynthesis: true,
};

// =====================
// Discovered Entities
// =====================

/** An entity discovered during investigation (domain, IP, email, etc.). */
export interface DiscoveredEntity {
  /** Stable unique ID (hash of value+type). */
  id: string;
  /** The entity value (e.g., "mail.google.com", "8.8.8.8", "user@example.com"). */
  value: string;
  /** Detected entity type. */
  type: Exclude<InputType, "auto">;
  /** Recursion depth: 0 = original target, 1 = discovered from target, etc. */
  depth: number;
  /** Source key that discovered this entity. */
  discoveredBy: string;
  /** Source label that discovered this entity. */
  discoveredByLabel: string;
  /** Timestamp ISO string. */
  discoveredAt: string;
  /** Confidence that this entity is relevant to the investigation (0-1). */
  confidence: number;
  /** The finding text that revealed this entity. */
  context: string;
}

// =====================
// Evidence
// =====================

/** Evidence collected from a single source query. */
export interface AgentEvidence {
  /** Unique ID for this evidence item. */
  id: string;
  /** Source key (e.g., "crtsh", "doh"). */
  source: string;
  /** Human-readable source label. */
  sourceLabel: string;
  /** Target that was queried. */
  target: string;
  /** Findings returned by the source. */
  findings: NormalizedFinding[];
  /** Status of the source query. */
  status: "success" | "error" | "skipped" | "timeout";
  /** Error message if status is error/timeout. */
  error?: string;
  /** Iteration number when this evidence was collected. */
  iteration: number;
  /** Timestamp ISO string. */
  collectedAt: string;
  /** Latency in milliseconds. */
  latencyMs?: number;
}

// =====================
// Frontier
// =====================

/** An entity in the frontier awaiting investigation. */
export interface FrontierItem {
  /** Entity value to investigate. */
  entityValue: string;
  /** Entity type. */
  entityType: Exclude<InputType, "auto">;
  /** Recursion depth. */
  depth: number;
  /** Priority score (higher = more valuable to investigate next). 0-100. */
  priority: number;
  /** Why this entity is in the frontier. */
  reason: string;
  /** When this item was added to the frontier. */
  addedAt: string;
}

// =====================
// Actions
// =====================

/** An action the agent decided to take. */
export interface AgentAction {
  /** Source key to query (must be a valid SourceKey). */
  source: string;
  /** Target value to query with this source. */
  target: string;
  /** The agent's reasoning for why this action is valuable. */
  reason: string;
  /** Expected entity type of the target (for routing/validation). */
  targetType: Exclude<InputType, "auto">;
}

/** The result of executing an action. */
export interface ActionResult {
  action: AgentAction;
  /** The SourceResult from the source module. */
  sourceResult: SourceResult;
  /** New entities discovered from this action's findings. */
  newEntities: DiscoveredEntity[];
  /** Whether this action was skipped (already visited). */
  skipped: boolean;
  /** Skip reason if skipped. */
  skipReason?: string;
  /** Execution duration in ms. */
  durationMs: number;
}

// =====================
// Trace
// =====================

/** A single entry in the agent's reasoning trace. */
export interface AgentTraceEntry {
  /** Iteration number (1-based). */
  iteration: number;
  /** Phase of this trace entry. */
  phase: "planning" | "executing" | "extracting" | "stopping" | "synthesizing";
  /** Timestamp ISO string. */
  timestamp: string;
  /** For planning: the actions planned. For executing: the action + result. For extracting: entities found. */
  actions?: AgentAction[];
  /** Strategy note from the planner. */
  strategyNote?: string;
  /** Action that was executed (for executing phase). */
  action?: AgentAction;
  /** Result of the action (for executing phase). */
  result?: {
    status: "success" | "error" | "skipped" | "timeout";
    findingCount: number;
    newEntitiesFound: number;
    summary: string;
    latencyMs?: number;
  };
  /** Entities discovered (for extracting phase). */
  entitiesDiscovered?: DiscoveredEntity[];
  /** Stopping reason (for stopping phase). */
  stopReason?: string;
}

// =====================
// Agent State
// =====================

/** The complete mutable state of an autonomous investigation. */
export interface AgentState {
  /** Unique investigation ID (assigned on creation, used for persistence). */
  id?: string;
  /** The investigation objective (natural language description). */
  objective: string;
  /** The original target. */
  target: string;
  /** Detected input type of the original target. */
  inputType: Exclude<InputType, "auto">;
  /** Agent configuration. */
  config: AgentConfig;
  /** Current status. */
  status: "queued" | "running" | "completed" | "failed" | "stopped";
  /** Current iteration (0 = not started, 1+ = completed iterations). */
  iteration: number;
  /** All discovered entities (including the original target). */
  discoveredEntities: DiscoveredEntity[];
  /** All collected evidence. */
  evidence: AgentEvidence[];
  /** Frontier of entities awaiting investigation. */
  frontier: FrontierItem[];
  /** Set of visited "source:target" keys (prevents redundant queries). */
  visited: string[];
  /** Reasoning trace (ordered log of all decisions and actions). */
  trace: AgentTraceEntry[];
  /** When the agent started. */
  startedAt: string;
  /** When the agent completed. */
  completedAt?: string;
  /** Error message if failed. */
  error?: string;
  /** Final report (when synthesis is complete). */
  report?: ReportData | null;
  /** Current phase (for live UI updates). */
  currentPhase: "planning" | "executing" | "extracting" | "synthesizing" | "idle" | "complete";
  /** Strategy note from the last planning phase. */
  currentStrategy?: string;
}

// =====================
// Public API Types
// =====================

/** Response for initiating an autonomous investigation. */
export interface AgentInitiateResponse {
  investigation_id: string;
  status: string;
  objective: string;
  target: string;
  input_type: string;
  config: AgentConfig;
}

/** Response for polling an autonomous investigation. */
export interface AgentPollResponse {
  investigation_id: string;
  status: AgentState["status"];
  current_phase: AgentState["currentPhase"];
  iteration: number;
  objective: string;
  target: string;
  input_type: string;
  config: AgentConfig;
  discovered_entities: DiscoveredEntity[];
  evidence: AgentEvidence[];
  frontier: FrontierItem[];
  trace: AgentTraceEntry[];
  current_strategy?: string;
  started_at: string;
  completed_at?: string;
  error?: string;
  report?: ReportData | null;
  stats: {
    entities_count: number;
    evidence_count: number;
    actions_count: number;
    iterations: number;
    elapsed_seconds: number;
  };
}

// =====================
// Utility: entity ID generation
// =====================

/** Generate a stable ID for an entity (hash of value+type). */
export function entityId(value: string, type: string): string {
  // Simple non-crypto hash (djb2) — stable and fast.
  const s = `${type}:${value.toLowerCase()}`;
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `ent_${Math.abs(hash).toString(36)}`;
}

/** Generate a visited key for deduplication. */
export function visitedKey(source: string, target: string): string {
  return `${source}:${target.toLowerCase()}`;
}
