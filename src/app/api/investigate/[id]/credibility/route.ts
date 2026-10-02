// GET /api/investigate/[id]/credibility — returns the source credibility ranking for a standard investigation.
// Supports optional ?config= JSON query param for custom weights/overrides.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { computeCredibilityRanking, DEFAULT_CREDIBILITY_CONFIG, type CredibilityConfig } from "@/lib/osint/credibility-ranking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecord(id);

  if (!rec) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }

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

  const ranking = computeCredibilityRanking(rec.source_results, config);

  return NextResponse.json({
    investigation_id: id,
    ranking,
  });
}
