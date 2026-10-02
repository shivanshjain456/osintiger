// GET /api/investigate/[id]/hierarchy — returns the org hierarchy report for a standard investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { extractOrgHierarchy } from "@/lib/osint/org-hierarchy";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");
  return NextResponse.json({ investigation_id: id, report: extractOrgHierarchy(rec.source_results, rec.target) });
});
