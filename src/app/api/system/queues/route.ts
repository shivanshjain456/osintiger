// GET /api/system/queues — list recent background jobs + status stats.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jobs = await db.backgroundJob.findMany({
      orderBy: { queuedAt: "desc" },
      take: 100,
    });

    // Group by status — single round trip per status. Empty DB is fine.
    const [queued, running, completed, failed, cancelled] = await Promise.all([
      db.backgroundJob.count({ where: { status: "queued" } }),
      db.backgroundJob.count({ where: { status: "running" } }),
      db.backgroundJob.count({ where: { status: "completed" } }),
      db.backgroundJob.count({ where: { status: "failed" } }),
      db.backgroundJob.count({ where: { status: "cancelled" } }),
    ]);

    return NextResponse.json({
      jobs,
      stats: { queued, running, completed, failed, cancelled },
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch job queue");
  }
}
