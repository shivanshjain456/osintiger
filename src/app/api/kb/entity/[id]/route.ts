// GET /api/kb/entity/[id] — Knowledge Base entity detail.
// Returns the entity, all evidence, relationships, conflicts, and version history.

import { NextResponse } from "next/server";
import { getEntityDetail } from "@/lib/osint/knowledge-base";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const detail = await getEntityDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "entity not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (e) {
    return safeErrorResponse(e, "Fetch failed");
  }
}
