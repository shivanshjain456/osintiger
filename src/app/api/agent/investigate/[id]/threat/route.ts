// GET /api/agent/investigate/[id]/threat — agent investigation sub-route.

import { NextResponse } from "next/server";
import { getAgentState } from "@/lib/osint/agent";
import { assessThreats } from "@/lib/osint/threat-assessment";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const state = await getAgentState(id);
  if (!state) return notFoundResponse("investigation");

  const sourceResults = state.evidence.map((ev) => ({
    source: ev.source, source_label: ev.sourceLabel, target: ev.target,
    status: ev.status, error: ev.error, findings: ev.findings, latency_ms: ev.latencyMs,
  }));

  return NextResponse.json({ investigation_id: id, assessment: assessThreats(sourceResults, state.target) });
});
