// GET /api/investigate/[id]/exec-profile — returns the executive intelligence profile for a standard investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { buildExecProfile } from "@/lib/osint/exec-intelligence";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");
  return NextResponse.json({ investigation_id: id, profile: buildExecProfile(rec.source_results) });
});
