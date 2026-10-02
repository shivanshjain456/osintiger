// Notification creation helpers — called by workflow completion points to
// generate user-facing notifications. These power the notifications center
// (#/notifications) and the header bell badge.

import { db } from "@/lib/db";

export type NotificationType =
  | "investigation.complete"
  | "investigation.failed"
  | "monitor.alert"
  | "kb.conflict"
  | "billing.subscription_activated"
  | "billing.subscription_canceled"
  | "billing.credits_low"
  | "billing.credits_purchased"
  | "system.maintenance";

export interface CreateNotificationInput {
  userId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  severity?: "info" | "success" | "warning" | "error";
  category?: "investigation" | "monitor" | "kb" | "billing" | "system" | "security";
  resourceType?: string;
  resourceId?: string;
  routeName?: string;
  routeParams?: Record<string, string>;
}

/**
 * Create a user-facing notification. Best-effort — never throws.
 * If userId is null/undefined, the notification is skipped (anonymous users
 * don't have notifications).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (!input.userId) return;
  try {
    await db.notification.create({
      data: {
        id: crypto.randomUUID(),
        type: input.type,
        title: input.title,
        body: input.body || "",
        severity: input.severity || "info",
        category: input.category || "general",
        resourceType: input.resourceType || "",
        resourceId: input.resourceId || "",
        routeName: input.routeName || "",
        routeParamsJson: JSON.stringify(input.routeParams || {}),
      },
    });
  } catch {
    // Notifications are non-critical — never throw into the caller.
  }
}
