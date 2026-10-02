"use client";

// Collections, bookmarks, starred, tags, notifications, activity feed, and
// audit log views. These surface user-curated and system-recorded data through
// dedicated, filterable, deep-linkable routes.

import { useEffect, useState, useCallback } from "react";
import {
  Folder,
  Bookmark,
  Star,
  Tags as TagsIcon,
  Bell,
  Activity as ActivityIcon,
  ScrollText,
  ChevronRight,
  Loader2,
  Trash2,
  CheckCheck,
  FolderPlus,
  Clock,
  Filter,
} from "lucide-react";
import { PageHeader, SectionHeader, EmptyState, Tag, StatCard } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate } from "@/lib/router/useRouter";
import { fetchRecentWithFilters } from "@/lib/osint/client";
import type { HistoryItem } from "@/lib/osint/client";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      {children}
    </div>
  );
}

// ─── Collections ─────────────────────────────────────────────────────────────
interface CollectionItem { id: string; name: string; description: string; type: string; itemCount: number; isPinned: boolean; createdAt: string; updatedAt: string }
export function CollectionsView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(() => {
    queueMicrotask(() => setLoading(true));
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => setItems(d.collections || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createCollection() {
    if (!newName.trim()) return;
    await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: "" }),
    });
    setNewName("");
    setCreating(false);
    load();
  }

  async function deleteCollection(id: string) {
    if (!confirm("Delete this collection?")) return;
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <Shell>
      <PageHeader icon={Folder} title="Collections" subtitle={`// ${items.length} curated group${items.length === 1 ? "" : "s"}`}
        actions={<button onClick={() => setCreating(true)} className="flex items-center gap-1.5 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20"><FolderPlus className="h-3.5 w-3.5" /> New</button>} />
      {creating && (
        <div className="mb-4 flex gap-2 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 p-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createCollection()} placeholder="Collection name…" autoFocus className="flex-1 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-1.5 text-sm font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/40" />
          <button onClick={createCollection} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-3 py-1.5 text-xs font-mono uppercase text-[var(--hack-green)]">Create</button>
          <button onClick={() => setCreating(false)} className="text-xs font-mono text-[var(--hack-gray)] hover:text-[var(--hack-red)]">cancel</button>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Folder} title="No collections yet" description="Create a collection to group related investigations, entities, or findings." action={<button onClick={() => setCreating(true)} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20">+ New Collection</button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => (
            <div key={c.id} className="group border border-[var(--hack-border)] bg-black/20 p-4 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition">
              <button onClick={() => navigate({ name: "collection", params: { id: c.id } })} className="block w-full text-left">
                <div className="flex items-center justify-between mb-2">
                  <Folder className="h-5 w-5 text-[var(--hack-green)]" />
                  <Tag color={c.type === "saved_search" ? "cyan" : c.type === "smart" ? "purple" : "gray"}>{c.type}</Tag>
                </div>
                <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] truncate">{c.name}</h3>
                <p className="text-xs text-[var(--hack-gray)] mt-1 line-clamp-2">{c.description || "No description"}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-[var(--hack-gray)]/60">
                  <span>{c.itemCount} items</span>
                  <span>·</span>
                  <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                </div>
              </button>
              <button onClick={() => deleteCollection(c.id)} className="mt-2 text-[10px] font-mono text-[var(--hack-gray)] hover:text-[var(--hack-red)] opacity-0 group-hover:opacity-100 transition">delete</button>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function CollectionDetailView({ id }: { id: string }) {
  const navigate = useNavigate();
  const [collection, setCollection] = useState<CollectionItem | null>(null);
  const [items, setItems] = useState<Array<{ id: string; itemType: string; itemId: string; note: string; addedAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/collections/${id}`)
      .then((r) => r.json())
      .then((d) => { setCollection(d.collection || null); setItems(d.items || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Shell><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div></Shell>;
  if (!collection) return <Shell><EmptyState icon={Folder} title="Collection not found" /></Shell>;

  return (
    <Shell>
      <PageHeader icon={Folder} title={collection.name} subtitle={collection.description || `// ${items.length} items`} />
      {items.length === 0 ? (
        <EmptyState icon={Folder} title="Empty collection" description="Add investigations or entities to this collection." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)]">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => {
                if (it.itemType === "investigation") navigate({ name: "investigation", params: { id: it.itemId } });
              }}
              className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-[var(--hack-green)]/5 transition text-left"
            >
              <div className="flex items-center gap-3">
                <Tag color="cyan">{it.itemType}</Tag>
                <code className="text-xs text-[var(--hack-green)]">{it.itemId.slice(0, 12)}</code>
                {it.note && <span className="text-xs text-[var(--hack-gray)]">— {it.note}</span>}
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--hack-gray)]" />
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Bookmarks ───────────────────────────────────────────────────────────────
export function BookmarksView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentWithFilters("", "all", 200)
      .then((d) => setItems(d.investigations.filter((i) => (i.bookmarked_findings || []).length > 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <PageHeader icon={Bookmark} title="Bookmarks" subtitle={`// ${items.length} investigation${items.length === 1 ? "" : "s"} with bookmarked findings`} accent="cyan" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Bookmark} title="No bookmarks yet" description="Bookmark key findings within an investigation's report to see them here." />
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <button key={i.id} onClick={() => navigate({ name: "investigation-report", params: { id: i.id } })} className="group flex w-full items-center justify-between border border-[var(--hack-border)] bg-black/20 px-4 py-3 hover:border-[var(--hack-cyan)]/40 hover:bg-[var(--hack-cyan)]/5 transition text-left">
              <div className="flex items-center gap-3 min-w-0">
                <Bookmark className="h-4 w-4 text-[var(--hack-cyan)] shrink-0" />
                <span className="truncate text-sm">{i.target}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono text-[var(--hack-gray)]">
                <Tag color="cyan">{i.bookmarked_findings.length} bookmarked</Tag>
                <ChevronRight className="h-4 w-4 group-hover:text-[var(--hack-cyan)]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Starred ─────────────────────────────────────────────────────────────────
export function StarredView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentWithFilters("", "all", 200, true)
      .then((d) => setItems(d.investigations))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <Shell>
      <PageHeader icon={Star} title="Starred" subtitle={`// ${items.length} starred investigation${items.length === 1 ? "" : "s"}`} accent="amber" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Star} title="Nothing starred yet" description="Star important investigations to find them quickly here." />
      ) : (
        <div className="space-y-1.5">
          {items.map((i) => (
            <button key={i.id} onClick={() => navigate({ name: "investigation", params: { id: i.id } })} className="group flex w-full items-center justify-between border border-[var(--hack-border)] bg-black/20 px-4 py-3 hover:border-[var(--hack-amber)]/40 hover:bg-[var(--hack-amber)]/5 transition text-left">
              <div className="flex items-center gap-3 min-w-0">
                <Star className="h-4 w-4 text-[var(--hack-amber)] fill-[var(--hack-amber)] shrink-0" />
                <span className="truncate text-sm">{i.target}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono text-[var(--hack-gray)]">
                <Clock className="h-3 w-3" /> {new Date(i.created_at).toLocaleDateString()}
                <ChevronRight className="h-4 w-4 group-hover:text-[var(--hack-amber)]" />
              </div>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Tags ────────────────────────────────────────────────────────────────────
export function TagsView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentWithFilters("", "all", 200)
      .then((d) => setItems(d.investigations))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Aggregate tag counts
  const tagMap = new Map<string, { count: number; items: HistoryItem[] }>();
  items.forEach((i) => i.tags.forEach((t) => {
    if (!tagMap.has(t)) tagMap.set(t, { count: 0, items: [] });
    const e = tagMap.get(t)!;
    e.count++;
    e.items.push(i);
  }));
  const tags = Array.from(tagMap.entries()).sort((a, b) => b[1].count - a[1].count);

  return (
    <Shell>
      <PageHeader icon={TagsIcon} title="Tags" subtitle={`// ${tags.length} unique tag${tags.length === 1 ? "" : "s"}`} accent="purple" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : tags.length === 0 ? (
        <EmptyState icon={TagsIcon} title="No tags yet" description="Tag investigations to organize and filter them by topic." />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map(([tag, info]) => (
            <button key={tag} onClick={() => navigate({ name: "tags", query: { tag } })} className="group flex items-center gap-2 border border-[var(--hack-border)] bg-black/20 px-3 py-2 hover:border-[var(--hack-purple)]/40 hover:bg-[var(--hack-purple)]/5 transition">
              <TagsIcon className="h-3.5 w-3.5 text-[var(--hack-purple)]" />
              <span className="font-mono text-xs text-[var(--hack-gray)] group-hover:text-[var(--hack-purple)]">{tag}</span>
              <Tag color="purple">{info.count}</Tag>
            </button>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Notifications ───────────────────────────────────────────────────────────
interface NotificationItem { id: string; type: string; title: string; body: string; severity: string; category: string; isRead: boolean; createdAt: string; routeName?: string; routeParamsJson?: string }
export function NotificationsView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    queueMicrotask(() => setLoading(true));
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setItems(d.notifications || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    load();
  }
  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    load();
  }
  async function dismiss(id: string) {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = filter === "unread" ? items.filter((i) => !i.isRead) : items;
  const unreadCount = items.filter((i) => !i.isRead).length;

  return (
    <Shell>
      <PageHeader icon={Bell} title="Notifications" subtitle={`// ${unreadCount} unread of ${items.length}`}
        actions={unreadCount > 0 ? <button onClick={markAllRead} className="flex items-center gap-1.5 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20"><CheckCheck className="h-3.5 w-3.5" /> Mark all read</button> : undefined} />
      <div className="mb-3 flex items-center gap-2">
        <Filter className="h-3.5 w-3.5 text-[var(--hack-gray)]" />
        {["all", "unread"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`border px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${filter === f ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]" : "border-[var(--hack-border)] text-[var(--hack-gray)] hover:text-[var(--hack-green)]"}`}>{f}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up. New events will appear here." />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[600px] overflow-y-auto custom-scroll">
          {filtered.map((n) => {
            const sev = n.severity === "error" ? "red" : n.severity === "warning" ? "amber" : n.severity === "success" ? "green" : "cyan";
            return (
              <div key={n.id} className={`px-4 py-3 ${!n.isRead ? "bg-[var(--hack-green)]/5" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => { if (!n.isRead) markRead(n.id); if (n.routeName) navigate({ name: n.routeName as "investigation" } as never); }}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      {!n.isRead && <span className="h-2 w-2 bg-[var(--hack-green)] rounded-full pulse-green shrink-0" />}
                      <span className={`font-mono text-xs font-semibold ${n.isRead ? "text-[var(--hack-gray)]" : "text-[var(--hack-green)]"}`}>{n.title}</span>
                      <Tag color={sev as "red" | "amber" | "green" | "cyan"}>{n.severity}</Tag>
                      <Tag color="gray">{n.category}</Tag>
                    </div>
                    {n.body && <p className="text-xs text-[var(--hack-gray)] font-mono ml-4">{n.body}</p>}
                    <p className="text-[9px] text-[var(--hack-gray)]/50 font-mono ml-4 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </button>
                  <button onClick={() => dismiss(n.id)} className="text-[var(--hack-gray)] hover:text-[var(--hack-red)] shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

// ─── Activity feed ───────────────────────────────────────────────────────────
export function ActivityView() {
  const { data, loading } = useAuditData();
  return (
    <Shell>
      <PageHeader icon={ActivityIcon} title="Activity Feed" subtitle="// recent system & user actions" accent="cyan" />
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : data && data.events.length > 0 ? (
        <AuditTimeline events={data.events.slice(0, 100)} />
      ) : (
        <EmptyState icon={ActivityIcon} title="No activity yet" description="Actions you take will appear here in real time." />
      )}
    </Shell>
  );
}

// ─── Audit log ───────────────────────────────────────────────────────────────
interface AuditEvent {
  id: string;
  timestamp: string;
  actorType: string;
  actorId: string;
  action: string;
  category: string;
  resourceType: string;
  resourceId: string;
  targetType: string;
  detail: string;
  severity: string;
  outcome: string;
  durationMs: number;
}

function useAuditData(category?: string) {
  const [data, setData] = useState<{ events: AuditEvent[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    queueMicrotask(() => setLoading(true));
    const params = new URLSearchParams({ limit: "200" });
    if (category) params.set("category", category);
    fetch(`/api/audit?${params}`)
      .then((r) => r.json())
      .then((d) => setData({ events: d.events || [], total: d.total || 0 }))
      .catch(() => setData({ events: [], total: 0 }))
      .finally(() => setLoading(false));
  }, [category]);
  return { data, loading };
}

export function AuditView() {
  const [category, setCategory] = useState("all");
  const { data, loading } = useAuditData(category === "all" ? undefined : category);
  const cats = ["all", "investigation", "config", "data", "system", "export"];

  return (
    <Shell>
      <PageHeader icon={ScrollText} title="Audit Log" subtitle={data ? `// ${data.total} event${data.total === 1 ? "" : "s"} recorded` : "// loading"} accent="purple" />
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Filter className="h-3.5 w-3.5 text-[var(--hack-gray)]" />
        {cats.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`border px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${category === c ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]" : "border-[var(--hack-border)] text-[var(--hack-gray)] hover:text-[var(--hack-green)]"}`}>{c}</button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)]" /></div>
      ) : data && data.events.length > 0 ? (
        <AuditTimeline events={data.events} />
      ) : (
        <EmptyState icon={ScrollText} title="No audit events" description="System and user actions will be recorded here." />
      )}
    </Shell>
  );
}

function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/20 divide-y divide-[var(--hack-border)] max-h-[700px] overflow-y-auto custom-scroll">
      {events.map((e) => {
        const sev = e.severity === "critical" ? "red" : e.severity === "error" ? "red" : e.severity === "warning" ? "amber" : e.severity === "info" ? "cyan" : "green";
        return (
          <div key={e.id} className="px-4 py-2.5 hover:bg-[var(--hack-green)]/5 transition">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <Tag color={sev as "red" | "amber" | "green" | "cyan"}>{e.severity}</Tag>
                <code className="text-xs text-[var(--hack-green)]">{e.action}</code>
                {e.resourceType && <Tag color="gray">{e.resourceType}</Tag>}
                {e.targetType && <span className="text-xs text-[var(--hack-gray)]">→ {e.targetType}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[9px] font-mono text-[var(--hack-gray)]/60">
                {e.durationMs > 0 && <span>{e.durationMs}ms</span>}
                <span>{new Date(e.timestamp).toLocaleString()}</span>
              </div>
            </div>
            {e.detail && <p className="text-xs text-[var(--hack-gray)] font-mono mt-1 ml-2">{e.detail}</p>}
            <div className="flex items-center gap-2 mt-1 ml-2 text-[9px] font-mono text-[var(--hack-gray)]/50">
              <span>actor: {e.actorType}{e.actorId ? `:${e.actorId.slice(0, 12)}` : ""}</span>
              <span>·</span>
              <Tag color={e.outcome === "success" ? "green" : e.outcome === "failure" ? "red" : "amber"}>{e.outcome}</Tag>
            </div>
          </div>
        );
      })}
    </div>
  );
}
