// GET /api/agent/investigate/[id]/dashboard — Visual Intelligence Dashboard data for an agent investigation.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildDashboardData } from "@/lib/osint/dashboard";
import type { ReportData, SourceResult } from "@/lib/osint/types";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await db.autonomousInvestigation.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }

  try {
    const report: ReportData | null = row.reportJson ? JSON.parse(row.reportJson) : null;
    const state = JSON.parse(row.stateJson || "{}");
    const sourceResults: SourceResult[] = state.evidence || [];
    const steps = state.trace?.map((t: { phase: string; timestamp: string }, i: number) => ({
      id: `step_${i}`,
      label: t.phase,
      status: "completed",
    })) || [];

    const data = await buildDashboardData(
      id,
      report,
      sourceResults,
      row.target,
      row.inputType,
      row.iterations,
      row.iterations || 1,
      steps
    );
    return NextResponse.json({ investigation_id: id, dashboard: data });
  } catch (e) {
    return safeErrorResponse(e, "Dashboard build failed");
  }
}
