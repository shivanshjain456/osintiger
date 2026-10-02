// PATCH /api/investigate/[id]/metadata — update starred, tags, notes, bookmarked_findings, or finding_annotations.
//
// Security: Requires authentication. Only authenticated users can modify
// investigation metadata (starred, tags, notes, bookmarks, annotations).
// Anonymous users receive a 401.

import { NextResponse } from "next/server";
import { patchMetadata } from "@/lib/osint/store";
import { getSessionUser } from "@/lib/auth";
import { apiPatch, unauthorizedResponse, badRequestResponse, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = apiPatch(async (req, { params }) => {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse("Sign in to modify investigation metadata");

  const { id } = await params;
  let body: {
    starred?: boolean;
    tags?: string[];
    notes?: string;
    bookmarked_findings?: number[];
    finding_annotations?: Record<number, string>;
  } = {};
  try {
    body = await req.json();
  } catch {
    return badRequestResponse("Invalid JSON body");
  }

  const patch: {
    starred?: boolean;
    tags?: string[];
    notes?: string;
    bookmarked_findings?: number[];
    finding_annotations?: Record<number, string>;
  } = {};
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (Array.isArray(body.tags)) {
    // sanitize tags: strings only, max 20 chars, max 8 tags
    patch.tags = body.tags
      .filter((t) => typeof t === "string")
      .map((t) => t.trim().slice(0, 20))
      .filter(Boolean)
      .slice(0, 8);
  }
  if (typeof body.notes === "string") patch.notes = body.notes.slice(0, 2000);
  if (Array.isArray(body.bookmarked_findings)) {
    // sanitize: numbers only, max 100 entries
    patch.bookmarked_findings = body.bookmarked_findings
      .filter((n) => typeof n === "number" && n >= 0 && n < 1000)
      .slice(0, 100);
  }
  if (body.finding_annotations && typeof body.finding_annotations === "object") {
    // sanitize: map of number -> string, max 500 chars per annotation, max 100 entries
    const cleaned: Record<number, string> = {};
    for (const [k, v] of Object.entries(body.finding_annotations)) {
      const idx = parseInt(k, 10);
      if (!isNaN(idx) && idx >= 0 && idx < 1000 && typeof v === "string") {
        cleaned[idx] = v.slice(0, 500);
      }
      if (Object.keys(cleaned).length >= 100) break;
    }
    patch.finding_annotations = cleaned;
  }

  const rec = await patchMetadata(id, patch);
  if (!rec) return notFoundResponse("investigation");

  return NextResponse.json({
    success: true,
    id,
    starred: rec.starred,
    tags: rec.tags,
    notes: rec.notes,
    bookmarked_findings: rec.bookmarked_findings,
    finding_annotations: rec.finding_annotations,
  });
});
