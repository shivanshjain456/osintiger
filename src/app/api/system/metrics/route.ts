// GET /api/system/metrics — recent time-series metrics, falling back to live counts.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const recent = await db.systemMetric.findMany({
      orderBy: { timestamp: "desc" },
      take: 50,
      select: {
        metric: true,
        value: true,
        unit: true,
        timestamp: true,
      },
    });

    if (recent.length > 0) {
      return NextResponse.json({ metrics: recent });
    }

    // No persisted metrics — derive live counts so the dashboard isn't empty.
    const [investigations, entities, provenance, audit] = await Promise.all([
      db.investigation.count(),
      db.kBEntity.count(),
      db.provenanceEvent.count(),
      db.auditLog.count(),
    ]);

    const now = new Date();
    const liveMetrics = [
      {
        metric: "investigations.total",
        value: investigations,
        unit: "count",
        timestamp: now,
      },
      {
        metric: "kb.entities",
        value: entities,
        unit: "count",
        timestamp: now,
      },
      {
        metric: "provenance.events",
        value: provenance,
        unit: "count",
        timestamp: now,
      },
      {
        metric: "audit.events",
        value: audit,
        unit: "count",
        timestamp: now,
      },
    ];

    return NextResponse.json({ metrics: liveMetrics });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch system metrics");
  }
}
