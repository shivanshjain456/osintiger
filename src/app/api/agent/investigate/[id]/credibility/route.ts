// GET /api/agent/investigate/[id]/credibility — returns the source credibility ranking for an autonomous agent investigation.

import { NextResponse } from "next/server";
import { getAgentState } from "@/lib/osint/agent";
import { computeCredibilityRanking, DEFAULT_CREDIBILITY_CONFIG, type CredibilityConfig } from "@/lib/osint/credibility-ranking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const state = await getAgentState(id);

  if (!state) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
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

  // Parse optional config from query params
  const url = new URL(req.url);
  const configParam = url.searchParams.get("config");
  let config: CredibilityConfig = DEFAULT_CREDIBILITY_CONFIG;

  if (configParam) {
    try {
      const parsed = JSON.parse(configParam) as Partial<CredibilityConfig>;
      config = {
        weights: { ...DEFAULT_CREDIBILITY_CONFIG.weights, ...parsed.weights },
        overrides: { ...DEFAULT_CREDIBILITY_CONFIG.overrides, ...parsed.overrides },
      };
    } catch {
      // Ignore invalid config, use defaults
    }
  }

  const ranking = computeCredibilityRanking(sourceResults, config);

  return NextResponse.json({
    investigation_id: id,
    ranking,
  });
}
