// Recursive Discovery Engine — orchestrates depth-first recursive entity expansion.
//
// The engine:
//   1. Takes a root entity (target + type).
//   2. Looks up discovery chains for that entity type.
//   3. Queries the appropriate sources in parallel.
//   4. Extracts new entities from the findings.
//   5. For each new entity, recursively expands (depth + 1).
//   6. Stops when max depth, max entities, max time, or no new entities.
//   7. Builds a tree structure tracking parent→child relationships.
//
// Design:
// - Depth-first: expands each branch fully before moving to the next.
// - Configurable: per-type depth overrides, global max depth, max entities, max time.
// - Non-blocking: runs in background, state persisted after each expansion.
// - Reuses existing source modules via the shared source-runner.
// - Reuses entity extraction from the agent's entity-extractor.

import { randomUUID } from "crypto";
import type { DetectionResult, SourceResult, InputType } from "../types";
import type { SourceKey } from "../router";
import type { DiscoveredEntity } from "./types";
import type { DiscoveryState, DiscoveryConfig, DiscoveryTreeNode, DiscoveryTraceEntry } from "./discovery-types";
import { DEFAULT_DISCOVERY_CONFIG } from "./discovery-types";
import { getChainsForType } from "./discovery-chains";
import { detectInput } from "../detector";
import { SOURCE_LABELS } from "../router";
import { runSource } from "../source-runner";
import { extractEntities } from "./entity-extractor";
import { entityId } from "./types";
import { createDiscoveryRecord, updateDiscoveryState, getDiscoveryState } from "./discovery-store";

// =====================
// Initialization
// =====================

export interface DiscoveryInitOptions {
  target: string;
  input_type?: string;
  config?: Partial<DiscoveryConfig>;
}

export function initDiscovery(opts: DiscoveryInitOptions): {
  id: string;
  state: DiscoveryState;
  detection: DetectionResult;
} {
  const id = randomUUID();
  const detection = detectInput(opts.target, (opts.input_type as never) || "auto");
  const now = new Date().toISOString();
  const config: DiscoveryConfig = { ...DEFAULT_DISCOVERY_CONFIG, ...opts.config };

  // Create root entity
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

  // Create root tree node
  const rootNode: DiscoveryTreeNode = {
    entityId: rootEntity.id,
    value: rootEntity.value,
    type: rootEntity.type,
    depth: 0,
    parentEntityId: null,
    discoveredBy: rootEntity.discoveredBy,
    discoveredByLabel: rootEntity.discoveredByLabel,
    discoveredAt: now,
    confidence: 1.0,
    context: rootEntity.context,
    children: [],
    expanded: false,
    findingCount: 0,
    expanding: false,
  };

  const state: DiscoveryState = {
    id,
    rootTarget: detection.sanitized,
    rootType: detection.inputType,
    config,
    status: "queued",
    tree: rootNode,
    allEntities: [rootEntity],
    expandedEntityIds: [],
    trace: [],
    startedAt: now,
    currentPhase: "idle",
  };

  createDiscoveryRecord(id, state);
  return { id, state, detection };
}

// =====================
// Main Runner
// =====================

export async function runDiscovery(id: string, detection: DetectionResult): Promise<void> {
  let state = await getDiscoveryState(id);
  if (!state) {
    console.error(`[discovery-engine] State not found for ${id}`);
    return;
  }

  const startTime = Date.now();
  state = updateDiscoveryState(id, { status: "running", currentPhase: "expanding" }) || state;

  try {
    // Start recursive expansion from the root entity
    await expandEntity(id, state.tree!, 0, startTime);

    // Mark as complete
    state = (await getDiscoveryState(id)) || state;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    updateDiscoveryState(id, {
      status: "completed",
      currentPhase: "complete",
      completedAt: new Date().toISOString(),
      currentlyExpanding: undefined,
    });
    console.info(`[discovery-engine] Session ${id} completed in ${elapsed}s. Entities: ${state.allEntities.length}, Expanded: ${state.expandedEntityIds.length}`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Discovery engine failed";
    console.error(`[discovery-engine] error for ${id}:`, errorMsg);
    updateDiscoveryState(id, {
      status: "failed",
      error: errorMsg,
      completedAt: new Date().toISOString(),
      currentPhase: "idle",
    });
  }
}

// =====================
// Recursive Expansion
// =====================

async function expandEntity(
  id: string,
  node: DiscoveryTreeNode,
  currentDepth: number,
  startTime: number
): Promise<void> {
  const state = await getDiscoveryState(id);
  if (!state) return;

  // Check stopping conditions
  if (shouldStop(state, node, currentDepth, startTime)) {
    return;
  }

  // Mark node as expanding
  node.expanding = true;
  updateDiscoveryState(id, {
    currentlyExpanding: node.value,
    currentPhase: "expanding",
  });

  // Get discovery chains for this entity type
  const chains = getChainsForType(node.type);

  // Filter chains based on config
  const filteredChains = chains.filter((c) => {
    // Skip types in skipTypes
    if (state.config.skipTypes.includes(c.toType)) return false;
    // If expandTypes is non-empty, only expand those types
    if (state.config.expandTypes.length > 0 && !state.config.expandTypes.includes(c.toType)) return false;
    // Skip same-type expansion if disabled
    if (!state.config.allowSameTypeExpansion && c.toType === node.type) return false;
    return true;
  });

  if (filteredChains.length === 0) {
    node.expanding = false;
    node.expanded = true;
    updateDiscoveryState(id, { tree: state.tree });
    return;
  }

  // Collect all sources to query (deduplicated, limited to maxSourcesPerEntity)
  const sourcesToQuery = new Set<SourceKey>();
  for (const chain of filteredChains) {
    for (const source of chain.sources) {
      sourcesToQuery.add(source);
      if (sourcesToQuery.size >= state.config.maxSourcesPerEntity) break;
    }
    if (sourcesToQuery.size >= state.config.maxSourcesPerEntity) break;
  }

  const sourceList = [...sourcesToQuery];
  const expansionStart = Date.now();

  // Query sources in parallel
  const detection: DetectionResult = {
    inputType: node.type,
    script: "latin",
    languageGuess: "en",
    regionHints: [],
    sanitized: node.value,
    valid: true,
  };

  const results = await Promise.allSettled(
    sourceList.map((source) =>
      withTimeout(
        runSource(source as never, detection),
        14000,
        `${source}:${node.value}`
      ).then((result) => ({ source, result }))
    )
  );

  // Process results
  const newEntities: DiscoveredEntity[] = [];
  const existingEntityIds = new Set(state.allEntities.map((e) => e.id));
  let totalFindings = 0;
  const sourcesSucceeded: string[] = [];

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { source, result } = r.value;
    sourcesSucceeded.push(source);

    if (result.status === "success") {
      totalFindings += result.findings.length;

      // Extract new entities from findings
      const sourceLabel = SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || source;
      const extracted = extractEntities(
        result.findings,
        source,
        sourceLabel,
        currentDepth + 1,
        existingEntityIds
      );

      for (const entity of extracted) {
        if (!existingEntityIds.has(entity.id)) {
          newEntities.push(entity);
          existingEntityIds.add(entity.id);
        }
      }
    }
  }

  // Add trace entry
  const traceEntry: DiscoveryTraceEntry = {
    timestamp: new Date().toISOString(),
    entityValue: node.value,
    entityType: node.type,
    depth: currentDepth,
    sources: sourcesSucceeded,
    newEntities,
    findingCount: totalFindings,
    durationMs: Date.now() - expansionStart,
    status: newEntities.length > 0 ? "success" : totalFindings > 0 ? "success" : "skipped",
    note: newEntities.length > 0
      ? `Discovered ${newEntities.length} new entities via ${sourcesSucceeded.length} sources`
      : `No new entities discovered (${sourcesSucceeded.length} sources queried, ${totalFindings} findings)`,
  };

  // Update node
  node.expanded = true;
  node.expanding = false;
  node.findingCount = totalFindings;

  // Mark entity as expanded
  const currentState = await getDiscoveryState(id);
  if (!currentState) return;

  const updatedExpandedIds = [...currentState.expandedEntityIds, node.entityId];
  const updatedAllEntities = [...currentState.allEntities];

  // Add new entities to allEntities and as children of this node
  for (const entity of newEntities) {
    if (!updatedAllEntities.find((e) => e.id === entity.id)) {
      updatedAllEntities.push(entity);

      // Create child tree node
      const childNode: DiscoveryTreeNode = {
        entityId: entity.id,
        value: entity.value,
        type: entity.type,
        depth: currentDepth + 1,
        parentEntityId: node.entityId,
        discoveredBy: entity.discoveredBy,
        discoveredByLabel: entity.discoveredByLabel,
        discoveredAt: entity.discoveredAt,
        confidence: entity.confidence,
        context: entity.context,
        children: [],
        expanded: false,
        findingCount: 0,
        expanding: false,
      };
      node.children.push(childNode);
    }
  }

  // Update state
  updateDiscoveryState(id, {
    allEntities: updatedAllEntities,
    expandedEntityIds: updatedExpandedIds,
    trace: [...currentState.trace, traceEntry],
    tree: currentState.tree,
  });

  // Recursively expand children (depth-first)
  for (const child of node.children) {
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed > currentState.config.maxTimeSeconds) break;
    if (updatedAllEntities.length >= currentState.config.maxEntities) break;

    await expandEntity(id, child, currentDepth + 1, startTime);
  }
}

// =====================
// Stopping Conditions
// =====================

function shouldStop(
  state: DiscoveryState,
  node: DiscoveryTreeNode,
  currentDepth: number,
  startTime: number
): boolean {
  // Already expanded
  if (state.expandedEntityIds.includes(node.entityId)) return true;

  // Max depth reached
  const typeMaxDepth = state.config.typeDepthOverrides[node.type] ?? state.config.maxDepth;
  if (currentDepth >= typeMaxDepth) return true;

  // Max entities reached
  if (state.allEntities.length >= state.config.maxEntities) return true;

  // Max time reached
  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed > state.config.maxTimeSeconds) return true;

  // No discovery chains for this type
  const chains = getChainsForType(node.type);
  if (chains.length === 0) return true;

  return false;
}

// =====================
// Timeout Utility
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
