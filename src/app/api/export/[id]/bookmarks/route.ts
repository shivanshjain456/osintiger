// GET /api/export/[id]/bookmarks?format=csv|json — export only bookmarked findings for an investigation.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: string | number | undefined | null): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }
  if (!rec.report) {
    return NextResponse.json({ error: "report not ready" }, { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";
  const bookmarkedIndices = rec.bookmarked_findings || [];
  const allFindings = rec.report.key_findings;
  const bookmarkedFindings = bookmarkedIndices
    .filter((i) => i >= 0 && i < allFindings.length)
    .map((i) => ({ index: i, ...allFindings[i] }));

  if (format === "csv") {
    const header = "index,claim,source,source_url,confidence\n";
    const lines = bookmarkedFindings.map((f) =>
      [
        csvEscape(f.index),
        csvEscape(f.claim.replace(/\[SOURCE:[^\]]*\]/gi, "").trim()),
        csvEscape(f.source),
        csvEscape(f.source_url),
        csvEscape(f.confidence),
      ].join(",")
    );
    const csv = header + lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="osintiger-bookmarks-${rec.target.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.csv"`,
      },
    });
  }

  return new NextResponse(
    JSON.stringify(
      {
        investigation: {
          id: rec.id,
          target: rec.target,
          input_type: rec.input_type,
          created_at: rec.created_at,
        },
        bookmarked_count: bookmarkedFindings.length,
        findings: bookmarkedFindings,
      },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="osintiger-bookmarks-${rec.target.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.json"`,
      },
    }
  );
}
