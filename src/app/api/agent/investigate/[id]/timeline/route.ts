// GET /api/agent/investigate/[id]/timeline — agent investigation sub-route.

import { NextResponse } from "next/server";
import { getAgentState } from "@/lib/osint/agent";
import { generateTimeline } from "@/lib/osint/temporal-engine";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const state = await getAgentState(id);

  if (!state) {
    return notFoundResponse("investigation");
  }

  const sourceResults = state.evidence.map((ev) => ({
    source: ev.source,
    source_label: ev.sourceLabel,
    target: ev.target,
    status: ev.status,
    error: ev.error,
    findings: ev.findings,
    latency_ms: ev.latencyMs,
  }));

  const report = generateTimeline(sourceResults);

  return NextResponse.json({
    investigation_id: id,
    report,
  });
});
