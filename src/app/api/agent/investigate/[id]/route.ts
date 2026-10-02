// GET /api/agent/investigate/[id] — poll autonomous investigation status.
// Returns the full agent state (entities, evidence, frontier, trace, report).

import { NextResponse } from "next/server";
import { getAgentState } from "@/lib/osint/agent";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const state = await getAgentState(id);
  if (!state) return notFoundResponse("investigation");

  const elapsedSeconds = state.completedAt
    ? (new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime()) / 1000
    : (Date.now() - new Date(state.startedAt).getTime()) / 1000;

  const actionsCount = state.trace.filter((t) => t.phase === "executing").length;

  return NextResponse.json({
    investigation_id: id,
    status: state.status,
    current_phase: state.currentPhase,
    iteration: state.iteration,
    objective: state.objective,
    target: state.target,
    input_type: state.inputType,
    config: state.config,
    discovered_entities: state.discoveredEntities,
    evidence: state.evidence,
    frontier: state.frontier,
    trace: state.trace,
    current_strategy: state.currentStrategy,
    started_at: state.startedAt,
    completed_at: state.completedAt,
    error: state.error,
    report: state.report,
    stats: {
      entities_count: state.discoveredEntities.length,
      evidence_count: state.evidence.length,
      actions_count: actionsCount,
      iterations: state.iteration,
      elapsed_seconds: Math.round(elapsedSeconds),
    },
  });
});
