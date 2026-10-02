// Graph Builder — constructs a KnowledgeGraph from an investigation's state.
// Derives nodes from discoveredEntities and edges from evidence findings.
//
// The graph is built on-demand (not stored), ensuring it's always up-to-date
// with the latest discoveries. This follows the Single Source of Truth principle:
// the investigation state IS the source of truth; the graph is a derived view.
//
// Design:
// - Pure function: given AgentState, returns KnowledgeGraph.
// - Incremental: could be optimized to cache, but for now rebuilds each time
//   (graphs are small enough — typically <100 nodes).
// - Deduplication: edges are deduped by (from, to, type).
// - Weight calculation: node weight = degree (number of connected edges).

import type { AgentState, DiscoveredEntity, AgentEvidence } from "./types";
import type { GraphNode, GraphEdge, KnowledgeGraph, GraphNodeType, RelationshipType } from "./graph-types";
import { extractRelationships, detectSharedAttributeRelationships } from "./relationship-extractor";
import { extractEntities } from "./entity-extractor";

/**
 * Build a knowledge graph from an agent's state.
 * @param state The agent state (discoveredEntities + evidence).
 * @param investigationId The investigation ID.
 * @returns The complete knowledge graph.
 */
export function buildKnowledgeGraph(
  state: AgentState,
  investigationId: string
): KnowledgeGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>(); // For dedup: "from|to|type"

  // =====================
  // 1. Build nodes from discoveredEntities
  // =====================
  for (const entity of state.discoveredEntities) {
    nodes.push({
      id: entity.id,
      label: entity.value,
      type: mapEntityTypeToGraphType(entity.type),
      weight: 0, // Will be calculated after edges are built
      confidence: entity.confidence,
      depth: entity.depth,
      source: entity.discoveredByLabel,
      discoveredAt: entity.discoveredAt,
      context: entity.context,
    });
  }

  // =====================
  // 2. Build edges from evidence findings
  // =====================
  for (const evidence of state.evidence) {
    for (const finding of evidence.findings) {
      const findingEdges = extractRelationships(
        finding.data,
        state.discoveredEntities,
        evidence.sourceLabel
      );
      for (const edge of findingEdges) {
        const key = `${edge.from}|${edge.to}|${edge.type}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push(edge);
        }
      }
    }
  }

  // =====================
  // 3. Detect shared-attribute relationships
  // =====================
  const { edges: sharedEdges } = detectSharedAttributeRelationships(state.discoveredEntities);
  for (const edge of sharedEdges) {
    const key = `${edge.from}|${edge.to}|${edge.type}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push(edge);
    }
  }

  // =====================
  // 4. Add "discovered_by" edges (entity → entity that discovered it)
  // =====================
  // If entity B was discovered while investigating entity A, add a discovered_by edge.
  // This creates the investigation tree structure in the graph.
  const entityByValue = new Map<string, DiscoveredEntity>();
  for (const e of state.discoveredEntities) {
    entityByValue.set(e.value.toLowerCase(), e);
  }
  for (const entity of state.discoveredEntities) {
    if (entity.depth > 0 && entity.discoveredBy !== "agent") {
      // Find the entity that was being investigated when this was discovered
      // The context field contains the finding text, which may reference the parent entity.
      // We look for any known entity value in the context.
      const context = entity.context || "";
      for (const [value, parent] of entityByValue) {
        if (parent.id === entity.id) continue;
        if (context.toLowerCase().includes(value.toLowerCase())) {
          const key = `${entity.id}|${parent.id}|discovered_by`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push({
              from: entity.id,
              to: parent.id,
              type: "discovered_by",
              label: "discovered via",
              confidence: 0.7,
              source: entity.discoveredByLabel,
              evidence: context.slice(0, 200),
            });
          }
          break; // Only add one discovered_by edge per entity
        }
      }
    }
  }

  // =====================
  // 5. Calculate node weights (degree = number of connected edges)
  // =====================
  const degreeMap = new Map<string, number>();
  for (const node of nodes) {
    degreeMap.set(node.id, 0);
  }
  for (const edge of edges) {
    degreeMap.set(edge.from, (degreeMap.get(edge.from) || 0) + 1);
    degreeMap.set(edge.to, (degreeMap.get(edge.to) || 0) + 1);
  }
  for (const node of nodes) {
    node.weight = degreeMap.get(node.id) || 0;
  }

  // =====================
  // 6. Calculate metadata
  // =====================
  const typeDistribution = {} as Record<GraphNodeType, number>;
  for (const node of nodes) {
    typeDistribution[node.type] = (typeDistribution[node.type] || 0) + 1;
  }

  const relationshipDistribution = {} as Record<RelationshipType, number>;
  for (const edge of edges) {
    relationshipDistribution[edge.type] = (relationshipDistribution[edge.type] || 0) + 1;
  }

  const maxDepth = state.discoveredEntities.reduce((max, e) => Math.max(max, e.depth), 0);

  return {
    investigationId,
    nodes,
    edges,
    meta: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      typeDistribution,
      relationshipDistribution,
      maxDepth,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Map an agent entity type to a graph node type.
 * Most types map directly; some need adjustment.
 */
function mapEntityTypeToGraphType(
  type: DiscoveredEntity["type"]
): GraphNodeType {
  // The agent's InputType and GraphNodeType are mostly aligned.
  // "username" maps to "social" in the graph (social media account).
  // Others map directly.
  if (type === "username") return "social";
  return type as GraphNodeType;
}

/**
 * Build a knowledge graph from a standard (non-agent) investigation record.
 * This allows the graph to be used with the fixed pipeline too.
 */
export function buildKnowledgeGraphFromInvestigation(
  sourceResults: { source: string; source_label: string; target: string; status: string; findings: { data: string; source_url: string; confidence: number; timestamp: string }[] }[],
  target: string,
  inputType: string,
  investigationId: string
): KnowledgeGraph {
  // Convert source results to the format expected by the graph builder.
  // We create a minimal AgentState-like structure.
  const entities: DiscoveredEntity[] = [
    {
      id: entityIdStable(target, inputType),
      value: target,
      type: inputType as DiscoveredEntity["type"],
      depth: 0,
      discoveredBy: "investigation",
      discoveredByLabel: "User input",
      discoveredAt: new Date().toISOString(),
      confidence: 1.0,
      context: `Original investigation target: ${target}`,
    },
  ];

  // Extract entities from findings using the shared entity-extractor
  const existingIds = new Set(entities.map((e) => e.id));
  for (const sr of sourceResults) {
    if (sr.status === "error" || sr.status === "skipped") continue;
    const newEntities = extractEntities(
      sr.findings,
      sr.source,
      sr.source_label,
      1,
      existingIds
    );
    for (const e of newEntities) {
      if (!existingIds.has(e.id)) {
        entities.push(e);
        existingIds.add(e.id);
      }
    }
  }

  // Build a minimal state
  const state: Partial<AgentState> = {
    discoveredEntities: entities,
    evidence: sourceResults.map((sr) => ({
      id: `ev_${sr.source}_${sr.target}`,
      source: sr.source,
      sourceLabel: sr.source_label,
      target: sr.target,
      findings: sr.findings,
      status: sr.status as "success" | "error" | "skipped" | "timeout",
      iteration: 0,
      collectedAt: new Date().toISOString(),
    })),
  };

  return buildKnowledgeGraph(state as AgentState, investigationId);
}

/** Simple stable ID for entities (reused from agent types). */
function entityIdStable(value: string, type: string): string {
  const s = `${type}:${value.toLowerCase()}`;
  let hash = 5381;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return `ent_${Math.abs(hash).toString(36)}`;
}
