// GET /api/investigate/[id]/dashboard — Visual Intelligence Dashboard data for a standard investigation.
// Returns all entities, relationships, timeline, geopoints, coverage, confidence, progress, clusters, sankey, infrastructure.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { buildDashboardData } from "@/lib/osint/dashboard";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }

  try {
    const data = await buildDashboardData(
      id,
      rec.report,
      rec.source_results,
      rec.target,
      rec.input_type,
      rec.current_step,
      rec.total_steps,
      rec.steps
    );
    return NextResponse.json({ investigation_id: id, dashboard: data });
  } catch (e) {
    return safeErrorResponse(e, "Dashboard build failed");
  }
}
