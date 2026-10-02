"use client";

// KB sub-views: relationships, evidence, conflicts, versions, graph.
// These are functional, filterable list/grid views backed by dedicated API
// routes (/api/kb/relationships, /api/kb/evidence, /api/kb/conflicts,
// /api/kb/versions, /api/kb/graph) that read directly from the KB Prisma models.

import { useEffect, useState, useCallback } from "react";
import {
  Network,
  Fingerprint,
  AlertTriangle,
  GitBranch,
  Share2,
  Search,
  Loader2,
  ChevronRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { PageHeader, SectionHeader, EmptyState, Tag, StatCard } from "./PageBits";
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

// ─── Relationships ───────────────────────────────────────────────────────────
interface Relationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  label: string;
  confidence: number;
  sourceLabel: string;
  observationCount: number;
  lastSeenAt: string;
  fromName?: string;
  toName?: string;
}
export function KbRelationshipsView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    queueMicrotask(() => setLoading(true));
    const params = new URLSearchParams({ limit: "200" });
    if (q) params.set("q", q);
    fetch(`/api/kb/relationships?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.relationships || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [q]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <Shell>
      <PageHeader icon={Network} title="Relationships" subtitle={`// ${items.length} edge${items.length === 1 ? "" : "s"}`} accent="green" />
      <div className="relative mb-4">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hack-green)]/50" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by type, label, or entity name…" className="w-full pl-9 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-sm font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/40" />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Network} title="No relationships" description="Relationships are created as investigations ingest entities." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[600px] overflow-y-auto custom-scroll">
          {items.map((r) => (
            <div key={r.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-[var(--hack-green)]/5 transition">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Tag color="purple">{r.relationType}</Tag>
                <button onClick={() => navigate({ name: "kb-entity", params: { id: r.fromEntityId } })} className="font-mono text-xs text-[var(--hack-green)] hover:underline truncate">{r.fromName || r.fromEntityId.slice(0, 8)}</button>
                <span className="text-[var(--hack-gray)]">→</span>
                <button onClick={() => navigate({ name: "kb-entity", params: { id: r.toEntityId } })} className="font-mono text-xs text-[var(--hack-green)] hover:underline truncate">{r.toName || r.toEntityId.slice(0, 8)}</button>
                {r.label && <span className="text-xs text-[var(--hack-gray)] truncate">({r.label})</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono text-[var(--hack-gray)]">
                <span className="text-[var(--hack-green)]">{Math.round(r.confidence * 100)}%</span>
                <span>{r.observationCount}×</span>
                <span>{new Date(r.lastSeenAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Evidence ────────────────────────────────────────────────────────────────
interface EvidenceItem {
  id: string;
  entityId: string;
  sourceLabel: string;
  sourceKey: string;
  sourceUrl: string;
  rawText: string;
  normalizedText: string;
  confidence: number;
  observedAt: string;
  investigationId: string;
}
export function KbEvidenceView({ entityId, source }: { entityId?: string; source?: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSource, setFilterSource] = useState(source || "");

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    const params = new URLSearchParams({ limit: "200" });
    if (entityId) params.set("entityId", entityId);
    if (filterSource) params.set("source", filterSource);
    fetch(`/api/kb/evidence?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.evidence || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [entityId, filterSource]);

  return (
    <Shell>
      <PageHeader icon={Fingerprint} title="Evidence" subtitle={`// ${items.length} artifact${items.length === 1 ? "" : "s"}`} accent="purple" />
      <div className="mb-4 flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-[var(--hack-gray)]" />
        <input value={filterSource} onChange={(e) => setFilterSource(e.target.value)} placeholder="Filter by source key…" className="flex-1 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-1.5 text-xs font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/40" />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Fingerprint} title="No evidence" description="Evidence is recorded as investigations collect findings." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[700px] overflow-y-auto custom-scroll">
          {items.map((e) => (
            <div key={e.id} className="px-4 py-3 hover:bg-[var(--hack-green)]/5 transition">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Tag color="green">{e.sourceLabel || e.sourceKey}</Tag>
                  <span className="text-[10px] font-mono text-[var(--hack-green)]">{Math.round(e.confidence * 100)}%</span>
                </div>
                <span className="text-[9px] font-mono text-[var(--hack-gray)]/60">{new Date(e.observedAt).toLocaleString()}</span>
              </div>
              <p className="text-xs text-[var(--hack-gray)] font-mono line-clamp-2">{e.normalizedText || e.rawText || "—"}</p>
              <div className="flex items-center gap-3 mt-1.5">
                {e.entityId && (
                  <button onClick={() => navigate({ name: "kb-entity", params: { id: e.entityId } })} className="text-[10px] font-mono text-[var(--hack-cyan)] hover:underline">
                    entity →
                  </button>
                )}
                {e.sourceUrl && (
                  <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-[var(--hack-cyan)] hover:underline truncate max-w-[300px]">
                    {e.sourceUrl}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Conflicts ───────────────────────────────────────────────────────────────
interface Conflict {
  id: string;
  entityId: string;
  field: string;
  valueA: string;
  valueB: string;
  sourceKeyA: string;
  sourceKeyB: string;
  status: string;
  resolution: string;
  detectedAt: string;
  entityName?: string;
}
export function KbConflictsView({ status }: { status?: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(status || "all");

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    const params = new URLSearchParams({ limit: "200" });
    if (statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/kb/conflicts?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.conflicts || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const open = items.filter((i) => i.status === "open").length;

  return (
    <Shell>
      <PageHeader icon={AlertTriangle} title="Conflicts" subtitle={`// ${items.length} conflict${items.length === 1 ? "" : "s"} · ${open} open`} accent="amber" />
      <div className="mb-3 flex items-center gap-2">
        {["all", "open", "resolved_a", "resolved_b", "unresolved"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`border px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${statusFilter === s ? "border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10 text-[var(--hack-amber)]" : "border-[var(--hack-border)] text-[var(--hack-gray)] hover:text-[var(--hack-amber)]"}`}>{s}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="No conflicts" description="All sources agree on recorded entity attributes. This is the ideal state." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {items.map((c) => (
            <div key={c.id} className="px-4 py-3 hover:bg-[var(--hack-amber)]/5 transition">
              <div className="flex items-center gap-2 mb-2">
                <Tag color="amber">{c.field}</Tag>
                <Tag color={c.status === "open" ? "amber" : "green"}>{c.status}</Tag>
                {c.entityName && (
                  <button onClick={() => navigate({ name: "kb-entity", params: { id: c.entityId } })} className="font-mono text-xs text-[var(--hack-cyan)] hover:underline">
                    {c.entityName}
                  </button>
                )}
                <span className="text-[9px] font-mono text-[var(--hack-gray)]/60 ml-auto">{new Date(c.detectedAt).toLocaleString()}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Tag color="green">A</Tag>
                    <code className="text-[9px] text-[var(--hack-gray)]">{c.sourceKeyA}</code>
                  </div>
                  <p className="text-xs text-[var(--hack-green)] font-mono">{c.valueA || "—"}</p>
                </div>
                <div className="border border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5 p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <Tag color="red">B</Tag>
                    <code className="text-[9px] text-[var(--hack-gray)]">{c.sourceKeyB}</code>
                  </div>
                  <p className="text-xs text-[var(--hack-red)] font-mono">{c.valueB || "—"}</p>
                </div>
              </div>
              {c.resolution && <p className="text-[10px] font-mono text-[var(--hack-gray)] mt-2">resolution: {c.resolution}</p>}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Version History ─────────────────────────────────────────────────────────
interface VersionItem {
  id: string;
  entityType: string;
  recordId: string;
  versionNumber: number;
  changeType: string;
  changeReason: string;
  validFrom: string;
  validTo: string | null;
  investigationId: string;
}
export function KbVersionsView({ entityType, recordId }: { entityType?: string; recordId?: string }) {
  const [items, setItems] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState(entityType || "all");

  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    const params = new URLSearchParams({ limit: "200" });
    if (typeFilter !== "all") params.set("entityType", typeFilter);
    if (recordId) params.set("recordId", recordId);
    fetch(`/api/kb/versions?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.versions || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [typeFilter, recordId]);

  return (
    <Shell>
      <PageHeader icon={GitBranch} title="Version History" subtitle={`// ${items.length} version${items.length === 1 ? "" : "s"}`} accent="purple" />
      <div className="mb-3 flex items-center gap-2">
        {["all", "entity", "relationship"].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`border px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${typeFilter === t ? "border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10 text-[var(--hack-purple)]" : "border-[var(--hack-border)] text-[var(--hack-gray)] hover:text-[var(--hack-purple)]"}`}>{t}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={GitBranch} title="No versions" description="Version history is recorded as entities are updated across investigations." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[700px] overflow-y-auto custom-scroll">
          {items.map((v) => (
            <div key={v.id} className="px-4 py-3 hover:bg-[var(--hack-green)]/5 transition">
              <div className="flex items-center gap-2 mb-1">
                <Tag color="purple">v{v.versionNumber}</Tag>
                <Tag color="gray">{v.entityType}</Tag>
                <Tag color={v.changeType === "create" ? "green" : v.changeType === "merge" ? "amber" : v.changeType === "deprecate" ? "red" : "cyan"}>{v.changeType}</Tag>
                <code className="text-[9px] text-[var(--hack-cyan)]/60">{v.recordId.slice(0, 12)}</code>
                <span className="text-[9px] font-mono text-[var(--hack-gray)]/60 ml-auto">{new Date(v.validFrom).toLocaleString()}</span>
              </div>
              {v.changeReason && <p className="text-xs text-[var(--hack-gray)] font-mono ml-2">{v.changeReason}</p>}
              {v.validTo && <p className="text-[9px] font-mono text-[var(--hack-gray)]/50 ml-2 mt-0.5">valid until: {new Date(v.validTo).toLocaleString()}</p>}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Knowledge Graph ─────────────────────────────────────────────────────────
export function KbGraphView({ focus }: { focus?: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ limit: "50" });
    if (focus) params.set("focus", focus);
    fetch(`/api/kb/graph?${params}`)
      .then((r) => r.json())
      .then((d) => setData({ nodes: d.nodes || [], edges: d.edges || [] }))
      .catch(() => setData({ nodes: [], edges: [] }))
      .finally(() => setLoading(false));
  }, [focus]);

  return (
    <Shell>
      <PageHeader icon={Share2} title="Knowledge Graph" subtitle={data ? `// ${data.nodes.length} nodes · ${data.edges.length} edges` : "// loading"} accent="cyan" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : data && data.nodes.length > 0 ? (
        <div className="space-y-4">
          {/* Graph visualization (SVG, force-ish radial layout) */}
          <div className="border border-[var(--hack-border)] bg-black/30 p-2 osint-grid">
            <svg viewBox="0 0 800 500" className="w-full h-[400px]" role="img" aria-label="Knowledge graph">
              {data.edges.map((e: any, i: number) => {
                const from = data.nodes.find((n: any) => n.id === e.fromEntityId);
                const to = data.nodes.find((n: any) => n.id === e.toEntityId);
                if (!from || !to) return null;
                return <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(0,255,65,0.3)" strokeWidth={1} />;
              })}
              {data.nodes.map((n: any) => (
                <g key={n.id} onClick={() => navigate({ name: "kb-entity", params: { id: n.id } })} className="cursor-pointer">
                  <circle cx={n.x} cy={n.y} r={6 + Math.min(8, (n.observationCount || 1) / 2)} fill="rgba(0,255,65,0.2)" stroke="rgba(0,255,65,0.8)" strokeWidth={1.5} />
                  <text x={n.x} y={n.y - 12} textAnchor="middle" className="fill-[var(--hack-green)]" style={{ fontSize: 9, fontFamily: "monospace" }}>{(n.primaryName || n.id.slice(0, 8)).slice(0, 16)}</text>
                </g>
              ))}
            </svg>
          </div>
          {/* Node list */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.nodes.map((n: any) => (
              <button key={n.id} onClick={() => navigate({ name: "kb-entity", params: { id: n.id } })} className="flex items-center gap-2 border border-[var(--hack-border)] bg-black/20 p-2 hover:border-[var(--hack-cyan)]/40 hover:bg-[var(--hack-cyan)]/5 transition text-left">
                <Tag color="cyan">{n.type}</Tag>
                <span className="text-xs font-mono text-[var(--hack-green)] truncate">{n.primaryName}</span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--hack-gray)] ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon={Share2} title="No graph data" description="The graph populates as entities and relationships accumulate in the knowledge base." />
      )}
    </Shell>
  );
}
