// GET /api/provenance — list provenance events across all investigations.
// Query params: ?investigationId=<id> &eventType=<type> &limit=<n>
// Returns: { events: [...], total: number } ordered by eventTime desc.
//
// NOTE: This is the LIST endpoint. The per-investigation detail route at
// /api/provenance/[investigationId]/route.ts is preserved unchanged.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const investigationId = (url.searchParams.get("investigationId") || "").trim();
    const eventType = (url.searchParams.get("eventType") || "").trim();
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1),
      500
    );

    // Build where clause from optional filters.
    const where: Record<string, unknown> = {};
    if (investigationId) where.investigationId = investigationId;
    if (eventType) where.eventType = eventType;

    // Run list + count in parallel for efficiency.
    const [events, total] = await Promise.all([
      db.provenanceEvent.findMany({
        where,
        select: {
          id: true,
          evidenceId: true,
          eventType: true,
          eventTime: true,
          collectorName: true,
          toolName: true,
          sourceUrl: true,
          queryString: true,
          confidence: true,
          latencyMs: true,
          collectedAt: true,
        },
        orderBy: { eventTime: "desc" },
        take: limit,
      }),
      db.provenanceEvent.count({ where }),
    ]);

    return NextResponse.json({ events, total });
  } catch (e) {
    return safeErrorResponse(e, "Failed to load provenance events");
  }
}
