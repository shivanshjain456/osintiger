// GET /api/recent — list recent investigations with optional search/filter.
// Query params: ?q=<search> &type=<input_type> &limit=<n> &starred=true &content=<full-text>
//
// Performance: uses a lightweight metadata query (listRecentMetadata) for the
// common case (no content search), which avoids fetching and parsing the
// heavy stepsJson and sourceResults columns. Falls back to the full
// listRecent path only when a content search is requested.

import { NextResponse } from "next/server";
import { listRecent, listRecentMetadata } from "@/lib/osint/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const contentQuery = (url.searchParams.get("content") || "").trim().toLowerCase();
  const type = url.searchParams.get("type") || "";
  const starredOnly = url.searchParams.get("starred") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

  // ─── Fast path: no content search → use lightweight metadata query ───────
  if (!contentQuery) {
    let recs = await listRecentMetadata(limit);

    if (q) {
      recs = recs.filter((r) => r.target.toLowerCase().includes(q));
    }
    if (type && type !== "all") {
      recs = recs.filter((r) => r.input_type === type);
    }
    if (starredOnly) {
      recs = recs.filter((r) => r.starred);
    }

    return NextResponse.json({
      investigations: recs,
      total: recs.length,
    });
  }

  // ─── Slow path: content search requires full deserialization ────────────
  let recs = await listRecent(limit);

  if (q) {
    recs = recs.filter((r) => r.target.toLowerCase().includes(q));
  }
  // Full-text search across finding content + detailed analysis + exec summary
  if (contentQuery) {
    recs = recs.filter((r) => {
      if (!r.report) return false;
      const inSummary = (r.report.executive_summary || "").toLowerCase().includes(contentQuery);
      const inAnalysis = (r.report.detailed_analysis || "").toLowerCase().includes(contentQuery);
      const inFindings = r.report.key_findings.some((f) =>
        (f.claim || "").toLowerCase().includes(contentQuery)
      );
      const inSourceFindings = r.source_results.some((sr) =>
        sr.findings.some((f) => (f.data || "").toLowerCase().includes(contentQuery))
      );
      return inSummary || inAnalysis || inFindings || inSourceFindings;
    });
  }
  if (type && type !== "all") {
    recs = recs.filter((r) => r.input_type === type);
  }
  if (starredOnly) {
    recs = recs.filter((r) => r.starred);
  }

  return NextResponse.json({
    investigations: recs.map((r) => ({
      id: r.id,
      target: r.target,
      input_type: r.input_type,
      status: r.status,
      created_at: r.created_at,
      completed_at: r.completed_at,
      confidence: r.report?.confidence_score ?? null,
      key_findings_count: r.report?.key_findings.length ?? 0,
      sources_count: r.report?.sources_consulted.length ?? 0,
      needs_review: r.report?.needs_manual_review ?? false,
      starred: r.starred ?? false,
      tags: r.tags ?? [],
      notes: r.notes ?? "",
      bookmarked_findings: r.bookmarked_findings ?? [],
      finding_annotations: r.finding_annotations ?? {},
    })),
    total: recs.length,
  });
}
