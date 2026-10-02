// GET /api/kb/graph — return a small subgraph (nodes + edges) for visualization.
// Query params: ?limit=<n> &focus=<entityId>
// If focus is provided: fetch that entity + directly connected entities + edges
// between them, laid out radially (focus at center 400,250, peers around radius 180).
// If no focus: fetch top `limit` entities by observationCount desc and the
// relationships between them, laid out in a circle (center 400,250, radius 200).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CENTER_X = 400;
const CENTER_Y = 250;

interface GraphNode {
  id: string;
  type: string;
  primaryName: string;
  confidence: number;
  observationCount: number;
  x: number;
  y: number;
}

interface GraphEdge {
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  label: string;
}

// Circular layout helper — distribute nodes evenly around a circle.
function circularLayout(
  count: number,
  radius: number,
  startIndex: number = 0
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  if (count <= 0) return positions;
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * (i + startIndex)) / Math.max(count, 1);
    positions.push({
      x: Math.round(CENTER_X + radius * Math.cos(angle)),
      y: Math.round(CENTER_Y + radius * Math.sin(angle)),
    });
  }
  return positions;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
      200
    );
    const focus = (url.searchParams.get("focus") || "").trim();

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const entityIdSet = new Set<string>();

    if (focus) {
      // === Focus mode: focus entity + directly connected peers ===
      const focusEntity = await db.kBEntity.findUnique({
        where: { id: focus },
        select: {
          id: true,
          type: true,
          primaryName: true,
          confidence: true,
          observationCount: true,
        },
      });

      if (!focusEntity) {
        return NextResponse.json({ nodes: [], edges: [] });
      }

      // All relationships touching the focus entity.
      const rels = await db.kBRelationship.findMany({
        where: {
          OR: [{ fromEntityId: focus }, { toEntityId: focus }],
        },
        select: {
          fromEntityId: true,
          toEntityId: true,
          relationType: true,
          label: true,
        },
        take: limit * 4, // cap relationship scan
      });

      // Collect connected peer IDs (excluding focus itself).
      const peerIds = new Set<string>();
      for (const r of rels) {
        if (r.fromEntityId && r.fromEntityId !== focus) peerIds.add(r.fromEntityId);
        if (r.toEntityId && r.toEntityId !== focus) peerIds.add(r.toEntityId);
      }

      // Cap peers at limit-1 (focus counts as 1 node).
      const peerIdList = Array.from(peerIds).slice(0, Math.max(limit - 1, 0));
      const peers = peerIdList.length
        ? await db.kBEntity.findMany({
            where: { id: { in: peerIdList } },
            select: {
              id: true,
              type: true,
              primaryName: true,
              confidence: true,
              observationCount: true,
            },
          })
        : [];

      // Focus node at center.
      nodes.push({
        id: focusEntity.id,
        type: focusEntity.type,
        primaryName: focusEntity.primaryName,
        confidence: focusEntity.confidence,
        observationCount: focusEntity.observationCount,
        x: CENTER_X,
        y: CENTER_Y,
      });
      entityIdSet.add(focusEntity.id);

      // Peer nodes in a circle around the focus.
      const peerPositions = circularLayout(peers.length, 180);
      for (let i = 0; i < peers.length; i++) {
        const p = peers[i];
        const pos = peerPositions[i];
        nodes.push({
          id: p.id,
          type: p.type,
          primaryName: p.primaryName,
          confidence: p.confidence,
          observationCount: p.observationCount,
          x: pos.x,
          y: pos.y,
        });
        entityIdSet.add(p.id);
      }

      // Only include edges where BOTH endpoints are in our node set.
      for (const r of rels) {
        if (entityIdSet.has(r.fromEntityId) && entityIdSet.has(r.toEntityId)) {
          edges.push({
            fromEntityId: r.fromEntityId,
            toEntityId: r.toEntityId,
            relationType: r.relationType,
            label: r.label,
          });
        }
      }
    } else {
      // === Default mode: top entities by observationCount, edges between them ===
      const topEntities = await db.kBEntity.findMany({
        orderBy: { observationCount: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          primaryName: true,
          confidence: true,
          observationCount: true,
        },
      });

      for (const e of topEntities) entityIdSet.add(e.id);

      // Place nodes in a circle.
      const positions = circularLayout(topEntities.length, 200);
      for (let i = 0; i < topEntities.length; i++) {
        const e = topEntities[i];
        const pos = positions[i];
        nodes.push({
          id: e.id,
          type: e.type,
          primaryName: e.primaryName,
          confidence: e.confidence,
          observationCount: e.observationCount,
          x: pos.x,
          y: pos.y,
        });
      }

      // Fetch relationships between the selected entities only.
      if (topEntities.length >= 2) {
        const idList = topEntities.map((e) => e.id);
        const rels = await db.kBRelationship.findMany({
          where: {
            AND: [
              { fromEntityId: { in: idList } },
              { toEntityId: { in: idList } },
            ],
          },
          select: {
            fromEntityId: true,
            toEntityId: true,
            relationType: true,
            label: true,
          },
          take: limit * 8, // cap edge scan
        });

        for (const r of rels) {
          edges.push({
            fromEntityId: r.fromEntityId,
            toEntityId: r.toEntityId,
            relationType: r.relationType,
            label: r.label,
          });
        }
      }
    }

    return NextResponse.json({ nodes, edges });
  } catch (e) {
    return safeErrorResponse(e, "Failed to load graph");
  }
}
