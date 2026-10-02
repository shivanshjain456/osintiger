"use client";

// Knowledge Base views — dashboard, entity list, entity detail, search.
// Reuses existing KB API routes (/api/kb/stats, /api/kb/search, /api/kb/entity/:id,
// /api/kb/recent). The relationships / evidence / conflicts / versions / graph
// subpages are implemented in the KB subagent module.

import { useEffect, useState, useCallback } from "react";
import {
  Library,
  Users,
  Network,
  Fingerprint,
  AlertTriangle,
  GitBranch,
  Share2,
  Search,
  ChevronRight,
  Loader2,
  Clock,
  ArrowLeft,
  ExternalLink,
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

interface KbStats {
  totalEntities: number;
  totalRelationships: number;
  totalEvidence: number;
  totalConflicts: number;
  openConflicts: number;
  totalInvestigationsIngested: number;
  entitiesByType: Record<string, number>;
  relationshipsByType: Record<string, number>;
  topSources: Array<{ sourceKey: string; sourceLabel: string; count: number }>;
  recentActivity: Array<{ timestamp: string; kind: string; description: string }>;
  avgConfidence?: number;
}

// ─── KB Dashboard ────────────────────────────────────────────────────────────
export function KbView() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<KbStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/kb/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sections = [
    { route: "kb-entities" as const, icon: Users, title: "Entities", desc: "Normalized subjects across all investigations." },
    { route: "kb-relationships" as const, icon: Network, title: "Relationships", desc: "Structured edges between entities." },
    { route: "kb-evidence" as const, icon: Fingerprint, title: "Evidence", desc: "Provenance artifacts linking to sources." },
    { route: "kb-conflicts" as const, icon: AlertTriangle, title: "Conflicts", desc: "Disputed facts across sources." },
    { route: "kb-versions" as const, icon: GitBranch, title: "Version History", desc: "Evolution of entities over time." },
    { route: "kb-graph" as const, icon: Share2, title: "Knowledge Graph", desc: "Interactive entity-relationship graph." },
    { route: "kb-search" as const, icon: Search, title: "Search", desc: "Full-text KB search." },
  ];

  return (
    <Shell>
      <PageHeader icon={Library} title="Knowledge Base" subtitle="// durable intelligence repository" accent="cyan" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="Entities" value={stats.totalEntities} icon={Users} accent="cyan" />
            <StatCard label="Relationships" value={stats.totalRelationships} icon={Network} accent="green" />
            <StatCard label="Evidence" value={stats.totalEvidence} icon={Fingerprint} accent="purple" />
            <StatCard label="Conflicts" value={stats.totalConflicts} icon={AlertTriangle} accent="amber" hint={`${stats.openConflicts} open`} />
            <StatCard label="Investigations" value={stats.totalInvestigationsIngested} icon={Library} accent="green" />
            <StatCard label="Avg Confidence" value={stats.avgConfidence != null ? `${Math.round(stats.avgConfidence * 100)}%` : "—"} icon={Fingerprint} accent="cyan" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Entities by type */}
            <div>
              <SectionHeader title="Entities by Type" icon={Users} />
              <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1.5">
                {Object.entries(stats.entitiesByType).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                  <button key={t} onClick={() => navigate({ name: "kb-entities", query: { type: t } })} className="flex items-center justify-between w-full hover:bg-[var(--hack-green)]/5 px-2 py-1 transition">
                    <span className="font-mono text-xs text-[var(--hack-gray)]">{t}</span>
                    <Tag color="cyan">{c}</Tag>
                  </button>
                ))}
                {Object.keys(stats.entitiesByType).length === 0 && <p className="text-xs text-[var(--hack-gray)]/50 font-mono">No entities yet.</p>}
              </div>
            </div>
            {/* Top sources */}
            <div>
              <SectionHeader title="Top Contributing Sources" icon={Fingerprint} />
              <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1.5">
                {stats.topSources.map((s) => (
                  <div key={s.sourceKey} className="flex items-center justify-between px-2 py-1">
                    <span className="font-mono text-xs text-[var(--hack-gray)] truncate">{s.sourceLabel}</span>
                    <Tag color="green">{s.count}</Tag>
                  </div>
                ))}
                {stats.topSources.length === 0 && <p className="text-xs text-[var(--hack-gray)]/50 font-mono">No evidence yet.</p>}
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div>
            <SectionHeader title="Recent KB Activity" icon={Clock} count={stats.recentActivity.length} />
            <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-72 overflow-y-auto custom-scroll">
              {stats.recentActivity.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag color="gray">{a.kind}</Tag>
                    <span className="font-mono text-xs text-[var(--hack-gray)] truncate">{a.description}</span>
                  </div>
                  <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">{new Date(a.timestamp).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : <EmptyState icon={Library} title="No KB data" />}

      {/* Navigation cards */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sections.map((s) => (
          <button key={s.route} onClick={() => navigate({ name: s.route })} className="group text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-3 hover:border-[var(--hack-cyan)]/40 hover:bg-[var(--hack-cyan)]/5 transition">
            <div className="flex items-center justify-between mb-1">
              <s.icon className="h-4 w-4 text-[var(--hack-cyan)]" />
              <ChevronRight className="h-3.5 w-3.5 text-[var(--hack-gray)] group-hover:translate-x-0.5 transition" />
            </div>
            <h3 className="font-mono text-xs font-semibold uppercase text-[var(--hack-green)]">{s.title}</h3>
            <p className="text-[10px] text-[var(--hack-gray)] mt-0.5 leading-relaxed">{s.desc}</p>
          </button>
        ))}
      </div>
    </Shell>
  );
}

// ─── KB Entities list ────────────────────────────────────────────────────────
interface KbEntity {
  id: string;
  type: string;
  primaryName: string;
  confidence: number;
  observationCount: number;
  investigationCount: number;
  lastSeenAt: string;
  status: string;
}
export function KbEntitiesView({ initialType, initialQ }: { initialType?: string; initialQ?: string }) {
  const navigate = useNavigate();
  const [entities, setEntities] = useState<KbEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(initialQ || "");
  const [type, setType] = useState(initialType || "all");

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type !== "all") params.set("type", type);
    fetch(`/api/kb/search?${params}`)
      .then((r) => r.json())
      .then((d) => setEntities(d.entities || []))
      .catch(() => setEntities([]))
      .finally(() => setLoading(false));
  }, [q, type]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const types = ["all", "person", "organization", "domain", "ip", "email", "username", "wallet", "phone", "url", "hash", "cve"];

  return (
    <Shell>
      <PageHeader icon={Users} title="Entities" subtitle={`// ${entities.length} normalized subject${entities.length === 1 ? "" : "s"}`} accent="cyan" />
      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hack-cyan)]/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entities by name or alias…" className="w-full pl-9 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-sm font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-cyan)]/40" />
        </div>
        <select value={type} onChange={(e) => setType(e.target.value)} className="bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-xs font-mono text-[var(--hack-green)] focus:outline-none">
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : entities.length === 0 ? (
        <EmptyState icon={Users} title="No entities found" description="Run an investigation to populate the knowledge base, or try a different search." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[600px] overflow-y-auto custom-scroll">
          {entities.map((e) => (
            <button key={e.id} onClick={() => navigate({ name: "kb-entity", params: { id: e.id } })} className="group flex items-center justify-between w-full px-4 py-2.5 hover:bg-[var(--hack-cyan)]/5 transition text-left">
              <div className="flex items-center gap-3 min-w-0">
                <Tag color="cyan">{e.type}</Tag>
                <span className="font-medium text-sm truncate">{e.primaryName}</span>
                {e.status !== "active" && <Tag color="gray">{e.status}</Tag>}
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono text-[var(--hack-gray)]">
                <span title="observations">{e.observationCount} obs</span>
                <span title="investigations">{e.investigationCount} inv</span>
                <span className="text-[var(--hack-green)]">{Math.round(e.confidence * 100)}%</span>
                <ChevronRight className="h-4 w-4 group-hover:text-[var(--hack-cyan)]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── KB Entity detail ────────────────────────────────────────────────────────
export function KbEntityView({ id, tab }: { id: string; tab?: string }) {
  const navigate = useNavigate();
  const [entity, setEntity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/kb/entity/${id}`)
      .then((r) => r.json())
      .then(setEntity)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Shell><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div></Shell>;
  if (!entity) return <Shell><EmptyState icon={Users} title="Entity not found" /></Shell>;

  const tabs = ["overview", "evidence", "relationships", "versions", "conflicts"];
  const activeTab = tab && tabs.includes(tab) ? tab : "overview";

  return (
    <Shell>
      <PageHeader icon={Users} title={entity.primaryName || entity.id.slice(0, 8)} subtitle={`// ${entity.type} · ${Math.round((entity.confidence || 0) * 100)}% confidence`} accent="cyan" />
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button key={t} onClick={() => navigate({ name: "kb-entity", params: { id }, query: { tab: t } })} className={`border px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${activeTab === t ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]" : "border-[var(--hack-border)] text-[var(--hack-gray)] hover:text-[var(--hack-cyan)]"}`}>{t}</button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[var(--hack-border)] bg-black/20 p-4">
            <SectionHeader title="Attributes" />
            <div className="space-y-1">
              {Object.entries(entity.attributes || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-xs font-mono">
                  <span className="text-[var(--hack-gray)]">{k}</span>
                  <span className="text-[var(--hack-green)] truncate ml-2 text-right">{String(v)}</span>
                </div>
              ))}
              {Object.keys(entity.attributes || {}).length === 0 && <p className="text-xs text-[var(--hack-gray)]/50">No attributes recorded.</p>}
            </div>
          </div>
          <div className="border border-[var(--hack-border)] bg-black/20 p-4">
            <SectionHeader title="Aliases" />
            <div className="flex flex-wrap gap-1.5">
              {(entity.aliases || []).map((a: string, i: number) => <Tag key={i} color="cyan">{a}</Tag>)}
              {(entity.aliases || []).length === 0 && <p className="text-xs text-[var(--hack-gray)]/50">No aliases.</p>}
            </div>
            <SectionHeader title="Metadata" />
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between"><span className="text-[var(--hack-gray)]">first seen</span><span className="text-[var(--hack-green)]">{new Date(entity.firstSeenAt).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-[var(--hack-gray)]">last seen</span><span className="text-[var(--hack-green)]">{new Date(entity.lastSeenAt).toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-[var(--hack-gray)]">observations</span><span className="text-[var(--hack-green)]">{entity.observationCount}</span></div>
              <div className="flex justify-between"><span className="text-[var(--hack-gray)]">investigations</span><span className="text-[var(--hack-green)]">{entity.investigationCount}</span></div>
              <div className="flex justify-between"><span className="text-[var(--hack-gray)]">version</span><span className="text-[var(--hack-green)]">v{entity.version}</span></div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "evidence" && (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {(entity.evidence || []).map((ev: any) => (
            <div key={ev.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Tag color="green">{ev.sourceLabel || ev.sourceKey}</Tag>
                <span className="text-[10px] font-mono text-[var(--hack-gray)]">{Math.round((ev.confidence || 0) * 100)}%</span>
                <span className="text-[9px] font-mono text-[var(--hack-gray)]/60 ml-auto">{new Date(ev.observedAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-[var(--hack-gray)] font-mono">{ev.normalizedText || ev.rawText || "—"}</p>
              {ev.sourceUrl && <a href={ev.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--hack-cyan)] hover:underline flex items-center gap-1 mt-1"><ExternalLink className="h-3 w-3" /> source</a>}
            </div>
          ))}
          {(entity.evidence || []).length === 0 && <EmptyState icon={Fingerprint} title="No evidence" />}
        </div>
      )}

      {activeTab === "relationships" && (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {(entity.relationships || []).map((r: any) => (
            <div key={r.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Tag color="purple">{r.relationType}</Tag>
                <span className="text-xs text-[var(--hack-gray)] truncate">{r.label}</span>
              </div>
              <span className="text-[10px] font-mono text-[var(--hack-cyan)]">{r.direction === "outgoing" ? "→" : "←"} {r.otherEntityName}</span>
            </div>
          ))}
          {(entity.relationships || []).length === 0 && <EmptyState icon={Network} title="No relationships" />}
        </div>
      )}

      {activeTab === "versions" && (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {(entity.versions || []).map((v: any) => (
            <div key={v.id} className="px-4 py-3">
              <div className="flex items-center gap-2">
                <Tag color="green">v{v.versionNumber}</Tag>
                <Tag color="gray">{v.changeType}</Tag>
                <span className="text-[9px] font-mono text-[var(--hack-gray)]/60 ml-auto">{new Date(v.validFrom).toLocaleString()}</span>
              </div>
              {v.changeReason && <p className="text-xs text-[var(--hack-gray)] font-mono mt-1">{v.changeReason}</p>}
            </div>
          ))}
          {(entity.versions || []).length === 0 && <EmptyState icon={GitBranch} title="No version history" />}
        </div>
      )}

      {activeTab === "conflicts" && (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {(entity.conflicts || []).map((c: any) => (
            <div key={c.id} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Tag color="amber">{c.field}</Tag>
                <Tag color={c.status === "open" ? "amber" : "green"}>{c.status}</Tag>
              </div>
              <div className="flex gap-2 text-xs font-mono">
                <span className="text-[var(--hack-green)]">A: {c.valueA}</span>
                <span className="text-[var(--hack-gray)]">vs</span>
                <span className="text-[var(--hack-red)]">B: {c.valueB}</span>
              </div>
            </div>
          ))}
          {(entity.conflicts || []).length === 0 && <EmptyState icon={AlertTriangle} title="No conflicts" description="All sources agree on this entity's attributes." />}
        </div>
      )}
    </Shell>
  );
}

// ─── KB Search ───────────────────────────────────────────────────────────────
export function KbSearchView({ initialQ }: { initialQ?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initialQ || "");
  const [results, setResults] = useState<KbEntity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) return;
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/kb/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(d.entities || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Shell>
      <PageHeader icon={Search} title="KB Search" subtitle="// full-text entity search" accent="cyan" />
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--hack-cyan)]/50" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entities by name, alias, or attribute…" autoFocus className="w-full pl-10 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2.5 text-sm font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-cyan)]/40" />
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)]" /></div>
      ) : results.length > 0 ? (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {results.map((e) => (
            <button key={e.id} onClick={() => navigate({ name: "kb-entity", params: { id: e.id } })} className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-[var(--hack-cyan)]/5 transition text-left">
              <div className="flex items-center gap-3">
                <Tag color="cyan">{e.type}</Tag>
                <span className="text-sm">{e.primaryName}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--hack-gray)]" />
            </button>
          ))}
        </div>
      ) : q.trim() ? (
        <EmptyState icon={Search} title="No matches" description={`No entities match "${q}".`} />
      ) : (
        <EmptyState icon={Search} title="Start typing" description="Search across all knowledge-base entities." />
      )}
    </Shell>
  );
}
