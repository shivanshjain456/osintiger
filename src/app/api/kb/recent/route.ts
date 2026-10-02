// GET /api/kb/recent — recently ingested investigations into the Knowledge Base.

import { NextResponse } from "next/server";
import { getRecentIngestedInvestigations } from "@/lib/osint/knowledge-base";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 100);
  try {
    const recent = await getRecentIngestedInvestigations(limit);
    return NextResponse.json({ recent });
  } catch (e) {
    return safeErrorResponse(e, "Fetch failed");
  }
}
