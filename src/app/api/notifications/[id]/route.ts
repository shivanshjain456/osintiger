// DELETE /api/notifications/[id] — delete a notification.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/osint/audit";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.notification.delete({ where: { id } });

    await recordAudit({
      action: "notifications.delete",
      category: "system",
      resourceType: "notification",
      resourceId: id,
      detail: "Notification deleted",
      actorType: "user",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return safeErrorResponse(e, "Failed to delete notification");
  }
}
