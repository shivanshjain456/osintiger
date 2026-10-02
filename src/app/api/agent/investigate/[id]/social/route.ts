// GET /api/agent/investigate/[id]/social — Social Media Intelligence for agent investigations.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
  const row = await db.autonomousInvestigation.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }

  try {
    const report = await runSocialIntelligence(row.target, row.inputType, id);
    return NextResponse.json({ investigation_id: id, report });
  } catch (e) {
    return safeErrorResponse(e, "Social intelligence failed");
  }
}
