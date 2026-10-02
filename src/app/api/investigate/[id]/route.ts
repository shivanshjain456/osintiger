// GET /api/investigate/[id] — poll investigation status & results.
// DELETE /api/investigate/[id] — delete an investigation from DB + cache.

import { NextResponse } from "next/server";
import { getRecord, deleteRecord } from "@/lib/osint/store";
import { apiGet, apiDelete, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");
  const progress = {
    current_step: rec.current_step,
    total_steps: rec.total_steps,
    step_name: rec.steps[rec.current_step - 1]?.label || "Queued",
  };
  return NextResponse.json({
    investigation_id: rec.id,
    status: rec.status,
    progress,
    steps: rec.steps,
    source_results: rec.source_results,
    report: rec.report,
    error: rec.error,
    target: rec.target,
    input_type: rec.input_type,
    language: rec.language,
    created_at: rec.created_at,
    completed_at: rec.completed_at,
  });
});

export const DELETE = apiDelete(async (_req, { params }) => {
  const { id } = await params;
  const ok = await deleteRecord(id);
  if (!ok) return notFoundResponse("investigation");
  return NextResponse.json({ success: true, id });
});
