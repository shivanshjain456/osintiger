// GET /api/analytics/sources — aggregate source reliability metrics across all investigations.
// Returns per-source: total findings, success rate, avg confidence, times consulted.
//
// Performance: uses a targeted Prisma select to fetch only the sourceResults
// column (not stepsJson or reportJson), and parses only what's needed.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJsonParse } from "@/lib/osint/safe-json";
import type { SourceResult } from "@/lib/osint/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 24 * 60 * 60 * 1000;

interface SourceStat {
  source: string;
  source_label: string;
  times_consulted: number;
  success_count: number;
  error_count: number;
  total_findings: number;
  avg_findings: number;
  avg_confidence: number;
}

export async function GET() {
  const now = Date.now();
  // Only fetch the sourceResults column — skip stepsJson and reportJson
  // which can be 50-200KB each and aren't needed for source analytics.
  const rows = await db.investigation.findMany({
    where: { createdAt: { gte: new Date(now - TTL_MS) } },
    select: { sourceResults: true },
    take: 200,
    orderBy: { createdAt: "desc" },
  });

  const stats = new Map<string, SourceStat>();

  for (const row of rows) {
    const sourceResults = safeJsonParse<SourceResult[]>(row.sourceResults || "[]", []);
    if (sourceResults.length === 0) continue;
    for (const sr of sourceResults) {
      const key = sr.source;
      const existing = stats.get(key) || {
        source: sr.source,
        source_label: sr.source_label,
        times_consulted: 0,
        success_count: 0,
        error_count: 0,
        total_findings: 0,
        avg_findings: 0,
        avg_confidence: 0,
      };
      existing.times_consulted++;
      if (sr.status === "success") existing.success_count++;
      if (sr.status === "error" || sr.status === "timeout") existing.error_count++;
      existing.total_findings += sr.findings.length;
      if (sr.findings.length > 0) {
        const confSum = sr.findings.reduce((s, f) => s + (f.confidence || 0), 0);
        existing.avg_confidence += confSum / sr.findings.length;
      }
      stats.set(key, existing);
    }
  }

  // Finalize averages
  const result: SourceStat[] = [...stats.values()].map((s) => ({
    ...s,
    avg_findings: s.times_consulted > 0 ? parseFloat((s.total_findings / s.times_consulted).toFixed(1)) : 0,
    avg_confidence: s.times_consulted > 0 ? parseFloat((s.avg_confidence / s.times_consulted).toFixed(2)) : 0,
  }));

  result.sort((a, b) => b.total_findings - a.total_findings);

  return NextResponse.json({
    sources: result,
    total_investigations: rows.length,
  });
}
