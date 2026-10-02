// POST /api/monitor — start a live monitoring session.
// Takes an initial snapshot and sets up continuous change detection.

import { NextResponse } from "next/server";
import { initMonitor, runMonitorScan, DEFAULT_MONITOR_CONFIG } from "@/lib/osint/monitoring-engine";
import type { MonitorConfig } from "@/lib/osint/monitoring-engine";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import {
  resolveEntitlement,
  checkModeEntitlement,
} from "@/lib/saas/entitlements";
import { recordAudit } from "@/lib/osint/audit";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Monitor sessions have a 24h TTL in the store; we use the same window when
// counting "active" monitors per user via the audit log (MonitorSession itself
// has no userId column, so the audit log is the per-user source of truth).
const MONITOR_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  let body: { target?: string; input_type?: string; config?: Partial<MonitorConfig> } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const target = (body.target || "").toString().trim();
  if (!target) return NextResponse.json({ error: "target is required" }, { status: 400 });
  if (target.length > 256) return NextResponse.json({ error: "target too long" }, { status: 400 });

  try {
  // ─── Entitlement gate ────────────────────────────────────────────────────
  // Monitor mode is Investigator+; also enforce a per-user active-monitor cap.
  let ent: Awaited<ReturnType<typeof resolveEntitlement>> | null = null;
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
    ent = await resolveEntitlement(user?.id || null);

    const modeCheck = checkModeEntitlement(ent, "monitor");
    if (!modeCheck.allowed) {
      return NextResponse.json(
        {
          error: modeCheck.reason || "Monitor mode not available on your plan",
          code: "plan_required",
          upgradeTier: modeCheck.upgradeTier,
        },
        { status: 402 }
      );
    }

    // Per-user active monitor count. Monitors have a 24h TTL — any audit log
    // entry for "monitor.start" inside that window counts as active.
    if (user?.id) {
      const since = new Date(Date.now() - MONITOR_TTL_MS);
      const activeCount = await db.auditLog.count({
        where: {
          actorId: user.id,
          action: "monitor.start",
          timestamp: { gte: since },
        },
      });
      const cap = ent.planLimits.monitoringTargets;
      if (cap !== -1 && activeCount >= cap) {
        return NextResponse.json(
          {
            error: `You've reached your monitoring target limit (${cap}). Stop an existing monitor or upgrade to monitor more targets.`,
            code: "limit_exceeded",
            upgradeTier: ent.tier === "investigator" ? "professional" : "team",
            usage: { count: activeCount, limit: cap },
          },
          { status: 402 }
        );
      }
    }
  } catch (entErr) {
    console.error("[monitor] entitlement check failed", entErr);
  }

  const config: Partial<MonitorConfig> = {};
  if (body.config) {
    if (Array.isArray(body.config.categories)) config.categories = body.config.categories;
    if (typeof body.config.intervalSeconds === "number" && body.config.intervalSeconds >= 60) config.intervalSeconds = body.config.intervalSeconds;
    if (typeof body.config.maxSnapshots === "number" && body.config.maxSnapshots >= 1 && body.config.maxSnapshots <= 1000) config.maxSnapshots = body.config.maxSnapshots;
  }

  const { id, state, detection } = initMonitor({ target, input_type: body.input_type, config });
  if (!detection.valid) return NextResponse.json({ error: detection.reason || "Invalid target" }, { status: 400 });

  // Fire initial scan in background
  runMonitorScan(id, detection).catch((err) => console.error(`[monitor-api] scan error for ${id}`, err));

  // ─── Audit (best-effort) ─────────────────────────────────────────────────
  // Records the monitor start so subsequent requests can count active monitors
  // per user (MonitorSession has no userId column). Swallowed on failure.
  if (user?.id) {
    recordAudit({
      action: "monitor.start",
      category: "investigation",
      actorType: "user",
      actorId: user.id,
      resourceType: "monitor",
      resourceId: id,
      targetType: target,
      detail: `Started live monitor for "${target}"`,
      metadata: { planTier: ent?.tier },
      severity: "info",
      outcome: "success",
    }).catch(() => { /* audit never throws */ });
  }

  return NextResponse.json({ monitor_id: id, status: state.status, target: state.target, config: state.config });
  } catch (e) {
    return safeErrorResponse(e, "Failed to start monitor session");
  }
}
