// GET /api/provenance/trace/[evidenceId] — Get the full provenance chain for a specific evidence item.

import { NextResponse } from "next/server";
import { getProvenanceChain } from "@/lib/osint/provenance";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ evidenceId: string }> }
) {
  const { evidenceId } = await params;
  try {
    const chain = await getProvenanceChain(evidenceId);
    if (!chain) {
      return NextResponse.json(
        { error: "No provenance events found for this evidence ID" },
        { status: 404 }
      );
    }
    return NextResponse.json(chain);
  } catch (e) {
    return safeErrorResponse(e, "Trace failed");
  }
}
