// GET /api/investigate/[id]/confidence — returns the confidence breakdown for a standard investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { computeConfidence } from "@/lib/osint/confidence-engine";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");

  const keyFindings = rec.report?.key_findings || [];
  const breakdown = computeConfidence(
    rec.source_results,
    rec.report?.sources_consulted || [],
    keyFindings
  );

  return NextResponse.json({
    investigation_id: id,
    confidence: breakdown,
  });
});
