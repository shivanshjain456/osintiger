// POST /api/notifications/read-all — mark all unread notifications as read.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/osint/audit";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await db.notification.updateMany({
      where: { isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    await recordAudit({
      action: "notifications.read_all",
      category: "system",
      resourceType: "notification",
      detail: `Marked ${result.count} notifications as read`,
      actorType: "user",
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (e) {
    return safeErrorResponse(e, "Failed to mark notifications as read");
  }
}
