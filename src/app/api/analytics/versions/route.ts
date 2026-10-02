// GET /api/analytics/versions?target=<name> — version history for a target.
// Groups all investigations with the same target, showing confidence + timestamp progression.
//
// Performance: uses listRecentMetadata (lightweight, skips stepsJson/sourceResults)
// instead of listRecent (which fully deserializes every record including the
// 50-200KB reportJson).

import { NextResponse } from "next/server";
import { listRecentMetadata } from "@/lib/osint/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = (url.searchParams.get("target") || "").trim();

  const all = await listRecentMetadata(200);

  // Group by target (case-insensitive)
  const groups = new Map<string, typeof all>();
  for (const rec of all) {
    const key = rec.target.toLowerCase();
    const arr = groups.get(key) || [];
    arr.push(rec);
    groups.set(key, arr);
  }

  // If a specific target is requested, return only that group
  if (target) {
    const key = target.toLowerCase();
    const versions = (groups.get(key) || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return NextResponse.json({
      target,
      versions: versions.map((v, i) => ({
        version: i + 1,
        id: v.id,
        target: v.target,
        created_at: v.created_at,
        completed_at: v.completed_at,
        status: v.status,
        confidence: v.confidence,
        key_findings_count: v.key_findings_count,
        sources_count: v.sources_count,
        input_type: v.input_type,
        starred: v.starred,
      })),
      total: versions.length,
    });
  }

  // Otherwise return all targets that have multiple versions
  const multiVersion: {
    target: string;
    input_type: string;
    count: number;
    latest_confidence: number | null;
    latest_date: string;
    confidence_trend: number[];
  }[] = [];

  for (const [, recs] of groups) {
    if (recs.length < 2) continue;
    const sorted = recs.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    multiVersion.push({
      target: sorted[sorted.length - 1].target,
      input_type: sorted[0].input_type,
      count: sorted.length,
      latest_confidence: sorted[sorted.length - 1].confidence,
      latest_date: sorted[sorted.length - 1].created_at,
      confidence_trend: sorted.map((r) => r.confidence ?? 0),
    });
  }

  multiVersion.sort((a, b) => b.count - a.count);

  return NextResponse.json({
    multi_version_targets: multiVersion,
    total_targets: groups.size,
    total_multi: multiVersion.length,
  });
}
