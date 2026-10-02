// GET /api/agent/investigate/[id]/resolution — agent investigation sub-route.

import { NextResponse } from "next/server";
import { getAgentState } from "@/lib/osint/agent";
import { resolveEntities } from "@/lib/osint/entity-resolution";
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

  return NextResponse.json({ investigation_id: id, report: resolveEntities(sourceResults, state.target) });
});
