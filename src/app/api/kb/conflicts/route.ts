// GET /api/kb/conflicts — list KB conflicts with optional status filter.
// Query params: ?status=<open|resolved_a|resolved_b|unresolved> &limit=<n>
// Returns: { conflicts: [...] } with entityName joined from KBEntity.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set([
  "open",
  "resolved_a",
  "resolved_b",
  "unresolved",
]);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawStatus = (url.searchParams.get("status") || "").trim();
    const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "";
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1),
      500
    );

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const conflicts = await db.kBConflict.findMany({
      where,
      select: {
        id: true,
        entityId: true,
        field: true,
        valueA: true,
        valueB: true,
        sourceKeyA: true,
        sourceKeyB: true,
        status: true,
        resolution: true,
        detectedAt: true,
      },
      orderBy: { detectedAt: "desc" },
      take: limit,
    });

    // Join entity primaryNames in a single query.
    const entityIds = Array.from(
      new Set(conflicts.map((c) => c.entityId).filter(Boolean))
    );
    const entities = entityIds.length
      ? await db.kBEntity.findMany({
          where: { id: { in: entityIds } },
          select: { id: true, primaryName: true },
        })
      : [];

    const nameById = new Map<string, string>();
    for (const e of entities) nameById.set(e.id, e.primaryName);

    return NextResponse.json({
      conflicts: conflicts.map((c) => ({
        ...c,
        entityName: nameById.get(c.entityId) ?? null,
      })),
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to load conflicts");
  }
}
