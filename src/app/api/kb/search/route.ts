// GET /api/kb/search?q=...&limit=... — search the Knowledge Base across entities,
// relationships, and evidence artifacts.

import { NextResponse } from "next/server";
import { searchKnowledgeBase } from "@/lib/osint/knowledge-base";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "30", 10), 100);

  try {
    const result = await searchKnowledgeBase(q, limit);
    return NextResponse.json(result);
  } catch (e) {
    return safeErrorResponse(e, "Search failed");
  }
}
