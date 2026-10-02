// GET /api/system/health — detailed health checks for each subsystem.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthCheck {
  name: string;
  status: "ok" | "degraded" | "down";
  latencyMs?: number;
  detail?: string;
}

export async function GET() {
  try {
    const checks: HealthCheck[] = [];

    // Database check
    const dbStart = Date.now();
    try {
      const count = await db.investigation.count();
      checks.push({
        name: "database",
        status: "ok",
        latencyMs: Date.now() - dbStart,
        detail: `${count} investigations tracked`,
      });
    } catch (e) {
      checks.push({
        name: "database",
        status: "down",
        latencyMs: Date.now() - dbStart,
        detail: e instanceof Error ? e.message : "DB error",
      });
    }

    // Knowledge base check
    const kbStart = Date.now();
    try {
      const entityCount = await db.kBEntity.count();
      checks.push({
        name: "knowledge_base",
        status: "ok",
        latencyMs: Date.now() - kbStart,
        detail: `${entityCount} entities`,
      });
    } catch (e) {
      checks.push({
        name: "knowledge_base",
        status: "down",
        detail: e instanceof Error ? e.message : "KB error",
      });
    }

    // Provenance check
    const provStart = Date.now();
    try {
      const eventCount = await db.provenanceEvent.count();
      checks.push({
        name: "provenance",
        status: "ok",
        latencyMs: Date.now() - provStart,
        detail: `${eventCount} events`,
      });
    } catch (e) {
      checks.push({
        name: "provenance",
        status: "down",
        detail: e instanceof Error ? e.message : "Provenance error",
      });
    }

    // Audit log check
    const auditStart = Date.now();
    try {
      const auditCount = await db.auditLog.count();
      checks.push({
        name: "audit_log",
        status: "ok",
        latencyMs: Date.now() - auditStart,
        detail: `${auditCount} events`,
      });
    } catch (e) {
      checks.push({
        name: "audit_log",
        status: "down",
        detail: e instanceof Error ? e.message : "Audit error",
      });
    }

    // Jobs check
    const jobsStart = Date.now();
    try {
      const jobCount = await db.backgroundJob.count();
      checks.push({
        name: "jobs",
        status: "ok",
        latencyMs: Date.now() - jobsStart,
        detail: `${jobCount} jobs tracked`,
      });
    } catch (e) {
      checks.push({
        name: "jobs",
        status: "down",
        detail: e instanceof Error ? e.message : "Jobs error",
      });
    }

    const overallStatus = checks.some((c) => c.status === "down")
      ? "down"
      : checks.some((c) => c.status === "degraded")
        ? "degraded"
        : "ok";

    return NextResponse.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch system health");
  }
}
