// GET /api/export/all — bulk export all investigations as a single JSON archive.

import { NextResponse } from "next/server";
import { listRecent } from "@/lib/osint/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const recs = await listRecent(200);

  const archive = {
    exported_at: new Date().toISOString(),
    total_investigations: recs.length,
    investigations: recs.map((r) => ({
      id: r.id,
      target: r.target,
      input_type: r.input_type,
      language: r.language,
      script: r.script,
      status: r.status,
      created_at: r.created_at,
      completed_at: r.completed_at,
      confidence_score: r.report?.confidence_score ?? null,
      attribution_valid: r.report?.attribution_valid ?? null,
      starred: r.starred ?? false,
      tags: r.tags ?? [],
      notes: r.notes ?? "",
      bookmarked_findings: r.bookmarked_findings ?? [],
      finding_annotations: r.finding_annotations ?? {},
      report: r.report,
      source_results: r.source_results,
    })),
  };

  const json = JSON.stringify(archive, null, 2);

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="osintiger-bulk-export-${Date.now()}.json"`,
    },
  });
}
