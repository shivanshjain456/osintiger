// GET /api/investigate/[id]/graph — returns the knowledge graph for a standard (fixed-pipeline) investigation.
// Builds the graph on-demand from the investigation's source results.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { buildKnowledgeGraphFromInvestigation } from "@/lib/osint/agent";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");

  const graph = buildKnowledgeGraphFromInvestigation(
    rec.source_results,
    rec.target,
    rec.input_type,
    id
  );

  return NextResponse.json({
    investigation_id: id,
    graph,
  });
});
