// GET /api/kb/versions — list KB version snapshots with optional filters.
// Query params: ?entityType=<entity|relationship> &recordId=<id> &limit=<n>
// Returns: { versions: [...] } ordered by validFrom desc.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ENTITY_TYPES = new Set(["entity", "relationship"]);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const rawEntityType = (url.searchParams.get("entityType") || "").trim();
    const entityType = VALID_ENTITY_TYPES.has(rawEntityType) ? rawEntityType : "";
    const recordId = (url.searchParams.get("recordId") || "").trim();
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "200", 10) || 200, 1),
      500
    );

    const where: Record<string, unknown> = {};
    if (entityType) where.entityType = entityType;
    if (recordId) where.recordId = recordId;

    const versions = await db.kBVersion.findMany({
      where,
      select: {
        id: true,
        entityType: true,
        recordId: true,
        versionNumber: true,
        changeType: true,
        changeReason: true,
        validFrom: true,
        validTo: true,
        investigationId: true,
      },
      orderBy: { validFrom: "desc" },
      take: limit,
    });

    return NextResponse.json({ versions });
  } catch (e) {
    return safeErrorResponse(e, "Failed to load versions");
  }
}
