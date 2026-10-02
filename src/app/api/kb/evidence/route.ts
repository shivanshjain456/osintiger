// GET /api/kb/evidence — list KB evidence artifacts with optional filters.
// Query params: ?entityId=<id> &source=<sourceKey contains> &limit=<n>
// Returns: { evidence: [...] } with rawText/normalizedText truncated to 300 chars.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT = 300;

function truncate(text: string | null | undefined): string {
  if (!text) return "";
  return text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) : text;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const entityId = (url.searchParams.get("entityId") || "").trim();
    const source = (url.searchParams.get("source") || "").trim();
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1),
      500
    );

    // Build where clause from optional filters.
    const where: Record<string, unknown> = {};
    if (entityId) where.entityId = entityId;
    if (source) where.sourceKey = { contains: source, mode: "insensitive" };

    const evidence = await db.kBEvidence.findMany({
      where,
      select: {
        id: true,
        entityId: true,
        sourceLabel: true,
        sourceKey: true,
        sourceUrl: true,
        rawText: true,
        normalizedText: true,
        confidence: true,
        observedAt: true,
        investigationId: true,
      },
      orderBy: { observedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      evidence: evidence.map((e) => ({
        id: e.id,
        entityId: e.entityId,
        sourceLabel: e.sourceLabel,
        sourceKey: e.sourceKey,
        sourceUrl: e.sourceUrl,
        rawText: truncate(e.rawText),
        normalizedText: truncate(e.normalizedText),
        confidence: e.confidence,
        observedAt: e.observedAt,
        investigationId: e.investigationId,
      })),
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to load evidence");
  }
}
