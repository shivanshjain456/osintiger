// GET /api/agent/investigate/[id]/confidence — agent investigation sub-route.

import { NextResponse } from "next/server";
import { getAgentState } from "@/lib/osint/agent";
import { computeConfidence } from "@/lib/osint/confidence-engine";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const state = await getAgentState(id);

  if (!state) {
    return notFoundResponse("investigation");
  }

  // Convert agent evidence to SourceResult format
  const sourceResults = state.evidence.map((ev) => ({
    source: ev.source,
    source_label: ev.sourceLabel,
    target: ev.target,
    status: ev.status,
    error: ev.error,
    findings: ev.findings,
    latency_ms: ev.latencyMs,
  }));

  const keyFindings = state.report?.key_findings || [];
  const sourcesConsulted = sourceResults.map((sr) => ({
    source: sr.source,
    source_label: sr.source_label,
    status: sr.status,
    finding_count: sr.findings.length,
  }));

  const breakdown = computeConfidence(sourceResults, sourcesConsulted, keyFindings);

  return NextResponse.json({
    investigation_id: id,
    confidence: breakdown,
  });
});
