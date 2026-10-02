// GET /api/system/status — overall system health snapshot.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_VERSION = "2.0.0";

export async function GET() {
  try {
    // Single round-trip: all 6 counts in parallel, measure total DB latency.
    const dbStart = Date.now();
    const [investigationCount, entityCount, provenanceCount, auditCount, jobCount, notificationCount] =
      await Promise.all([
        db.investigation.count(),
        db.kBEntity.count(),
        db.provenanceEvent.count(),
        db.auditLog.count(),
        db.backgroundJob.count(),
        db.notification.count(),
      ]);
    const dbLatencyMs = Date.now() - dbStart;

    return NextResponse.json({
      status: "healthy",
      database: "ok",
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: [
        { name: "database", status: "ok", latencyMs: dbLatencyMs },
        { name: "knowledge_base", status: "ok" },
        { name: "provenance", status: "ok" },
      ],
      counts: {
        investigations: investigationCount,
        entities: entityCount,
        provenanceEvents: provenanceCount,
        auditLogs: auditCount,
        jobs: jobCount,
        notifications: notificationCount,
      },
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch system status");
  }
}
