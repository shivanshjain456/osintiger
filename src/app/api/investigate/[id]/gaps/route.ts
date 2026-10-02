// GET /api/investigate/[id]/gaps — Intelligence Gap Analysis for a standard investigation.
// Identifies missing intelligence across 16 dimensions and recommends ranked next actions.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { analyzeGaps } from "@/lib/osint/gap-analysis";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }
  if (!rec.report) {
    return NextResponse.json(
      { error: "report not yet available — investigation may still be in progress" },
      { status: 409 }
    );
  }

  try {
    const objective = `Comprehensive intelligence assessment of ${rec.target}`;
    const report = await analyzeGaps(
      rec.source_results,
      rec.report,
      rec.target,
      rec.input_type,
      objective,
      id
    );
    return NextResponse.json({ investigation_id: id, report });
  } catch (e) {
    return safeErrorResponse(e, "Gap analysis failed");
  }
}
