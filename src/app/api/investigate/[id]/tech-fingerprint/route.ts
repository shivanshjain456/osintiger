// GET /api/investigate/[id]/tech-fingerprint — returns the technology fingerprint report for a standard investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { fingerprintTechnologies } from "@/lib/osint/tech-fingerprint";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");
  return NextResponse.json({ investigation_id: id, report: fingerprintTechnologies(rec.source_results) });
});
