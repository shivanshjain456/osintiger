// Autonomous Investigation Agent — public API.
// Re-exports the public types and functions for use by API routes and frontend.

export type {
  AgentState,
  AgentConfig,
  AgentAction,
  ActionResult,
  DiscoveredEntity,
  AgentEvidence,
  FrontierItem,
  AgentTraceEntry,
  AgentInitiateResponse,
  AgentPollResponse,
} from "./types";

export { DEFAULT_AGENT_CONFIG, entityId, visitedKey } from "./types";
export { initAgentInvestigation, runAgent } from "./runner";
export type { AgentInitOptions } from "./runner";
export { getAgentState, listRecentAgentInvestigations, deleteAgentInvestigation } from "./store";
export { planNextActions } from "./planner";
export type { PlannerOutput } from "./planner";

// Knowledge Graph (Feature 2)
export type {
  GraphNodeType,
  RelationshipType,
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  GraphApiResponse,
} from "./graph-types";
export { NODE_TYPE_META, RELATIONSHIP_TYPE_META } from "./graph-types";
export { buildKnowledgeGraph, buildKnowledgeGraphFromInvestigation } from "./graph-builder";
export { extractRelationships, detectSharedAttributeRelationships } from "./relationship-extractor";

// Recursive Discovery Engine (Feature 3)
export type {
  DiscoveryChainLink,
  DiscoveryTreeNode,
  DiscoveryConfig,
  DiscoveryStatus,
  DiscoveryTraceEntry,
  DiscoveryState,
  DiscoveryStartResponse,
  DiscoveryPollResponse,
} from "./discovery-types";
export { DEFAULT_DISCOVERY_CONFIG } from "./discovery-types";
export { DISCOVERY_CHAINS, getChainsForType, getDiscoverableTypes, getSourcesForChain, getChainDescription } from "./discovery-chains";
export { initDiscovery, runDiscovery } from "./discovery-engine";
export type { DiscoveryInitOptions } from "./discovery-engine";
export { getDiscoveryState } from "./discovery-store";

// AI Investigation Planner (Feature 4)
export type {
  PlanStep,
  InvestigationPlan,
  PlanConfig,
  PlanStatus,
  PlanState,
  PlanStartResponse,
  PlanPollResponse,
} from "./plan-types";
export { DEFAULT_PLAN_CONFIG } from "./plan-types";
export { generatePlan } from "./plan-planner";
export { initPlan, runPlan } from "./plan-executor";
export type { PlanInitOptions } from "./plan-executor";
export { getPlanState } from "./plan-store";
