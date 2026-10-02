// GET /api/agent/investigate/[id]/gaps — Intelligence Gap Analysis for an agent investigation.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeGaps } from "@/lib/osint/gap-analysis";
import type { ReportData, SourceResult } from "@/lib/osint/types";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await db.autonomousInvestigation.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }
  if (!row.reportJson) {
    return NextResponse.json(
      { error: "report not yet available — agent may still be running" },
      { status: 409 }
    );
  }

  try {
    const report: ReportData = JSON.parse(row.reportJson);
    const state = JSON.parse(row.stateJson || "{}");
    const sourceResults: SourceResult[] = state.evidence || [];
    const objective = `Comprehensive intelligence assessment of ${row.target}`;
    const gapReport = await analyzeGaps(
      sourceResults,
      report,
      row.target,
      row.inputType,
      objective,
      id
    );
    return NextResponse.json({ investigation_id: id, report: gapReport });
  } catch (e) {
    return safeErrorResponse(e, "Gap analysis failed");
  }
}
