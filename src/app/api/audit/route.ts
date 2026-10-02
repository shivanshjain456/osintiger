// GET /api/audit — list audit log events with optional filtering.
// Query params: ?category= &actor= &action= &severity= &limit= (default 100, max 500)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const category = (params.get("category") || "").trim();
    const actor = (params.get("actor") || "").trim();
    const action = (params.get("action") || "").trim();
    const severity = (params.get("severity") || "").trim();
    const limit = Math.min(
      Math.max(parseInt(params.get("limit") || "100", 10) || 100, 1),
      500
    );

    // Build where clause — case-insensitive contains for action/detail,
    // exact match for category/severity/actorType/actorId
    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (action) {
      where.OR = [
        { action: { contains: action } },
        { detail: { contains: action } },
      ];
    }
    if (actor) {
      where.AND = [
        ...(where.AND ? (where.AND as unknown[]) : []),
        {
          OR: [
            { actorId: { contains: actor } },
            { actorType: { contains: actor } },
          ],
        },
      ];
    }

    const events = await db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      select: {
        id: true,
        timestamp: true,
        actorType: true,
        actorId: true,
        action: true,
        category: true,
        resourceType: true,
        resourceId: true,
        targetType: true,
        detail: true,
        severity: true,
        outcome: true,
        durationMs: true,
      },
    });

    const total = await db.auditLog.count({ where });

    return NextResponse.json({ events, total });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch audit log");
  }
}
