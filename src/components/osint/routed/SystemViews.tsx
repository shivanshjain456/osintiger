"use client";

// System & operations views. These surface platform health, metrics, the
// audit log, and job queues. They pull from new API routes (/api/system/*,
// /api/audit, /api/jobs) created alongside this router.

import { useEffect, useState, useCallback } from "react";
import {
  Server,
  Activity,
  HeartPulse,
  Stethoscope,
  Clock,
  ListChecks,
  Gauge,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
  Cpu,
  HardDrive,
  Network,
} from "lucide-react";
import { PageHeader, SectionHeader, StatCard, EmptyState, Tag } from "./PageBits";
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

function useApi<T>(url: string): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    queueMicrotask(() => { setLoading(true); setError(null); });
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "Request failed"))
      .finally(() => setLoading(false));
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

// ─── System index ────────────────────────────────────────────────────────────
export function SystemView() {
  const navigate = useNavigate();
  const cards = [
    { route: "system-status" as const, icon: Activity, title: "System Status", desc: "Current health, uptime, and active operations.", accent: "green" as const },
    { route: "system-health" as const, icon: HeartPulse, title: "Health Checks", desc: "Detailed health of each subsystem & dependency.", accent: "cyan" as const },
    { route: "system-diagnostics" as const, icon: Stethoscope, title: "Diagnostics", desc: "Runtime diagnostics, env info, and troubleshooting.", accent: "amber" as const },
    { route: "system-scheduler" as const, icon: Clock, title: "Scheduler", desc: "Scheduled & recurring background tasks.", accent: "purple" as const },
    { route: "system-queues" as const, icon: ListChecks, title: "Job Queues", desc: "Queued, running, and completed background jobs.", accent: "green" as const },
    { route: "system-metrics" as const, icon: Gauge, title: "Metrics", desc: "Time-series metrics: latency, throughput, cache.", accent: "cyan" as const },
  ];
  return (
    <Shell>
      <PageHeader icon={Server} title="System Operations" subtitle="// platform health & operations" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const accent = {
            green: "hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5",
            cyan: "hover:border-[var(--hack-cyan)]/40 hover:bg-[var(--hack-cyan)]/5",
            amber: "hover:border-[var(--hack-amber)]/40 hover:bg-[var(--hack-amber)]/5",
            purple: "hover:border-[var(--hack-purple)]/40 hover:bg-[var(--hack-purple)]/5",
          }[c.accent];
          return (
            <button key={c.route} onClick={() => navigate({ name: c.route })} className={`group text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-4 transition ${accent}`}>
              <div className="flex items-center justify-between mb-2">
                <c.icon className="h-5 w-5 text-[var(--hack-green)]" />
                <ChevronRight className="h-4 w-4 text-[var(--hack-gray)] group-hover:translate-x-0.5 transition" />
              </div>
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-[var(--hack-green)]">{c.title}</h3>
              <p className="mt-1 text-xs text-[var(--hack-gray)] leading-relaxed">{c.desc}</p>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

// ─── System status ───────────────────────────────────────────────────────────
interface StatusData {
  status: string;
  database: string;
  uptime?: number;
  version?: string;
  timestamp: string;
  checks?: Array<{ name: string; status: string; latencyMs?: number; detail?: string }>;
  counts?: { investigations: number; entities: number; provenanceEvents: number; auditLogs: number; jobs: number; notifications: number };
}

export function SystemStatusView() {
  const { data, loading, error, reload } = useApi<StatusData>("/api/system/status");
  const health = data?.status === "healthy";
  return (
    <Shell>
      <PageHeader
        icon={Activity}
        title="System Status"
        subtitle={data ? `// ${data.status.toUpperCase()} · ${data.timestamp}` : "// loading…"}
        accent={health ? "green" : "red"}
        actions={<button onClick={reload} className="border border-[var(--hack-border)] p-2 text-[var(--hack-gray)] hover:text-[var(--hack-green)] hover:border-[var(--hack-green)]/40"><RefreshCw className="h-3.5 w-3.5" /></button>}
      />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : error ? (
        <EmptyState icon={XCircle} title="Failed to load status" description={error} />
      ) : data ? (
        <div className="space-y-6">
          {/* Big status banner */}
          <div className={`border p-4 flex items-center gap-3 ${health ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5" : "border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5"}`}>
            {health ? <CheckCircle2 className="h-8 w-8 text-[var(--hack-green)]" /> : <XCircle className="h-8 w-8 text-[var(--hack-red)]" />}
            <div>
              <div className={`font-mono text-lg font-bold ${health ? "text-[var(--hack-green)]" : "text-[var(--hack-red)]"}`}>{data.status.toUpperCase()}</div>
              <div className="font-mono text-[10px] text-[var(--hack-gray)]">database: {data.database} · version: {data.version || "—"}</div>
            </div>
          </div>

          {/* Counts grid */}
          {data.counts && (
            <div>
              <SectionHeader title="Data Counts" icon={Database} />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Investigations" value={data.counts.investigations} icon={Activity} />
                <StatCard label="KB Entities" value={data.counts.entities} icon={Database} accent="cyan" />
                <StatCard label="Provenance" value={data.counts.provenanceEvents} icon={Network} accent="purple" />
                <StatCard label="Audit Logs" value={data.counts.auditLogs} icon={ListChecks} accent="amber" />
                <StatCard label="Jobs" value={data.counts.jobs} icon={Clock} accent="green" />
                <StatCard label="Notifications" value={data.counts.notifications} icon={Activity} accent="cyan" />
              </div>
            </div>
          )}

          {/* Subsystem checks */}
          {data.checks && data.checks.length > 0 && (
            <div>
              <SectionHeader title="Subsystem Checks" icon={HeartPulse} count={data.checks.length} />
              <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
                {data.checks.map((c) => {
                  const ok = c.status === "ok" || c.status === "healthy";
                  return (
                    <div key={c.name} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {ok ? <CheckCircle2 className="h-4 w-4 text-[var(--hack-green)]" /> : <AlertTriangle className="h-4 w-4 text-[var(--hack-amber)]" />}
                        <span className="font-mono text-xs text-[var(--hack-gray)]">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.latencyMs != null && <span className="font-mono text-[10px] text-[var(--hack-gray)]/60">{c.latencyMs}ms</span>}
                        <Tag color={ok ? "green" : "amber"}>{c.status}</Tag>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Shell>
  );
}

// ─── Health checks ───────────────────────────────────────────────────────────
export function SystemHealthView() {
  const { data, loading, reload } = useApi<StatusData>("/api/system/health");
  return (
    <Shell>
      <PageHeader icon={HeartPulse} title="Health Checks" subtitle="// detailed subsystem health" accent="cyan"
        actions={<button onClick={reload} className="border border-[var(--hack-border)] p-2 text-[var(--hack-gray)] hover:text-[var(--hack-green)] hover:border-[var(--hack-green)]/40"><RefreshCw className="h-3.5 w-3.5" /></button>} />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : data?.checks ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.checks.map((c) => {
            const ok = c.status === "ok" || c.status === "healthy";
            return (
              <div key={c.name} className={`border p-3 ${ok ? "border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5" : "border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-semibold uppercase text-[var(--hack-green)]">{c.name}</span>
                  {ok ? <CheckCircle2 className="h-4 w-4 text-[var(--hack-green)]" /> : <AlertTriangle className="h-4 w-4 text-[var(--hack-amber)]" />}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--hack-gray)]">
                  <Tag color={ok ? "green" : "amber"}>{c.status}</Tag>
                  {c.latencyMs != null && <span>{c.latencyMs}ms</span>}
                </div>
                {c.detail && <p className="mt-2 text-[10px] font-mono text-[var(--hack-gray)]/70">{c.detail}</p>}
              </div>
            );
          })}
        </div>
      ) : <EmptyState icon={HeartPulse} title="No health data" />}
    </Shell>
  );
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────
export function SystemDiagnosticsView() {
  const { data, loading } = useApi<{ env: Record<string, string>; runtime: Record<string, string> }>("/api/system/diagnostics");
  return (
    <Shell>
      <PageHeader icon={Stethoscope} title="Diagnostics" subtitle="// runtime & environment info" accent="amber" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <SectionHeader title="Runtime" icon={Cpu} />
            <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1">
              {Object.entries(data.runtime || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs font-mono">
                  <span className="text-[var(--hack-gray)]">{k}</span>
                  <span className="text-[var(--hack-green)]">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionHeader title="Environment" icon={HardDrive} />
            <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1 max-h-96 overflow-y-auto custom-scroll">
              {Object.entries(data.env || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs font-mono gap-2">
                  <span className="text-[var(--hack-gray)] shrink-0">{k}</span>
                  <span className="text-[var(--hack-cyan)] truncate text-right">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : <EmptyState icon={Stethoscope} title="No diagnostics available" />}
    </Shell>
  );
}

// ─── Scheduler ───────────────────────────────────────────────────────────────
export function SystemSchedulerView() {
  const { data, loading } = useApi<{ jobs: Array<{ id: string; name: string; schedule: string; lastRun?: string; nextRun?: string; status: string }> }>("/api/system/scheduler");
  return (
    <Shell>
      <PageHeader icon={Clock} title="Scheduler" subtitle="// scheduled & recurring tasks" accent="purple" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : data?.jobs && data.jobs.length > 0 ? (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {data.jobs.map((j) => (
            <div key={j.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="h-4 w-4 text-[var(--hack-gray)] shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono text-xs text-[var(--hack-green)] truncate">{j.name}</div>
                  <code className="text-[10px] text-[var(--hack-cyan)]/70">{j.schedule}</code>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono text-[var(--hack-gray)]">
                {j.lastRun && <span>last: {new Date(j.lastRun).toLocaleString()}</span>}
                {j.nextRun && <span className="text-[var(--hack-cyan)]">next: {new Date(j.nextRun).toLocaleString()}</span>}
                <Tag color={j.status === "active" ? "green" : "gray"}>{j.status}</Tag>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={Clock} title="No scheduled jobs" description="No recurring tasks are configured." />}
    </Shell>
  );
}

// ─── Job Queues ──────────────────────────────────────────────────────────────
interface JobItem {
  id: string;
  jobType: string;
  status: string;
  priority: number;
  progress: number;
  resourceId: string;
  error: string;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs: number;
}
export function SystemQueuesView() {
  const { data, loading, reload } = useApi<{ jobs: JobItem[]; stats: Record<string, number> }>("/api/system/queues");
  const navigate = useNavigate();
  return (
    <Shell>
      <PageHeader icon={ListChecks} title="Job Queues" subtitle="// background job lifecycle" accent="green"
        actions={<button onClick={reload} className="border border-[var(--hack-border)] p-2 text-[var(--hack-gray)] hover:text-[var(--hack-green)] hover:border-[var(--hack-green)]/40"><RefreshCw className="h-3.5 w-3.5" /></button>} />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : data ? (
        <div className="space-y-4">
          {data.stats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Object.entries(data.stats).map(([k, v]) => (
                <StatCard key={k} label={k} value={v} icon={ListChecks} accent={k === "failed" ? "red" : k === "running" ? "amber" : "green"} />
              ))}
            </div>
          )}
          {data.jobs && data.jobs.length > 0 ? (
            <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[600px] overflow-y-auto custom-scroll">
              {data.jobs.map((j) => {
                const routeName = j.jobType === "investigation" ? "investigation" : j.jobType === "agent" ? "agent" : j.jobType === "discovery" ? "discovery" : j.jobType === "plan" ? "plan" : j.jobType === "monitor" ? "monitor" : null;
                return (
                  <button
                    key={j.id}
                    onClick={() => routeName && navigate({ name: routeName as "investigation", params: { id: j.resourceId } })}
                    className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-[var(--hack-green)]/5 transition text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Tag color={j.status === "completed" ? "green" : j.status === "running" ? "amber" : j.status === "failed" ? "red" : "gray"}>{j.status}</Tag>
                      <span className="font-mono text-xs text-[var(--hack-green)]">{j.jobType}</span>
                      <code className="text-[10px] text-[var(--hack-cyan)]/60 truncate">{j.resourceId.slice(0, 8)}</code>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono text-[var(--hack-gray)]">
                      {j.status === "running" && j.progress > 0 && <span>{j.progress}%</span>}
                      <span>{new Date(j.queuedAt).toLocaleTimeString()}</span>
                      {j.durationMs > 0 && <span>{(j.durationMs / 1000).toFixed(1)}s</span>}
                      {j.error && <span className="text-[var(--hack-red)] truncate max-w-[100px]">⚠ {j.error}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : <EmptyState icon={ListChecks} title="No jobs" description="The job queue is empty." />}
        </div>
      ) : null}
    </Shell>
  );
}

// ─── Metrics ─────────────────────────────────────────────────────────────────
export function SystemMetricsView() {
  const { data, loading } = useApi<{ metrics: Array<{ metric: string; value: number; unit: string; timestamp: string }> }>("/api/system/metrics");
  return (
    <Shell>
      <PageHeader icon={Gauge} title="Metrics" subtitle="// time-series platform metrics" accent="cyan" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : data?.metrics && data.metrics.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.metrics.map((m) => (
            <div key={m.metric} className="border border-[var(--hack-border)] bg-black/20 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">{m.metric}</span>
                <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{m.unit}</span>
              </div>
              <div className="font-mono text-xl font-bold text-[var(--hack-green)]">{m.value.toLocaleString()}</div>
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60 mt-1">{new Date(m.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={Gauge} title="No metrics collected" description="Metrics will appear here once the platform records activity." />}
    </Shell>
  );
}
