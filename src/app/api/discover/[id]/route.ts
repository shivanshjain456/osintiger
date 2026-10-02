// GET /api/discover/[id] — poll recursive discovery session status.
// Returns the full discovery state (tree, entities, trace, stats).

import { NextResponse } from "next/server";
import { getDiscoveryState } from "@/lib/osint/agent";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const state = await getDiscoveryState(id);
  if (!state) return notFoundResponse("discovery session");

  const elapsedSeconds = state.completedAt
    ? (new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime()) / 1000
    : (Date.now() - new Date(state.startedAt).getTime()) / 1000;

  const maxDepthReached = state.allEntities.reduce((max, e) => Math.max(max, e.depth), 0);
  const totalFindings = state.trace.reduce((s, t) => s + t.findingCount, 0);

  return NextResponse.json({
    discovery_id: id,
    status: state.status,
    current_phase: state.currentPhase,
    root_target: state.rootTarget,
    root_type: state.rootType,
    config: state.config,
    tree: state.tree,
    all_entities: state.allEntities,
    trace: state.trace,
    started_at: state.startedAt,
    completed_at: state.completedAt,
    error: state.error,
    currently_expanding: state.currentlyExpanding,
    stats: {
      total_entities: state.allEntities.length,
      total_expanded: state.expandedEntityIds.length,
      max_depth_reached: maxDepthReached,
      total_findings: totalFindings,
      elapsed_seconds: Math.round(elapsedSeconds),
    },
  });
});
