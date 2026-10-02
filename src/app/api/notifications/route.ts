// GET /api/notifications — list notifications with optional filtering.
// Query params: ?filter=unread &category= &type= &limit= (default 50, max 200)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const params = url.searchParams;

    const filter = (params.get("filter") || "").trim();
    const category = (params.get("category") || "").trim();
    const type = (params.get("type") || "").trim();
    const limit = Math.min(
      Math.max(parseInt(params.get("limit") || "50", 10) || 50, 1),
      200
    );

    const where: Record<string, unknown> = {};
    if (filter === "unread") where.isRead = false;
    if (category) where.category = category;
    if (type) where.type = type;

    const [notifications, total, unread] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({ where: { isRead: false } }),
    ]);

    return NextResponse.json({ notifications, total, unread });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch notifications");
  }
}
