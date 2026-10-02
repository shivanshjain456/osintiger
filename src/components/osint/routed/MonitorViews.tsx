"use client";

// Monitor sub-views: snapshot history & alerts feed for a live monitoring session.

import { useEffect, useState } from "react";
import { Camera, BellRing, Loader2, ChevronRight } from "lucide-react";
import { PageHeader, SectionHeader, EmptyState, Tag } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate } from "@/lib/router/useRouter";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      {children}
    </div>
  );
}

interface Snapshot { id: string; takenAt: string; changeCount: number; summary: string }
export function MonitorSnapshotsView({ id }: { id: string }) {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/monitor/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const state = d.state || {};
        const snaps = state.snapshots || [];
        setSnapshots(snaps.map((s: any, i: number) => ({
          id: s.id || `snap-${i}`,
          takenAt: s.takenAt || s.timestamp || new Date().toISOString(),
          changeCount: (s.changes || s.alerts || []).length,
          summary: s.summary || `${(s.changes || s.alerts || []).length} changes detected`,
        })));
      })
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Shell>
      <PageHeader icon={Camera} title="Monitor Snapshots" subtitle={`// ${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"}`} accent="red" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : snapshots.length === 0 ? (
        <EmptyState icon={Camera} title="No snapshots yet" description="Snapshots are captured on each monitor scan." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {snapshots.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Camera className="h-4 w-4 text-[var(--hack-red)] shrink-0" />
                <div className="min-w-0">
                  <span className="font-mono text-xs text-[var(--hack-green)]">{new Date(s.takenAt).toLocaleString()}</span>
                  <p className="text-xs text-[var(--hack-gray)] font-mono truncate">{s.summary}</p>
                </div>
              </div>
              <Tag color={s.changeCount > 0 ? "amber" : "green"}>{s.changeCount} changes</Tag>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

interface Alert { id: string; timestamp: string; severity: string; category: string; message: string }
export function MonitorAlertsView({ id }: { id: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/monitor/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const state = d.state || {};
        const allAlerts: any[] = [];
        (state.snapshots || []).forEach((s: any) => {
          (s.changes || s.alerts || []).forEach((a: any) => allAlerts.push({
            id: a.id || `alert-${allAlerts.length}`,
            timestamp: a.timestamp || s.takenAt || new Date().toISOString(),
            severity: a.severity || "info",
            category: a.category || a.source || "general",
            message: a.message || a.description || a.summary || "Change detected",
          }));
        });
        allAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setAlerts(allAlerts);
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Shell>
      <PageHeader icon={BellRing} title="Monitor Alerts" subtitle={`// ${alerts.length} alert${alerts.length === 1 ? "" : "s"}`} accent="red" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : alerts.length === 0 ? (
        <EmptyState icon={BellRing} title="No alerts" description="Alerts appear when the monitor detects changes exceeding threshold." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[600px] overflow-y-auto custom-scroll">
          {alerts.map((a) => {
            const sev = a.severity === "critical" ? "red" : a.severity === "warning" ? "amber" : "cyan";
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Tag color={sev as "red" | "amber" | "cyan"}>{a.severity}</Tag>
                  <Tag color="gray">{a.category}</Tag>
                  <span className="text-[9px] font-mono text-[var(--hack-gray)]/60 ml-auto">{new Date(a.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-xs text-[var(--hack-gray)] font-mono">{a.message}</p>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
