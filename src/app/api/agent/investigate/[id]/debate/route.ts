// POST /api/agent/investigate/[id]/debate — Run a multi-agent debate on an agent investigation.
// GET /api/agent/investigate/[id]/debate — Same (triggers a fresh debate).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runDebate, buildEvidenceBundle, type DebateContext } from "@/lib/osint/multi-agent-debate";
import type { ReportData, SourceResult } from "@/lib/osint/types";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  req: Request,
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

  let body: { maxRounds?: number; objective?: string } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // Body is optional
  }

  const maxRounds = Math.min(Math.max(body.maxRounds || 1, 1), 3);
  const rawObjective = body.objective?.trim() || `Comprehensive multi-agent analysis of ${row.target}`;
  const objective = rawObjective.slice(0, 500);

  const report: ReportData = JSON.parse(row.reportJson);
  const state = JSON.parse(row.stateJson || "{}");
  const sourceResults: SourceResult[] = state.evidence || [];
  const evidenceBundle = buildEvidenceBundle(report, sourceResults);

  const context: DebateContext = {
    investigationId: id,
    objective,
    target: row.target,
    inputType: row.inputType,
    report,
    sourceResults,
    keyFindings: report.key_findings,
    evidenceBundle,
    maxRounds,
  };

  try {
    const result = await runDebate(context);
    return NextResponse.json(result);
  } catch (e) {
    return safeErrorResponse(e, "Debate failed");
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}
