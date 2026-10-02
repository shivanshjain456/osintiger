// GET /api/agent/investigate/[id]/kb — auto-ingest this agent investigation
// into the Knowledge Base (idempotent) and return the ingest result.

import { NextResponse } from "next/server";
import { ingestInvestigation } from "@/lib/osint/knowledge-base";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const result = await ingestInvestigation(id, "agent");
    return NextResponse.json(result);
  } catch (e) {
    return safeErrorResponse(e, "Ingest failed");
  }
}
