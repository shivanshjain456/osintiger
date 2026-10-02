// POST /api/kb/ingest/[id] — ingest an investigation into the Knowledge Base.
// Idempotent: re-ingesting the same investigation is a no-op.
//
// Query params:
//   kind = standard | agent | discovery | plan | monitor (default: standard)

import { NextResponse } from "next/server";
import { ingestInvestigation } from "@/lib/osint/knowledge-base";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") || "standard") as
    | "standard" | "agent" | "discovery" | "plan" | "monitor";

  try {
    const result = await ingestInvestigation(id, kind);
    return NextResponse.json(result);
  } catch (e) {
    return safeErrorResponse(e, "Ingest failed");
  }
}

// GET — alias for POST so users can trigger ingest via simple navigation
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}
