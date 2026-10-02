// GET /api/monitor/[id] — poll monitoring session status (snapshots + alerts).
// POST /api/monitor/[id] — trigger a manual re-scan.

import { NextResponse } from "next/server";
import { getMonitorState, runMonitorScan } from "@/lib/osint/monitoring-engine";
import { detectInput } from "@/lib/osint/detector";
import { apiGet, apiPost, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const state = await getMonitorState(id);
  if (!state) return notFoundResponse("monitor session");

  const alertsBySeverity: Record<string, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  const alertsByCategory: Record<string, number> = {};
  for (const a of state.alerts) {
    alertsBySeverity[a.severity] = (alertsBySeverity[a.severity] || 0) + 1;
    alertsByCategory[a.category] = (alertsByCategory[a.category] || 0) + 1;
  }

  const elapsedSeconds = state.lastScanAt
    ? Math.round((new Date(state.lastScanAt).getTime() - new Date(state.startedAt).getTime()) / 1000)
    : Math.round((Date.now() - new Date(state.startedAt).getTime()) / 1000);

  return NextResponse.json({
    monitor_id: id,
    status: state.status,
    target: state.target,
    config: state.config,
    snapshots: state.snapshots,
    alerts: state.alerts,
    last_scan_at: state.lastScanAt,
    started_at: state.startedAt,
    error: state.error,
    stats: {
      total_snapshots: state.snapshots.length,
      total_alerts: state.alerts.length,
      alerts_by_severity: alertsBySeverity,
      alerts_by_category: alertsByCategory,
      elapsed_seconds: elapsedSeconds,
    },
  });
});

export const POST = apiPost(async (_req, { params }) => {
  const { id } = await params;
  const state = await getMonitorState(id);
  if (!state) return notFoundResponse("monitor session");

  // Trigger a new scan
  const detection = detectInput(state.target, state.inputType as never);
  runMonitorScan(id, detection).catch((err) => console.error(`[monitor-api] manual scan error for ${id}`, err));

  return NextResponse.json({ monitor_id: id, status: "scan_triggered", target: state.target });
});
