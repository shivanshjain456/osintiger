"use client";

// Analytics & provenance views. Uses existing analytics + provenance API routes.

import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  BarChart3,
  GitBranch,
  Fingerprint,
  Loader2,
  Search,
  ChevronRight,
  Link2,
  ArrowLeft,
} from "lucide-react";
import { PageHeader, SectionHeader, StatCard, EmptyState, Tag } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate } from "@/lib/router/useRouter";
import { fetchRecentWithFilters } from "@/lib/osint/client";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      {children}
    </div>
  );
}

// ─── Analytics Dashboard ─────────────────────────────────────────────────────
export function DashboardView() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ total: number; completed: number; failed: number; avgConfidence: number; byType: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentWithFilters("", "all", 200)
      .then((d) => {
        const items = d.investigations;
        const completed = items.filter((i) => i.status === "completed").length;
        const failed = items.filter((i) => i.status === "failed").length;
        const confItems = items.filter((i) => i.confidence != null);
        const avgConfidence = confItems.length > 0 ? confItems.reduce((s, i) => s + (i.confidence || 0), 0) / confItems.length : 0;
        const byType: Record<string, number> = {};
        items.forEach((i) => { byType[i.input_type || "auto"] = (byType[i.input_type || "auto"] || 0) + 1; });
        setStats({ total: d.total, completed, failed, avgConfidence, byType });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { route: "analytics-sources" as const, icon: BarChart3, title: "Source Analytics", desc: "Per-source reliability, success rate, and contribution." },
    { route: "analytics-versions" as const, icon: GitBranch, title: "Version Analytics", desc: "Confidence & finding evolution per target over time." },
    { route: "analytics-provenance" as const, icon: Fingerprint, title: "Provenance Analytics", desc: "Evidence chain depth & collector coverage." },
  ];

  return (
    <Shell>
      <PageHeader icon={LayoutDashboard} title="Analytics Dashboard" subtitle="// platform-wide intelligence metrics" accent="green" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Investigations" value={stats.total} icon={LayoutDashboard} />
            <StatCard label="Completed" value={stats.completed} icon={BarChart3} accent="cyan" />
            <StatCard label="Failed" value={stats.failed} icon={BarChart3} accent="red" />
            <StatCard label="Avg Confidence" value={`${Math.round(stats.avgConfidence * 100)}%`} icon={BarChart3} accent="purple" />
          </div>
          <div>
            <SectionHeader title="By Input Type" icon={BarChart3} />
            <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1.5">
              {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                <div key={t} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[var(--hack-gray)]">{t}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 bg-[var(--hack-border)] overflow-hidden">
                      <div className="h-full bg-[var(--hack-green)]" style={{ width: `${(c / stats.total) * 100}%` }} />
                    </div>
                    <Tag color="green">{c}</Tag>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : <EmptyState icon={LayoutDashboard} title="No data" />}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <button key={c.route} onClick={() => navigate({ name: c.route })} className="group text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-4 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition">
            <div className="flex items-center justify-between mb-2">
              <c.icon className="h-5 w-5 text-[var(--hack-green)]" />
              <ChevronRight className="h-4 w-4 text-[var(--hack-gray)] group-hover:translate-x-0.5 transition" />
            </div>
            <h3 className="font-mono text-sm font-semibold uppercase text-[var(--hack-green)]">{c.title}</h3>
            <p className="text-xs text-[var(--hack-gray)] mt-1">{c.desc}</p>
          </button>
        ))}
      </div>
    </Shell>
  );
}

// ─── Source Analytics ────────────────────────────────────────────────────────
interface SourceStat {
  source: string;
  source_label: string;
  times_consulted: number;
  success_count: number;
  error_count: number;
  total_findings: number;
  avg_confidence: number;
}
export function AnalyticsSourcesView({ target }: { target?: string }) {
  const [stats, setStats] = useState<SourceStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analytics/sources${target ? `?target=${encodeURIComponent(target)}` : ""}`)
      .then((r) => r.json())
      .then((d) => setStats(d.sources || d.stats || []))
      .catch(() => setStats([]))
      .finally(() => setLoading(false));
  }, [target]);

  const maxConsulted = Math.max(1, ...stats.map((s) => s.times_consulted));

  return (
    <Shell>
      <PageHeader icon={BarChart3} title="Source Analytics" subtitle={`// ${stats.length} source${stats.length === 1 ? "" : "s"} tracked`} accent="green" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : stats.length === 0 ? (
        <EmptyState icon={BarChart3} title="No source data" description="Run investigations to collect source analytics." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {stats.sort((a, b) => b.times_consulted - a.times_consulted).map((s) => {
            const successRate = s.times_consulted > 0 ? (s.success_count / s.times_consulted) * 100 : 0;
            return (
              <div key={s.source} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold text-[var(--hack-green)] truncate">{s.source_label || s.source}</span>
                    <code className="text-[9px] text-[var(--hack-cyan)]/60">{s.source}</code>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Tag color={successRate > 80 ? "green" : successRate > 50 ? "amber" : "red"}>{successRate.toFixed(0)}% ok</Tag>
                    <Tag color="cyan">{s.total_findings} findings</Tag>
                    <span className="text-[10px] font-mono text-[var(--hack-green)]">{Math.round(s.avg_confidence * 100)}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-[var(--hack-border)] overflow-hidden">
                    <div className="h-full bg-[var(--hack-green)]" style={{ width: `${(s.times_consulted / maxConsulted) * 100}%` }} />
                  </div>
                  <span className="text-[9px] font-mono text-[var(--hack-gray)]/60 shrink-0">{s.times_consulted}×</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

// ─── Version Analytics ───────────────────────────────────────────────────────
export function AnalyticsVersionsView({ target }: { target?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(target || "");
  const [versions, setVersions] = useState<Array<{ version: number; id: string; target: string; created_at: string; status: string; confidence: number | null }>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback((query: string) => {
    if (!query.trim()) { queueMicrotask(() => setVersions([])); return; }
    queueMicrotask(() => setLoading(true));
    fetch(`/api/analytics/versions?target=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => setVersions(d.versions || []))
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { if (target) load(target); }, [target, load]);

  return (
    <Shell>
      <PageHeader icon={GitBranch} title="Version Analytics" subtitle="// confidence evolution per target" accent="purple" />
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hack-green)]/50" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load(q)} placeholder="Enter a target name to see its version history…" className="w-full pl-10 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-sm font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/40" />
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : versions.length > 0 ? (
        <div className="space-y-3">
          {/* Confidence trend */}
          <div className="border border-[var(--hack-border)] bg-black/20 p-4">
            <SectionHeader title="Confidence Trend" />
            <div className="flex items-end gap-2 h-32">
              {versions.map((v) => (
                <div key={v.id} className="flex-1 flex flex-col items-center justify-end group">
                  <span className="text-[9px] font-mono text-[var(--hack-green)] mb-1">{v.confidence != null ? `${Math.round(v.confidence * 100)}%` : "—"}</span>
                  <div className="w-full bg-gradient-to-t from-[var(--hack-green)]/40 to-[var(--hack-green)] group-hover:from-[var(--hack-green)] group-hover:to-[var(--hack-cyan)] transition" style={{ height: `${(v.confidence || 0) * 100}%` }} title={`v${v.version} — ${new Date(v.created_at).toLocaleString()}`} />
                  <span className="text-[8px] font-mono text-[var(--hack-gray)]/60 mt-1">v{v.version}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Version list */}
          <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
            {versions.map((v) => (
              <button key={v.id} onClick={() => navigate({ name: "investigation-report", params: { id: v.id } })} className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-[var(--hack-green)]/5 transition text-left">
                <div className="flex items-center gap-3">
                  <Tag color="purple">v{v.version}</Tag>
                  <Tag color={v.status === "completed" ? "green" : "gray"}>{v.status}</Tag>
                  <span className="text-xs font-mono text-[var(--hack-gray)]">{new Date(v.created_at).toLocaleString()}</span>
                </div>
                {v.confidence != null && <span className="text-xs font-mono text-[var(--hack-green)]">{Math.round(v.confidence * 100)}%</span>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={GitBranch} title="Search for a target" description="Enter a target name above to view its investigation history and confidence trend." />
      )}
    </Shell>
  );
}

// ─── Provenance Analytics ────────────────────────────────────────────────────
export function AnalyticsProvenanceView() {
  const [stats, setStats] = useState<{ byType: Record<string, number>; byCollector: Record<string, number>; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aggregate from the provenance list endpoint (recent events)
    fetch("/api/provenance?limit=500")
      .then((r) => r.json())
      .then((d) => {
        const events = d.events || [];
        const byType: Record<string, number> = {};
        const byCollector: Record<string, number> = {};
        events.forEach((e: any) => {
          byType[e.eventType] = (byType[e.eventType] || 0) + 1;
          byCollector[e.collectorName || e.toolName || "unknown"] = (byCollector[e.collectorName || e.toolName || "unknown"] || 0) + 1;
        });
        setStats({ byType, byCollector, total: events.length });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <PageHeader icon={Fingerprint} title="Provenance Analytics" subtitle="// evidence chain coverage" accent="purple" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : stats ? (
        <div className="space-y-6">
          <StatCard label="Total Provenance Events" value={stats.total} icon={Fingerprint} accent="purple" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <SectionHeader title="Events by Type" icon={BarChart3} />
              <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1.5">
                {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                  <div key={t} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[var(--hack-gray)]">{t}</span>
                    <Tag color="purple">{c}</Tag>
                  </div>
                ))}
                {Object.keys(stats.byType).length === 0 && <p className="text-xs text-[var(--hack-gray)]/50 font-mono">No events.</p>}
              </div>
            </div>
            <div>
              <SectionHeader title="Events by Collector" icon={Fingerprint} />
              <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1.5 max-h-72 overflow-y-auto custom-scroll">
                {Object.entries(stats.byCollector).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                  <div key={t} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[var(--hack-gray)] truncate">{t}</span>
                    <Tag color="cyan">{c}</Tag>
                  </div>
                ))}
                {Object.keys(stats.byCollector).length === 0 && <p className="text-xs text-[var(--hack-gray)]/50 font-mono">No collectors.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : <EmptyState icon={Fingerprint} title="No provenance data" />}
    </Shell>
  );
}

// ─── Provenance list ─────────────────────────────────────────────────────────
export function ProvenanceView({ investigationId, eventType }: { investigationId?: string; eventType?: string }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "200" });
    if (investigationId) params.set("investigationId", investigationId);
    if (eventType) params.set("eventType", eventType);
    fetch(`/api/provenance?${params}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [investigationId, eventType]);

  const types = ["all", "collection", "normalization", "scoring", "synthesis", "reporting", "enrichment", "correlation"];

  return (
    <Shell>
      <PageHeader icon={Fingerprint} title="Provenance Chain" subtitle={`// ${events.length} evidence event${events.length === 1 ? "" : "s"}`} accent="purple" />
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        {types.map((t) => (
          <button key={t} onClick={() => navigate({ name: "provenance", query: { eventType: t === "all" ? undefined : t } })} className={`border px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${(!eventType && t === "all") || eventType === t ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]" : "border-[var(--hack-border)] text-[var(--hack-gray)] hover:text-[var(--hack-green)]"}`}>{t}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : events.length === 0 ? (
        <EmptyState icon={Fingerprint} title="No provenance events" description="Provenance events are recorded as investigations collect evidence." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[700px] overflow-y-auto custom-scroll">
          {events.map((e) => (
            <button key={e.id} onClick={() => navigate({ name: "provenance-trace", params: { evidenceId: e.evidenceId || e.id } })} className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-[var(--hack-green)]/5 transition text-left">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Tag color="purple">{e.eventType}</Tag>
                <span className="font-mono text-xs text-[var(--hack-green)] truncate">{e.collectorName || e.toolName || "unknown"}</span>
                {e.sourceUrl && <code className="text-[9px] text-[var(--hack-cyan)]/60 truncate max-w-[200px]">{e.sourceUrl}</code>}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[9px] font-mono text-[var(--hack-gray)]/60">
                <span className="text-[var(--hack-green)]">{Math.round((e.confidence || 0) * 100)}%</span>
                <span>{new Date(e.eventTime || e.collectedAt).toLocaleTimeString()}</span>
                <Link2 className="h-3 w-3" />
              </div>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Provenance investigation ────────────────────────────────────────────────
export function ProvenanceInvestigationView({ id }: { id: string }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/provenance/${id}`)
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <Shell>
      <PageHeader icon={Fingerprint} title={`Provenance — ${id.slice(0, 8)}`} subtitle={`// ${events.length} events`} accent="purple"
        actions={<button onClick={() => navigate({ name: "investigation", params: { id } })} className="flex items-center gap-1.5 border border-[var(--hack-border)] px-3 py-1.5 text-xs font-mono text-[var(--hack-gray)] hover:text-[var(--hack-green)] hover:border-[var(--hack-green)]/40"><ArrowLeft className="h-3.5 w-3.5" /> Investigation</button>} />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : events.length === 0 ? (
        <EmptyState icon={Fingerprint} title="No provenance events" />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[700px] overflow-y-auto custom-scroll">
          {events.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Tag color="purple">{e.eventType}</Tag>
                <span className="font-mono text-xs text-[var(--hack-green)]">{e.collectorName || e.toolName}</span>
                <span className="text-[9px] font-mono text-[var(--hack-gray)]/60 ml-auto">{new Date(e.eventTime || e.collectedAt).toLocaleString()}</span>
              </div>
              {e.queryString && <p className="text-xs text-[var(--hack-gray)] font-mono">query: <code className="text-[var(--hack-cyan)]">{e.queryString}</code></p>}
              {e.sourceUrl && <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--hack-cyan)] hover:underline">{e.sourceUrl}</a>}
              <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-[var(--hack-gray)]/60">
                <span>confidence: <span className="text-[var(--hack-green)]">{Math.round((e.confidence || 0) * 100)}%</span></span>
                {e.latencyMs > 0 && <span>· {e.latencyMs}ms</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Provenance trace ────────────────────────────────────────────────────────
export function ProvenanceTraceView({ evidenceId }: { evidenceId: string }) {
  const [trace, setTrace] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/provenance/trace/${evidenceId}`)
      .then((r) => r.json())
      .then(setTrace)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [evidenceId]);

  return (
    <Shell>
      <PageHeader icon={Link2} title="Evidence Trace" subtitle={`// ${evidenceId.slice(0, 12)}`} accent="purple" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : trace ? (
        <div className="space-y-3">
          {trace.chain && trace.chain.length > 0 && (
            <div className="border border-[var(--hack-border)] bg-black/20 p-4">
              <SectionHeader title="Evidence Chain" icon={Link2} count={trace.chain.length} />
              <div className="space-y-2">
                {trace.chain.map((link: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 border-l-2 border-[var(--hack-green)]/40 pl-3 py-1">
                    <span className="font-mono text-[10px] text-[var(--hack-gray)]/60 shrink-0 mt-0.5">{i + 1}.</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag color="purple">{link.eventType}</Tag>
                        <span className="font-mono text-xs text-[var(--hack-green)]">{link.collectorName || link.toolName}</span>
                      </div>
                      <p className="text-xs text-[var(--hack-gray)] font-mono mt-0.5">{link.detail || link.queryString || "—"}</p>
                      <span className="text-[9px] font-mono text-[var(--hack-gray)]/50">{new Date(link.eventTime || link.collectedAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : <EmptyState icon={Link2} title="Trace not found" description={`No provenance chain for evidence ${evidenceId.slice(0, 12)}.`} />}
    </Shell>
  );
}
