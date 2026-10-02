// GET /api/kb/report — Knowledge Base overview report (stats + recent entities +
// recent relationships + recent ingested investigations + top entities).

import { NextResponse } from "next/server";
import { getKnowledgeBaseReport } from "@/lib/osint/knowledge-base";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // KB report aggregates multiple queries

export async function GET() {
  try {
    const report = await getKnowledgeBaseReport();
    return NextResponse.json(report);
  } catch (e) {
    return safeErrorResponse(e, "Report failed");
  }
}
