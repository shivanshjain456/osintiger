"use client";

// Investigations list (full history page) — a routed, filterable, searchable
// view of all investigation sessions. Replaces the dialog-only HistoryDialog
// as the primary browsing surface while keeping the dialog for quick access.

import { useEffect, useState, useCallback } from "react";
import {
  History,
  Search,
  Star,
  Filter,
  Clock,
  ChevronRight,
  Loader2,
  Trash2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { PageHeader, SectionHeader, EmptyState, Tag } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate } from "@/lib/router/useRouter";
import { fetchRecentWithFilters, deleteInvestigation } from "@/lib/osint/client";
import type { HistoryItem } from "@/lib/osint/client";

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "domain", label: "Domain" },
  { value: "ip", label: "IP" },
  { value: "person", label: "Person" },
  { value: "organization", label: "Organization" },
  { value: "email", label: "Email" },
  { value: "username", label: "Username" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
  { value: "hash", label: "Hash" },
  { value: "wallet", label: "Wallet" },
  { value: "cve", label: "CVE" },
];

function statusColor(status: string): "green" | "amber" | "red" | "gray" {
  if (status === "completed") return "green";
  if (status === "running" || status === "queued") return "amber";
  if (status === "failed") return "red";
  return "gray";
}

export function InvestigationsListView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [contentQ, setContentQ] = useState("");
  const [activeContentSearch, setActiveContentSearch] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecentWithFilters(q, type, 200, starredOnly);
      setItems(data.investigations);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, type, starredOnly]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  // Full-text content search (separate endpoint query param)
  useEffect(() => {
    if (!activeContentSearch) return;
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (contentQ) params.set("content", contentQ);
    params.set("limit", "200");
    fetch(`/api/recent?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setItems(d.investigations || []);
        setTotal(d.total || 0);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeContentSearch, contentQ]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this investigation? This cannot be undone.")) return;
    const ok = await deleteInvestigation(id);
    if (ok) load();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      <PageHeader
        icon={History}
        title="Investigations"
        subtitle={`// ${total} session${total === 1 ? "" : "s"} on record`}
        actions={
          <button
            onClick={() => navigate({ name: "new" })}
            className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 transition"
          >
            + New
          </button>
        }
      />

      {/* Filters */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hack-green)]/50" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by target name…"
              className="w-full pl-9 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-sm font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-green)]/40"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-xs font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/40"
          >
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => setStarredOnly((s) => !s)}
            className={`flex items-center gap-1.5 border px-3 py-2 text-xs font-mono uppercase tracking-wider transition ${starredOnly ? "border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10 text-[var(--hack-amber)]" : "border-[var(--hack-border)] text-[var(--hack-gray)] hover:text-[var(--hack-amber)] hover:border-[var(--hack-amber)]/40"}`}
          >
            <Star className="h-3.5 w-3.5" /> Starred
          </button>
        </div>
        {/* Full-text content search toggle */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-[var(--hack-gray)]" />
          <input
            value={contentQ}
            onChange={(e) => setContentQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setActiveContentSearch(true)}
            placeholder="Full-text search across findings & analysis…"
            className="flex-1 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-1.5 text-xs font-mono text-[var(--hack-cyan)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-cyan)]/40"
          />
          <button
            onClick={() => setActiveContentSearch(true)}
            className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 px-3 py-1.5 text-[10px] font-mono uppercase text-[var(--hack-cyan)] hover:bg-[var(--hack-cyan)]/15"
          >
            Search
          </button>
          {activeContentSearch && (
            <button
              onClick={() => { setActiveContentSearch(false); setContentQ(""); load(); }}
              className="text-[10px] font-mono text-[var(--hack-gray)] hover:text-[var(--hack-red)]"
            >
              clear
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title="No investigations found"
          description={q || contentQ ? "No sessions match your filters. Try clearing them." : "Start your first investigation to see it here."}
          action={
            <button onClick={() => navigate({ name: "new" })} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20">
              + New Investigation
            </button>
          }
        />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center justify-between border border-[var(--hack-border)] bg-black/20 px-4 py-3 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition"
            >
              <button
                onClick={() => navigate({ name: "investigation", params: { id: item.id } })}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
              >
                {item.starred && <Star className="h-3.5 w-3.5 text-[var(--hack-amber)] fill-[var(--hack-amber)] shrink-0" />}
                <Tag color="gray">{item.input_type || "auto"}</Tag>
                <span className="truncate font-medium text-sm">{item.target}</span>
                {item.needs_review && <Tag color="amber">review</Tag>}
              </button>
              <div className="flex items-center gap-3 shrink-0">
                <Tag color={statusColor(item.status)}>{item.status}</Tag>
                {item.key_findings_count > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--hack-gray)]">
                    <FileText className="h-3 w-3" /> {item.key_findings_count}
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--hack-gray)]">
                  <Clock className="h-3 w-3" /> {new Date(item.created_at).toLocaleDateString()}
                </span>
                {item.tags.length > 0 && (
                  <div className="hidden md:flex items-center gap-1">
                    {item.tags.slice(0, 3).map((t) => <Tag key={t} color="cyan">{t}</Tag>)}
                  </div>
                )}
                <button
                  onClick={() => navigate({ name: "investigation-report", params: { id: item.id } })}
                  className="text-[var(--hack-gray)] hover:text-[var(--hack-green)] transition"
                  title="View report"
                  disabled={item.status !== "completed"}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-[var(--hack-gray)] hover:text-[var(--hack-red)] transition opacity-0 group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="mt-4 text-[10px] font-mono text-[var(--hack-gray)]/50 text-center">
          {"// showing "}{items.length} of {total}{" // click a row to open · star icon = starred"}
        </p>
      )}
    </div>
  );
}

// ─── Generic session list view (agents / discoveries / plans / monitors) ─────
// These session types are stored separately but browsed together here.

interface SessionListItem {
  id: string;
  target: string;
  status: string;
  created_at: string;
  completed_at?: string;
  count_field?: number;
}

export function SessionListView({ kind }: { kind: "agents" | "discoveries" | "plans" | "monitors" }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const config = {
    agents: { api: "/api/agent/investigate", routeName: "agent" as const, icon: History, title: "Agent Runs", subtitle: "// autonomous investigation sessions", accent: "cyan" as const },
    discoveries: { api: "/api/discover", routeName: "discovery" as const, icon: History, title: "Discovery Sessions", subtitle: "// recursive discovery sessions", accent: "amber" as const },
    plans: { api: "/api/plan", routeName: "plan" as const, icon: History, title: "Plan Sessions", subtitle: "// AI-planned investigation sessions", accent: "purple" as const },
    monitors: { api: "/api/monitor", routeName: "monitor" as const, icon: History, title: "Monitor Sessions", subtitle: "// live monitoring sessions", accent: "red" as const },
  }[kind];

  useEffect(() => {
    let cancelled = false;
    fetch(config.api)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const list = d.sessions || d.investigations || d.items || [];
        setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [config.api]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      <PageHeader
        icon={config.icon}
        title={config.title}
        subtitle={config.subtitle}
        accent={config.accent}
        actions={
          <button onClick={() => navigate({ name: "new" })} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20">
            + New
          </button>
        }
      />
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={config.icon}
          title={`No ${config.title.toLowerCase()} yet`}
          description="Start a new session from the command center."
          action={<button onClick={() => navigate({ name: "new" })} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20">+ New Session</button>}
        />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate({ name: config.routeName, params: { id: item.id } })}
              className="group flex w-full items-center justify-between border border-[var(--hack-border)] bg-black/20 px-4 py-3 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Tag color={statusColor(item.status)}>{item.status}</Tag>
                <span className="truncate text-sm">{item.target}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-[10px] font-mono text-[var(--hack-gray)]">
                <Clock className="h-3 w-3" /> {new Date(item.created_at).toLocaleString()}
                <ChevronRight className="h-4 w-4 group-hover:text-[var(--hack-green)] transition" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
