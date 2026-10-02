// GET /api/investigate/[id]/timeline — returns the temporal intelligence report for a standard investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { generateTimeline } from "@/lib/osint/temporal-engine";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");

  const report = generateTimeline(rec.source_results);

  return NextResponse.json({
    investigation_id: id,
    report,
  });
});
