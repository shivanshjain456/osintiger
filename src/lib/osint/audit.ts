// Audit Log — server-side helper to record meaningful system & user actions.
// Imported by API routes. Never throws: audit logging must never break the
// primary operation it accompanies.

import { db } from "@/lib/db";

export interface AuditInput {
  action: string; // e.g. "investigation.start"
  category?: string; // investigation | config | data | auth | system | export
  actorType?: string; // system | agent | user | api | scheduler
  actorId?: string;
  resourceType?: string; // investigation | entity | llm_config | ...
  resourceId?: string;
  targetType?: string;
  detail?: string;
  metadata?: Record<string, unknown>;
  severity?: string; // info | warning | error | critical
  outcome?: string; // success | failure | partial
  durationMs?: number;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        actorType: input.actorType || "system",
        actorId: input.actorId || "",
        action: input.action,
        category: input.category || "general",
        resourceType: input.resourceType || "",
        resourceId: input.resourceId || "",
        targetType: input.targetType || "",
        detail: (input.detail || "").slice(0, 1000),
        metadataJson: safeStringify(input.metadata || {}),
        severity: input.severity || "info",
        outcome: input.outcome || "success",
        durationMs: input.durationMs || 0,
      },
    });
  } catch {
    // Swallow — audit must never throw into the caller.
  }
}

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}
