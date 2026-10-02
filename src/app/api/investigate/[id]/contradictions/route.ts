// GET /api/investigate/[id]/contradictions — returns the contradiction report for a standard investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { detectContradictions } from "@/lib/osint/contradiction-detector";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");

  const report = detectContradictions(rec.source_results);

  return NextResponse.json({
    investigation_id: id,
    report,
  });
});
