// GET /api/investigate/[id]/certificates — returns the certificate intelligence report for a standard investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { analyzeCertificates } from "@/lib/osint/cert-intelligence";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");
  return NextResponse.json({ investigation_id: id, report: analyzeCertificates(rec.source_results, rec.target) });
});
