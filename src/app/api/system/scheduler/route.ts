// GET /api/system/scheduler — informational list of scheduled cron jobs.

import { NextResponse } from "next/server";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEDULED_JOBS = [
  {
    id: "webdev-review",
    name: "Web Dev Review",
    schedule: "every 15 minutes",
    status: "active" as const,
    description: "Reviews web infrastructure for monitored targets.",
  },
  {
    id: "kb-maintenance",
    name: "KB Maintenance",
    schedule: "daily",
    status: "active" as const,
    description: "Reconciles KB entities, merges duplicates, prunes stale entries.",
  },
  {
    id: "cache-cleanup",
    name: "Cache Cleanup",
    schedule: "hourly",
    status: "active" as const,
    description: "Expires stale cache entries and compacts storage.",
  },
];

export async function GET() {
  try {
    return NextResponse.json({
      jobs: SCHEDULED_JOBS,
      scheduler: "in-process",
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch scheduler info");
  }
}
