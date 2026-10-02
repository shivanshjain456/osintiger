// GET /api/kb/relationships — list KB relationships with optional search.
// Query params: ?q=<search relationType/label, case-insensitive contains> &limit=<n>
// Returns: { relationships: [...] } with fromName/toName joined from KBEntity.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1),
      500
    );

    // Build where clause — case-insensitive contains on relationType OR label.
    // Prisma mode "insensitive" works on Postgres; falls back gracefully if not supported.
    const where = q
      ? {
          OR: [
            { relationType: { contains: q, mode: "insensitive" as const } },
            { label: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const relationships = await db.kBRelationship.findMany({
      where,
      select: {
        id: true,
        fromEntityId: true,
        toEntityId: true,
        relationType: true,
        label: true,
        confidence: true,
        sourceLabel: true,
        observationCount: true,
        lastSeenAt: true,
      },
      orderBy: { lastSeenAt: "desc" },
      take: limit,
    });

    // Single fetch for both from/to entity primaryNames (deduped).
    const entityIds = new Set<string>();
    for (const r of relationships) {
      if (r.fromEntityId) entityIds.add(r.fromEntityId);
      if (r.toEntityId) entityIds.add(r.toEntityId);
    }

    const entities = entityIds.size
      ? await db.kBEntity.findMany({
          where: { id: { in: Array.from(entityIds) } },
          select: { id: true, primaryName: true },
        })
      : [];

    const nameById = new Map<string, string>();
    for (const e of entities) nameById.set(e.id, e.primaryName);

    return NextResponse.json({
      relationships: relationships.map((r) => ({
        ...r,
        fromName: nameById.get(r.fromEntityId) ?? null,
        toName: nameById.get(r.toEntityId) ?? null,
      })),
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to load relationships");
  }
}
