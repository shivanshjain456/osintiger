// POST /api/sanctions/batch — bulk OFAC SDN screening for multiple names.
// Accepts: { "names": ["name1", "name2", ...] } or plain text (one name per line).
// Returns per-name screening results.

import { NextResponse } from "next/server";
import { screenSanctions } from "@/lib/osint/ofac";
import type { SanctionsResult } from "@/lib/osint/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface BatchResult {
  query: string;
  match_status: SanctionsResult["match_status"];
  top_match: string | null;
  top_similarity: number;
  matches_count: number;
  result: SanctionsResult;
}

export async function POST(req: Request) {
  let names: string[] = [];

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      if (Array.isArray(body.names)) {
        names = body.names.filter((n: unknown) => typeof n === "string");
      } else if (typeof body.text === "string") {
        names = body.text
          .split(/[\n,]/)
          .map((n: string) => n.trim())
          .filter(Boolean);
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  } else {
    // Plain text body
    try {
      const text = await req.text();
      names = text
        .split(/[\n,]/)
        .map((n) => n.trim())
        .filter(Boolean);
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
  }

  if (names.length === 0) {
    return NextResponse.json({ error: "No names provided" }, { status: 400 });
  }
  if (names.length > 200) {
    return NextResponse.json(
      { error: "Too many names (max 200 per batch)" },
      { status: 413 }
    );
  }

  // Screen each name
  const results: BatchResult[] = names.map((name) => {
    const result = screenSanctions(name, 0.6);
    return {
      query: name,
      match_status: result.match_status,
      top_match: result.matches[0]?.sdn_name || null,
      top_similarity: result.matches[0]?.similarity || 0,
      matches_count: result.matches.length,
      result,
    };
  });

  const summary = {
    total: results.length,
    no_match: results.filter((r) => r.match_status === "no_match").length,
    possible_match: results.filter((r) => r.match_status === "possible_match").length,
    likely_match: results.filter((r) => r.match_status === "likely_match").length,
  };

  return NextResponse.json({
    results,
    summary,
    list_size: results[0]?.result.list_size || 0,
    checked_at: new Date().toISOString(),
  });
}
