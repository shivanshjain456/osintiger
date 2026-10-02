// SPA Router — Type definitions
// OSINTiger uses a single Next.js page route ("/") and a client-side hash router
// for all navigation. This gives us deep-linkable, bookmarkable, back/forward-
// capable URLs while respecting the single-page-route constraint.

// Every route in the application is represented here as a discriminated union.
// Adding a new route: (1) add a variant here, (2) add a pattern to ROUTE_PATTERNS,
// (3) add a parser/serializer in router.ts, (4) add a case in AppShell render.

export type Route =
  // ── Core landing ──────────────────────────────────────────────────────────
  | { name: "home" }

  // ── New investigation launcher ────────────────────────────────────────────
  | { name: "new"; params?: { mode?: "standard" | "agent" | "discovery" | "plan" | "monitor"; target?: string } }

  // ── Investigations (standard pipeline) ────────────────────────────────────
  | { name: "investigations" } // list / history
  | { name: "investigation"; params: { id: string } } // progress view
  | { name: "investigation-report"; params: { id: string } } // report view

  // ── Autonomous Agent ───────────────────────────────────────────────────────
  | { name: "agents" } // list
  | { name: "agent"; params: { id: string } } // live agent view

  // ── Recursive Discovery ────────────────────────────────────────────────────
  | { name: "discoveries" } // list
  | { name: "discovery"; params: { id: string } } // live discovery view

  // ── AI Plan ────────────────────────────────────────────────────────────────
  | { name: "plans" } // list
  | { name: "plan"; params: { id: string } } // live plan view

  // ── Live Monitoring ────────────────────────────────────────────────────────
  | { name: "monitors" } // list
  | { name: "monitor"; params: { id: string } } // live monitor view
  | { name: "monitor-snapshots"; params: { id: string } } // snapshot history
  | { name: "monitor-alerts"; params: { id: string } } // alerts feed

  // ── Knowledge Base ─────────────────────────────────────────────────────────
  | { name: "kb" } // dashboard
  | { name: "kb-entities"; query?: { type?: string; q?: string } }
  | { name: "kb-entity"; params: { id: string }; query?: { tab?: string } }
  | { name: "kb-relationships" }
  | { name: "kb-evidence"; query?: { entityId?: string; source?: string } }
  | { name: "kb-conflicts"; query?: { status?: string } }
  | { name: "kb-versions"; query?: { entityType?: string; recordId?: string } }
  | { name: "kb-graph"; query?: { focus?: string } }
  | { name: "kb-search"; query?: { q?: string } }

  // ── Analytics & Dashboards ─────────────────────────────────────────────────
  | { name: "dashboard" } // main analytics dashboard
  | { name: "analytics-sources"; query?: { target?: string } }
  | { name: "analytics-versions"; query?: { target?: string } }
  | { name: "analytics-provenance" }

  // ── Provenance & Audit ─────────────────────────────────────────────────────
  | { name: "provenance"; query?: { investigationId?: string; eventType?: string } }
  | { name: "provenance-investigation"; params: { id: string } }
  | { name: "provenance-trace"; params: { evidenceId: string } }
  | { name: "audit"; query?: { actor?: string; action?: string } }

  // ── Tools ──────────────────────────────────────────────────────────────────
  | { name: "tools" } // tools index
  | { name: "tool-visual" }
  | { name: "tool-crypto" }
  | { name: "tool-sanctions" }
  | { name: "tool-batch" }
  | { name: "tools-playbooks" }

  // ── Collections, Bookmarks, Tags ───────────────────────────────────────────
  | { name: "collections" }
  | { name: "collection"; params: { id: string } }
  | { name: "bookmarks" }
  | { name: "starred" }
  | { name: "tags"; query?: { tag?: string } }

  // ── Notifications & Activity ───────────────────────────────────────────────
  | { name: "notifications"; query?: { filter?: string } }
  | { name: "activity"; query?: { actor?: string } }

  // ── Settings & Account ─────────────────────────────────────────────────────
  | { name: "settings" }
  | { name: "settings-llm" }
  | { name: "settings-preferences" }
  | { name: "settings-api-keys" }
  | { name: "settings-notifications" }
  | { name: "settings-export" }
  | { name: "settings-import" }

  // ── System & Operations ────────────────────────────────────────────────────
  | { name: "system" } // system index
  | { name: "system-status" }
  | { name: "system-health" }
  | { name: "system-diagnostics" }
  | { name: "system-scheduler" }
  | { name: "system-queues" }
  | { name: "system-metrics" }

  // ── Documentation & Info ───────────────────────────────────────────────────
  | { name: "docs" }
  | { name: "docs-playbooks" }
  | { name: "docs-api" }
  | { name: "docs-changelog" }
  | { name: "docs-about" }
  | { name: "docs-privacy" }
  | { name: "docs-terms" }
  | { name: "docs-legal" }
  | { name: "sitemap" }

  // ── Support & Feedback ─────────────────────────────────────────────────────
  | { name: "support" }
  | { name: "feedback" }

  // ── SaaS / Billing / Account ───────────────────────────────────────────────
  | { name: "pricing"; query?: { cycle?: "monthly" | "annual" } }
  | { name: "billing" }
  | { name: "billing-invoices" }
  | { name: "billing-credits" }
  | { name: "billing-api-keys" }
  | { name: "login" }
  | { name: "signup" }
  | { name: "forgot-password" }
  | { name: "reset-password"; query?: { status?: string } }
  | { name: "verify-email"; query?: { email?: string } }
  | { name: "account" }

  // ── Error / edge cases ─────────────────────────────────────────────────────
  | { name: "not-found" }
  | { name: "error"; query?: { code?: string; message?: string } }
  | { name: "maintenance" };

// A route name is the discriminant string for the union above.
export type RouteName = Route["name"];

// Route pattern entry used by the registry for matching & link generation.
export interface RoutePattern {
  name: RouteName;
  // Hash path pattern, e.g. "/investigations/:id/report". ":" introduces a param.
  path: string;
  // Human-readable title for breadcrumbs / document title.
  title: string;
  // Group for sidebar categorization.
  group: RouteGroup;
  // Lucide icon name (string) — resolved in the UI layer to avoid importing
  // the entire icon library into the registry.
  icon: string;
  // Whether the route requires a completed/known resource id at parse time.
  // If true and the param is missing, the router falls back to the list view.
  requiresParam?: boolean;
}

export type RouteGroup =
  | "core"
  | "investigations"
  | "knowledge-base"
  | "analytics"
  | "provenance"
  | "tools"
  | "collections"
  | "notifications"
  | "settings"
  | "system"
  | "docs"
  | "support"
  | "billing"
  | "error";
