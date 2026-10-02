// GET /api/investigate/[id]/threat — returns the AI threat assessment for a standard investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { assessThreats } from "@/lib/osint/threat-assessment";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");
  return NextResponse.json({ investigation_id: id, assessment: assessThreats(rec.source_results, rec.target) });
});
