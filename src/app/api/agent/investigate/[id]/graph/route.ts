// GET /api/agent/investigate/[id]/graph — agent investigation sub-route.

import { NextResponse } from "next/server";
import { getAgentState, buildKnowledgeGraph } from "@/lib/osint/agent";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const state = await getAgentState(id);

  if (!state) {
    return notFoundResponse("investigation");
  }

  const graph = buildKnowledgeGraph(state, id);

  return NextResponse.json({
    investigation_id: id,
    graph,
  });
});
