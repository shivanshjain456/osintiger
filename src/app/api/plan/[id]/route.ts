// GET /api/plan/[id] — poll AI-planned investigation status.
// Returns the full plan state (plan, steps, evidence, entities, report, stats).

import { NextResponse } from "next/server";
import { getPlanState } from "@/lib/osint/agent";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const state = await getPlanState(id);
  if (!state) return notFoundResponse("plan session");

  const elapsedSeconds = state.completedAt
    ? (new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime()) / 1000
    : (Date.now() - new Date(state.startedAt).getTime()) / 1000;

  const completedSteps = state.plan?.steps.filter((s) => s.status === "completed").length || 0;
  const failedSteps = state.plan?.steps.filter((s) => s.status === "failed").length || 0;

  return NextResponse.json({
    plan_id: id,
    status: state.status,
    objective: state.objective,
    target: state.target,
    input_type: state.inputType,
    config: state.config,
    plan: state.plan,
    current_step: state.currentStep,
    evidence_count: state.evidence.length,
    entity_count: state.discoveredEntities.length,
    finding_count: state.findings.length,
    started_at: state.startedAt,
    completed_at: state.completedAt,
    error: state.error,
    report: state.report,
    planning_notes: state.planningNotes,
    stats: {
      total_steps: state.plan?.steps.length || 0,
      completed_steps: completedSteps,
      failed_steps: failedSteps,
      elapsed_seconds: Math.round(elapsedSeconds),
    },
  });
});
