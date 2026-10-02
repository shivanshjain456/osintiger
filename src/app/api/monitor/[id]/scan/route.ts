// POST /api/monitor/[id]/scan — trigger a manual re-scan and return immediately.

import { NextResponse } from "next/server";
import { getMonitorState, runMonitorScan } from "@/lib/osint/monitoring-engine";
import { detectInput } from "@/lib/osint/detector";
import { apiPost, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = apiPost(async (_req, { params }) => {
  const { id } = await params;
  const state = await getMonitorState(id);
  if (!state) return notFoundResponse("monitor session");

  const detection = detectInput(state.target, state.inputType as never);
  runMonitorScan(id, detection).catch((err) => console.error(`[monitor-api] scan error for ${id}`, err));

  return NextResponse.json({ monitor_id: id, status: "scan_triggered" });
});
