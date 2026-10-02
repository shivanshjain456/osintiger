// Recursive Discovery Engine — domain models.
// Defines the structure for recursive evidence expansion: each entity type
// can discover downstream entity types through specific sources, forming a
// discovery chain that expands recursively until stopping criteria are met.
//
// Example chain:
//   domain → [crt.sh: subdomains + certificates] → [DNS: IPs] → [Shodan: ports + services]
//   person → [GitHub: repositories + emails] → [web search: domains + social]

import type { InputType } from "../types";
import type { SourceKey } from "../router";
import type { DiscoveredEntity } from "./types";

// =====================
// Discovery Chain Types
// =====================

/** A single link in a discovery chain: what entity type can be discovered from another. */
export interface DiscoveryChainLink {
  /** The entity type being investigated. */
  fromType: Exclude<InputType, "auto">;
  /** The entity type that can be discovered. */
  toType: Exclude<InputType, "auto">;
  /** Sources that can discover this type of entity. */
  sources: SourceKey[];
  /** Human-readable description of what this chain discovers. */
  description: string;
}

/** A node in the recursion tree. */
export interface DiscoveryTreeNode {
  /** Unique node ID (same as entity ID). */
  entityId: string;
  /** Entity value. */
  value: string;
  /** Entity type. */
  type: Exclude<InputType, "auto">;
  /** Depth in the recursion tree (0 = root). */
  depth: number;
  /** Parent entity ID (null for root). */
  parentEntityId: string | null;
  /** Source that discovered this entity. */
  discoveredBy: string;
  /** Source label that discovered this entity. */
  discoveredByLabel: string;
  /** When this entity was discovered. */
  discoveredAt: string;
  /** Confidence (0-1). */
  confidence: number;
  /** Context in which this entity was discovered. */
  context: string;
  /** Children nodes (entities discovered from this entity). */
  children: DiscoveryTreeNode[];
  /** Whether this node has been expanded (investigated). */
  expanded: boolean;
  /** Number of findings collected for this entity. */
  findingCount: number;
  /** Whether this node is currently being expanded. */
  expanding: boolean;
}

// =====================
// Configuration
// =====================

/** Configuration for recursive discovery. */
export interface DiscoveryConfig {
  /** Maximum recursion depth (0 = root only, 1 = direct discoveries, etc.). Default: 3. */
  maxDepth: number;
  /** Per-type depth overrides (e.g., { domain: 4, ip: 2 }). */
  typeDepthOverrides: Partial<Record<Exclude<InputType, "auto">, number>>;
  /** Maximum total entities to discover (prevents explosion). Default: 100. */
  maxEntities: number;
  /** Maximum wall-clock time in seconds. Default: 120. */
  maxTimeSeconds: number;
  /** Maximum sources to query per entity per expansion. Default: 5. */
  maxSourcesPerEntity: number;
  /** Whether to expand discovered entities of the same type (e.g., domain → domain via subdomains). Default: true. */
  allowSameTypeExpansion: boolean;
  /** Entity types to expand (empty = expand all types). */
  expandTypes: Exclude<InputType, "auto">[];
  /** Entity types to NOT expand (overrides expandTypes). */
  skipTypes: Exclude<InputType, "auto">[];
}

export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  maxDepth: 3,
  typeDepthOverrides: {},
  maxEntities: 100,
  maxTimeSeconds: 120,
  maxSourcesPerEntity: 5,
  allowSameTypeExpansion: true,
  expandTypes: [],
  skipTypes: [],
};

// =====================
// Discovery Session State
// =====================

/** Status of a discovery session. */
export type DiscoveryStatus = "queued" | "running" | "completed" | "failed" | "stopped";

/** A single step in the discovery trace. */
export interface DiscoveryTraceEntry {
  /** Timestamp ISO string. */
  timestamp: string;
  /** Entity being expanded. */
  entityValue: string;
  entityType: Exclude<InputType, "auto">;
  depth: number;
  /** Sources queried. */
  sources: string[];
  /** New entities discovered. */
  newEntities: DiscoveredEntity[];
  /** Findings count. */
  findingCount: number;
  /** Duration in ms. */
  durationMs: number;
  /** Status of this expansion. */
  status: "success" | "error" | "skipped" | "timeout";
  /** Notes/error message. */
  note?: string;
}

/** The complete state of a discovery session. */
export interface DiscoveryState {
  /** Session ID. */
  id?: string;
  /** The root target. */
  rootTarget: string;
  /** Root entity type. */
  rootType: Exclude<InputType, "auto">;
  /** Discovery configuration. */
  config: DiscoveryConfig;
  /** Current status. */
  status: DiscoveryStatus;
  /** The recursion tree (root node). */
  tree: DiscoveryTreeNode | null;
  /** All discovered entities (flat list, includes root). */
  allEntities: DiscoveredEntity[];
  /** All visited entity IDs (prevents re-expansion). */
  expandedEntityIds: string[];
  /** Discovery trace (ordered log). */
  trace: DiscoveryTraceEntry[];
  /** When the session started. */
  startedAt: string;
  /** When the session completed. */
  completedAt?: string;
  /** Error message if failed. */
  error?: string;
  /** Current phase. */
  currentPhase: "expanding" | "extracting" | "idle" | "complete";
  /** Currently expanding entity (for UI feedback). */
  currentlyExpanding?: string;
}

// =====================
// API Response Types
// =====================

/** Response for starting a discovery session. */
export interface DiscoveryStartResponse {
  discovery_id: string;
  status: string;
  root_target: string;
  root_type: string;
  config: DiscoveryConfig;
}

/** Response for polling a discovery session. */
export interface DiscoveryPollResponse {
  discovery_id: string;
  status: DiscoveryStatus;
  current_phase: DiscoveryState["currentPhase"];
  root_target: string;
  root_type: string;
  config: DiscoveryConfig;
  tree: DiscoveryTreeNode | null;
  all_entities: DiscoveredEntity[];
  trace: DiscoveryTraceEntry[];
  started_at: string;
  completed_at?: string;
  error?: string;
  currently_expanding?: string;
  stats: {
    total_entities: number;
    total_expanded: number;
    max_depth_reached: number;
    total_findings: number;
    elapsed_seconds: number;
  };
}
