// GET /api/kb/stats — Knowledge Base statistics (entity/relationship/evidence
// counts, distribution by type, top sources, recent activity).

import { NextResponse } from "next/server";
import { getKnowledgeBaseStats } from "@/lib/osint/knowledge-base";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getKnowledgeBaseStats();
    return NextResponse.json(stats);
  } catch (e) {
    return safeErrorResponse(e, "Stats failed");
  }
}
