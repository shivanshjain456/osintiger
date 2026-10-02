// GET /api/investigate/[id]/social — Social Media Intelligence Engine results.
// Runs in parallel with the main pipeline, returns social intelligence report.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { runSocialIntelligence } from "@/lib/osint/social-intelligence";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }

  try {
    const report = await runSocialIntelligence(rec.target, rec.input_type, id);
    return NextResponse.json({ investigation_id: id, report });
  } catch (e) {
    return safeErrorResponse(e, "Social intelligence failed");
  }
}
