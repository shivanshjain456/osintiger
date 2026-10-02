"use client";

// Sidebar navigation drawer — the primary discoverability surface for the
// full route tree. Groups routes by domain (investigations, KB, analytics, …).
// Slides in from the left on all viewports; pinned open on xl screens.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { ROUTE_PATTERNS, ROUTE_GROUPS } from "@/lib/router/registry";
import type { Route, RouteGroup, RouteName } from "@/lib/router/types";
import { useRoute, useNavigate } from "@/lib/router/useRouter";
import { serializeRoute as serialize } from "@/lib/router/router";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Resolve a string icon name to a Lucide component (case-sensitive lookup).
function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[name] || LucideIcons.Circle;
  return <Cmp className={className} />;
}

// Routes that appear in the sidebar (some like not-found/error/maintenance are
// hidden — they're reached only via redirects).
const HIDDEN = new Set<RouteName>(["not-found", "error", "maintenance"]);

// Primary route per group (the entry point when clicking a group header).
const GROUP_HOME: Record<RouteGroup, RouteName> = {
  core: "home",
  investigations: "investigations",
  "knowledge-base": "kb",
  analytics: "dashboard",
  provenance: "provenance",
  tools: "tools",
  collections: "collections",
  notifications: "notifications",
  settings: "settings",
  system: "system",
  docs: "docs",
  support: "support",
  billing: "pricing",
  error: "home",
};

export function SidebarNav({ open, onOpenChange }: Props) {
  const route = useRoute();
  const navigate = useNavigate();
  const activeName = route.name;

  // Lock body scroll when drawer is open on small screens.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function go(r: Route) {
    navigate(r);
    onOpenChange(false);
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm xl:hidden"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-72 transform border-r border-[var(--hack-border)] bg-[var(--hack-bg)] transition-transform duration-200 xl:sticky xl:top-14 xl:z-30 xl:h-[calc(100vh-3.5rem)] xl:translate-x-0 xl:bg-[var(--hack-bg)]/60 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Drawer header (mobile only) */}
          <div className="flex items-center justify-between border-b border-[var(--hack-border)] px-4 py-3 xl:hidden">
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-green)]">
              {"// NAVIGATION"}
            </span>
            <button
              onClick={() => onOpenChange(false)}
              className="text-[var(--hack-gray)] hover:text-[var(--hack-green)]"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable nav tree */}
          <nav className="flex-1 overflow-y-auto custom-scroll px-2 py-3" aria-label="Main navigation">
            {ROUTE_GROUPS.map((g) => {
              const groupRoutes = ROUTE_PATTERNS.filter((r) => r.group === g.group && !HIDDEN.has(r.name));
              if (groupRoutes.length === 0) return null;
              return (
                <div key={g.group} className="mb-4">
                  <button
                    onClick={() => go({ name: GROUP_HOME[g.group] } as Route)}
                    className="group flex w-full items-center gap-2 px-2 py-1.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--hack-gray)] hover:text-[var(--hack-green)] transition"
                  >
                    <Icon name={g.icon} className="h-3 w-3" />
                    {g.label}
                  </button>
                  <ul className="mt-0.5 space-y-0.5">
                    {groupRoutes.map((r) => {
                      const isActive = activeName === r.name;
                      // Build a representative route for navigation. List/index
                      // routes have no params; detail routes navigate to their
                      // list (the user picks an item there).
                      const navRoute = listRouteFor(r.name);
                      return (
                        <li key={r.name}>
                          <button
                            onClick={() => navRoute && go(navRoute)}
                            disabled={!navRoute}
                            className={`group flex w-full items-center gap-2 border-l-2 px-2.5 py-1.5 text-left text-xs font-mono transition ${
                              isActive
                                ? "border-[var(--hack-green)] bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
                                : "border-transparent text-[var(--hack-gray)] hover:border-[var(--hack-green)]/40 hover:bg-black/20 hover:text-[var(--hack-green)]"
                            } ${!navRoute ? "opacity-50 cursor-not-allowed" : ""}`}
                            title={r.title}
                          >
                            <Icon name={r.icon} className={`h-3.5 w-3.5 ${isActive ? "text-[var(--hack-green)]" : "text-[var(--hack-gray)]/70 group-hover:text-[var(--hack-green)]"}`} />
                            <span className="truncate">{r.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>

          {/* Footer status */}
          <div className="border-t border-[var(--hack-border)] px-3 py-2">
            <div className="flex items-center gap-2 text-[9px] font-mono text-[var(--hack-gray)]/60">
              <span className="h-1.5 w-1.5 bg-[var(--hack-green)] pulse-green rounded-full" />
              <span>{"// ACTIVE ROUTE"}</span>
              <code className="ml-auto text-[var(--hack-cyan)]/80 truncate max-w-[120px]">
                {serialize(route).replace(/^#/, "")}
              </code>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

// Map a route name to a navigable list/index route. Detail routes (which need
// an id) return their parent list so the sidebar always navigates somewhere
// useful instead of erroring.
function listRouteFor(name: RouteName): Route | null {
  switch (name) {
    case "home":
      return { name: "home" };
    case "new":
      return { name: "new" };
    case "sitemap":
      return { name: "sitemap" };
    case "investigations":
    case "investigation":
    case "investigation-report":
      return { name: "investigations" };
    case "agents":
    case "agent":
      return { name: "agents" };
    case "discoveries":
    case "discovery":
      return { name: "discoveries" };
    case "plans":
    case "plan":
      return { name: "plans" };
    case "monitors":
    case "monitor":
    case "monitor-snapshots":
    case "monitor-alerts":
      return { name: "monitors" };
    case "kb":
      return { name: "kb" };
    case "kb-entities":
    case "kb-entity":
      return { name: "kb-entities" };
    case "kb-relationships":
      return { name: "kb-relationships" };
    case "kb-evidence":
      return { name: "kb-evidence" };
    case "kb-conflicts":
      return { name: "kb-conflicts" };
    case "kb-versions":
      return { name: "kb-versions" };
    case "kb-graph":
      return { name: "kb-graph" };
    case "kb-search":
      return { name: "kb-search" };
    case "dashboard":
      return { name: "dashboard" };
    case "analytics-sources":
      return { name: "analytics-sources" };
    case "analytics-versions":
      return { name: "analytics-versions" };
    case "analytics-provenance":
      return { name: "analytics-provenance" };
    case "provenance":
    case "provenance-investigation":
    case "provenance-trace":
      return { name: "provenance" };
    case "audit":
      return { name: "audit" };
    case "tools":
      return { name: "tools" };
    case "tool-visual":
      return { name: "tool-visual" };
    case "tool-crypto":
      return { name: "tool-crypto" };
    case "tool-sanctions":
      return { name: "tool-sanctions" };
    case "tool-batch":
      return { name: "tool-batch" };
    case "tools-playbooks":
      return { name: "tools-playbooks" };
    case "collections":
    case "collection":
      return { name: "collections" };
    case "bookmarks":
      return { name: "bookmarks" };
    case "starred":
      return { name: "starred" };
    case "tags":
      return { name: "tags" };
    case "notifications":
      return { name: "notifications" };
    case "activity":
      return { name: "activity" };
    case "settings":
    case "settings-llm":
    case "settings-preferences":
    case "settings-api-keys":
    case "settings-notifications":
    case "settings-export":
    case "settings-import":
      return { name: "settings" };
    case "system":
    case "system-status":
    case "system-health":
    case "system-diagnostics":
    case "system-scheduler":
    case "system-queues":
    case "system-metrics":
      return { name: "system" };
    case "docs":
    case "docs-playbooks":
    case "docs-api":
    case "docs-changelog":
    case "docs-about":
    case "docs-privacy":
    case "docs-terms":
    case "docs-legal":
      return { name: "docs" };
    case "support":
      return { name: "support" };
    case "feedback":
      return { name: "feedback" };
    case "pricing":
      return { name: "pricing" };
    case "billing":
    case "billing-invoices":
    case "billing-credits":
    case "billing-api-keys":
    case "login":
    case "signup":
    case "forgot-password":
    case "reset-password":
    case "verify-email":
    case "account":
      return { name: "billing" };
    default:
      return null;
  }
}
