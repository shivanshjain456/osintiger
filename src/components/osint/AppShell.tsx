"use client";

// AppShell — the application root. Hosts the header, sidebar navigation,
// breadcrumbs, routed view surface, footer, and global dialogs.
//
// The active view is derived entirely from the URL hash via useRoute(). All
// navigation goes through the router so every screen is deep-linkable,
// bookmarkable, and back/forward-capable.

import { useState, useEffect, useCallback, useRef } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { MatrixRain } from "./MatrixRain";
import { HistoryDialog } from "./HistoryDialog";
import { CompareDialog } from "./CompareDialog";
import { DashboardDialog } from "./DashboardDialog";
import { SearchDialog } from "./SearchDialog";
import { TemplatePicker } from "./TemplatePicker";
import { KnowledgeBaseDialog } from "./KnowledgeBaseDialog";
import { LLMConfigDialog } from "./LLMConfigDialog";
import {
  initiateInvestigation,
  initiateAgentInvestigation,
  startDiscovery,
  startPlan,
  startMonitor,
} from "@/lib/osint/client";
import { useRoute, useNavigate, useRouteTitle } from "@/lib/router/useRouter";
import { useAuth } from "@/lib/supabase/auth-context";
import { RoutedViews } from "./routed/RoutedViews";
import { SidebarNav } from "./routed/SidebarNav";
import { RouteBreadcrumbs } from "./routed/RouteBreadcrumbs";
import { PlanBadge } from "./routed/PlanBadge";
import {
  History as HistoryIcon,
  GitCompare,
  LayoutDashboard,
  Search,
  Zap,
  Terminal,
  Library,
  Key,
  Menu,
  Bell,
  X,
} from "lucide-react";

export function AppShell() {
  const route = useRoute();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  useRouteTitle(); // keep document.title in sync with the route

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const [llmOpen, setLlmOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [homeKey, setHomeKey] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const goHome = useCallback(() => {
    navigate({ name: "home" });
    setHomeKey((k) => k + 1);
  }, [navigate]);

  // Poll unread notification count (only when authenticated, every 30s).
  useEffect(() => {
    // Don't poll until auth state is resolved, and don't poll for anonymous users.
    if (authLoading || !user) {
      queueMicrotask(() => setUnreadNotifs(0));
      return;
    }
    let cancelled = false;
    async function loadCount() {
      try {
        const r = await fetch("/api/notifications?filter=unread");
        if (!r.ok) return;
        const d = await r.json();
        if (!cancelled) setUnreadNotifs((d.notifications || []).length);
      } catch {
        // ignore
      }
    }
    loadCount();
    const t = setInterval(loadCount, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [authLoading, user]);

  // Keyboard shortcuts (preserved from legacy shell).
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "/" && !isInput && route.name === "home") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if ((e.key === "h" || e.key === "H") && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHistoryOpen(true);
      }
      if ((e.key === "c" || e.key === "C") && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCompareOpen(true);
      }
      if ((e.key === "d" || e.key === "D") && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setDashboardOpen(true);
      }
      if ((e.key === "f" || e.key === "F") && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.key === "t" || e.key === "T") && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setTemplatesOpen(true);
      }
      if ((e.key === "k" || e.key === "K") && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setKbOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setHistoryOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "P") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.key === "n" || e.key === "N") && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        navigate({ name: "new" });
      }
      if (e.key === "Escape" && !historyOpen && route.name !== "home") {
        if (!isInput) goHome();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [route.name, historyOpen, goHome, navigate]);

  // HomeView callbacks — wire the legacy investigation launchers to navigation.
  const homeCallbacks = {
    onInvestigate: (id: string, _target: string) => navigate({ name: "investigation", params: { id } }),
    onAgentInvestigate: (id: string, _target: string) => navigate({ name: "agent", params: { id } }),
    onStartDiscovery: async (target: string, inputType: string) => {
      try {
        const res = await startDiscovery(target, { input_type: inputType });
        navigate({ name: "discovery", params: { id: res.discovery_id } });
      } catch {
        // ignore
      }
    },
    onStartPlan: async (target: string, objective: string, inputType: string) => {
      try {
        const res = await startPlan(target, { objective, input_type: inputType });
        navigate({ name: "plan", params: { id: res.plan_id } });
      } catch {
        // ignore
      }
    },
    onStartMonitor: async (target: string, inputType: string) => {
      try {
        const res = await startMonitor(target, { input_type: inputType });
        navigate({ name: "monitor", params: { id: res.monitor_id } });
      } catch {
        // ignore
      }
    },
    onOpenHistory: () => setHistoryOpen(true),
    searchInputRef,
    homeKey,
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <MatrixRain />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Header
          onHome={goHome}
          onMenu={() => setSidebarOpen(true)}
          onHistory={() => setHistoryOpen(true)}
          onCompare={() => setCompareOpen(true)}
          onDashboard={() => setDashboardOpen(true)}
          onSearch={() => setSearchOpen(true)}
          onTemplates={() => setTemplatesOpen(true)}
          onKb={() => setKbOpen(true)}
          onLlm={() => setLlmOpen(true)}
          onNotifications={() => setNotifOpen(true)}
          unreadNotifs={unreadNotifs}
        />

        <div className="flex flex-1 w-full">
          <SidebarNav open={sidebarOpen} onOpenChange={setSidebarOpen} />
          <main id="main-content" className="flex-1 min-w-0 w-full">
            {/* Breadcrumbs on every non-home route */}
            {route.name !== "home" && (
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
                <RouteBreadcrumbs />
              </div>
            )}
            <RoutedViews homeCallbacks={homeCallbacks} />
          </main>
        </div>

        <Footer />

        {/* Global dialogs (also reachable as routes, kept for power-user access) */}
        <HistoryDialog
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          onSelect={(id, _target) => navigate({ name: "investigation", params: { id } })}
        />
        <CompareDialog open={compareOpen} onOpenChange={setCompareOpen} />
        <DashboardDialog
          open={dashboardOpen}
          onOpenChange={setDashboardOpen}
          onSelect={(id, _target) => navigate({ name: "investigation", params: { id } })}
        />
        <SearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSelect={(id, _target) => navigate({ name: "investigation", params: { id } })}
        />
        <TemplatePicker
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
          onSelect={async (template, target) => {
            try {
              const res = await initiateInvestigation(target, { input_type: template.inputType });
              navigate({ name: "investigation", params: { id: res.investigation_id } });
            } catch {
              // ignore
            }
          }}
        />
        <KnowledgeBaseDialog open={kbOpen} onOpenChange={setKbOpen} />
        <LLMConfigDialog open={llmOpen} onOpenChange={setLlmOpen} />
        <NotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} onClear={() => setUnreadNotifs(0)} />
      </div>
    </div>
  );
}

function Header({
  onHome,
  onMenu,
  onHistory,
  onCompare,
  onDashboard,
  onSearch,
  onTemplates,
  onKb,
  onLlm,
  onNotifications,
  unreadNotifs,
}: {
  onHome: () => void;
  onMenu: () => void;
  onHistory: () => void;
  onCompare: () => void;
  onDashboard: () => void;
  onSearch: () => void;
  onTemplates: () => void;
  onKb: () => void;
  onLlm: () => void;
  onNotifications: () => void;
  unreadNotifs: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--hack-border)] bg-[var(--hack-bg)]/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onMenu}
              className="xl:hidden flex items-center justify-center h-8 w-8 border border-[var(--hack-border)] text-[var(--hack-green)] hover:bg-[var(--hack-green)]/10 transition shrink-0"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button onClick={onHome} className="group flex items-center gap-3 min-w-0">
              <HackLogo />
              <div className="text-left leading-none min-w-0">
                <div className="font-bold text-base tracking-tight text-[var(--hack-green)] glitch-hover truncate">
                  OSIN<span className="text-[var(--hack-cyan)]">Tiger</span>
                </div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-[var(--hack-gray)] font-mono hidden sm:block">
                  {"// ANONYMOUS INTELLIGENCE"}
                </div>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <button
              onClick={onTemplates}
              className="flex items-center gap-1.5 border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 px-2.5 py-1 text-[11px] text-[var(--hack-green)] uppercase font-mono tracking-wider transition hover:bg-[var(--hack-green)]/15 hover:glow-green"
              title="Investigation templates (T)"
            >
              <Zap className="h-3 w-3" />
              <span className="hidden lg:inline">Tmpl</span>
            </button>
            <button
              onClick={onSearch}
              className="flex items-center gap-1.5 border border-[var(--hack-border)] bg-transparent px-2.5 py-1 text-[11px] text-[var(--hack-gray)] uppercase font-mono tracking-wider transition hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)]"
              title="Full-text search (F)"
            >
              <Search className="h-3 w-3" />
              <span className="hidden lg:inline">Search</span>
            </button>
            <button
              onClick={onHistory}
              className="flex items-center gap-1.5 border border-[var(--hack-border)] bg-transparent px-2.5 py-1 text-[11px] text-[var(--hack-gray)] uppercase font-mono tracking-wider transition hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)]"
              title="History (H or ⌘K)"
            >
              <HistoryIcon className="h-3 w-3" />
              <span className="hidden md:inline">Hist</span>
              <kbd className="hidden md:inline text-[8px] text-[var(--hack-gray)]/60 ml-0.5">⌘K</kbd>
            </button>
            <button
              onClick={onCompare}
              className="flex items-center gap-1.5 border border-[var(--hack-border)] bg-transparent px-2.5 py-1 text-[11px] text-[var(--hack-gray)] uppercase font-mono tracking-wider transition hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)]"
              title="Compare (C)"
            >
              <GitCompare className="h-3 w-3" />
              <span className="hidden lg:inline">Diff</span>
            </button>
            <button
              onClick={onDashboard}
              className="flex items-center gap-1.5 border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 px-2.5 py-1 text-[11px] text-[var(--hack-green)] uppercase font-mono tracking-wider transition hover:bg-[var(--hack-green)]/15"
              title="Dashboard (D)"
            >
              <LayoutDashboard className="h-3 w-3" />
              <span className="hidden lg:inline">Stats</span>
            </button>
            <button
              onClick={onKb}
              className="flex items-center gap-1.5 border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/5 px-2.5 py-1 text-[11px] text-[var(--hack-cyan)] uppercase font-mono tracking-wider transition hover:bg-[var(--hack-cyan)]/15"
              title="Knowledge Base (K)"
            >
              <Library className="h-3 w-3" />
              <span className="hidden md:inline">KB</span>
              <kbd className="hidden lg:inline text-[8px] text-[var(--hack-cyan)]/60 ml-0.5">K</kbd>
            </button>
            <button
              onClick={onNotifications}
              className="relative flex items-center justify-center border border-[var(--hack-border)] bg-transparent h-7 w-7 text-[var(--hack-gray)] uppercase font-mono transition hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)]"
              title="Notifications"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center bg-[var(--hack-red)] text-[8px] font-bold text-white px-0.5 rounded-full">
                  {unreadNotifs > 9 ? "9+" : unreadNotifs}
                </span>
              )}
            </button>
            <button
              onClick={onLlm}
              className="flex items-center gap-1.5 border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 px-2.5 py-1 text-[11px] text-[var(--hack-green)] uppercase font-mono tracking-wider transition hover:bg-[var(--hack-green)]/15"
              title="BYO-LLM Configuration"
            >
              <Key className="h-3 w-3" />
              <span className="hidden lg:inline">AI</span>
            </button>
            <PlanBadge />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

// Lightweight notifications drawer (quick access from header bell).
function NotificationsDrawer({ open, onOpenChange, onClear }: { open: boolean; onOpenChange: (o: boolean) => void; onClear: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => setLoading(true));
    fetch("/api/notifications?filter=unread")
      .then((r) => r.json())
      .then((d) => setItems((d.notifications || []).slice(0, 10)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems([]);
    onClear();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" onClick={() => onOpenChange(false)}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-sm border-l border-[var(--hack-border)] bg-[var(--hack-bg)] p-4 overflow-y-auto custom-scroll"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-green)]">{"// NOTIFICATIONS"}</span>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button onClick={markAllRead} className="text-[10px] font-mono text-[var(--hack-cyan)] hover:underline">mark all read</button>
            )}
            <button onClick={() => onOpenChange(false)} className="text-[var(--hack-gray)] hover:text-[var(--hack-green)]"><X className="h-4 w-4" /></button>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><div className="h-5 w-5 border-2 border-[var(--hack-green)] border-t-transparent rounded-full animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-8 w-8 text-[var(--hack-gray)]/40 mx-auto mb-2" />
            <p className="text-xs font-mono text-[var(--hack-gray)]">All caught up.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => { onOpenChange(false); if (n.routeName) navigate({ name: n.routeName as "investigation" } as never); }}
                className="block w-full text-left border border-[var(--hack-border)] bg-black/20 p-2.5 hover:bg-[var(--hack-green)]/5 transition"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="h-1.5 w-1.5 bg-[var(--hack-green)] rounded-full" />
                  <span className="font-mono text-[11px] text-[var(--hack-green)] truncate">{n.title}</span>
                </div>
                {n.body && <p className="text-[10px] font-mono text-[var(--hack-gray)] ml-3 truncate">{n.body}</p>}
                <p className="text-[9px] font-mono text-[var(--hack-gray)]/50 ml-3 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
              </button>
            ))}
            <button onClick={() => { onOpenChange(false); navigate({ name: "notifications" }); }} className="w-full text-center text-[10px] font-mono text-[var(--hack-cyan)] hover:underline py-2">
              View all notifications →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--hack-border)] bg-[var(--hack-bg)]/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-[var(--hack-gray)] font-mono">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[var(--hack-green)]" />
            <span className="text-[var(--hack-green)]">root@osintiger</span>
            <span>:</span>
            <span className="text-[var(--hack-cyan)]">~</span>
            <span>$</span>
            <span className="text-[var(--hack-gray)]">--secure-mode</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span>[SOURCE] attribution enforced</span>
            <span className="text-[var(--hack-green)]/30">|</span>
            <span>zero-hallucination protocol</span>
            <span className="text-[var(--hack-green)]/30">|</span>
            <span>public-data only</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <kbd className="border border-[var(--hack-border)] px-1 py-0.5 text-[9px] text-[var(--hack-gray)]">/</kbd>
            <span className="text-[9px]">search</span>
            <kbd className="border border-[var(--hack-border)] px-1 py-0.5 text-[9px] text-[var(--hack-gray)]">N</kbd>
            <span className="text-[9px]">new</span>
            <kbd className="border border-[var(--hack-border)] px-1 py-0.5 text-[9px] text-[var(--hack-gray)]">H</kbd>
            <span className="text-[9px]">hist</span>
            <kbd className="border border-[var(--hack-border)] px-1 py-0.5 text-[9px] text-[var(--hack-gray)]">D</kbd>
            <span className="text-[9px]">stats</span>
            <kbd className="border border-[var(--hack-cyan)]/40 px-1 py-0.5 text-[9px] text-[var(--hack-cyan)]">K</kbd>
            <span className="text-[9px]">kb</span>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-[var(--hack-gray)]/60 text-center md:text-left font-mono">
          {"// For research & educational use. Users are responsible for compliance with applicable laws and source ToS. Sanctions screening is a tool only — definitive status requires manual verification."}
        </p>
      </div>
    </footer>
  );
}

function HackLogo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5">
      <Terminal className="h-4 w-4 text-[var(--hack-green)]" />
    </div>
  );
}
