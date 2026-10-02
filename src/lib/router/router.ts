// SPA Router — parsing, serialization, navigation, and history integration.
//
// The hash is the single source of truth for the active view. Format:
//   #/investigations/abc-123/report?q=foo&tab=summary
//      └── path (matched against ROUTE_PATTERNS)   └── query string
//
// Backward compatibility: the legacy deep-link format `#investigation=<id>` is
// detected and rewritten to the canonical `#/investigations/<id>`.

import { ROUTE_PATTERNS, ROUTE_BY_NAME } from "./registry";
import type { Route, RouteName } from "./types";

// ─── Hash <-> Route ──────────────────────────────────────────────────────────

interface ParsedHash {
  path: string; // e.g. "/investigations/abc/report"
  query: URLSearchParams;
}

function readHash(): ParsedHash {
  if (typeof window === "undefined") return { path: "/", query: new URLSearchParams() };
  let raw = window.location.hash || "";
  if (raw.startsWith("#")) raw = raw.slice(1);

  // Legacy: "investigation=<id>"
  const legacy = raw.match(/investigation=([a-f0-9-]+)/i);
  if (legacy && legacy[1]) {
    // Rewrite to canonical form (replaces history entry, no extra back step).
    const canonical = `#/investigations/${legacy[1]}`;
    history.replaceState(null, "", canonical);
    return { path: `/investigations/${legacy[1]}`, query: new URLSearchParams() };
  }

  if (!raw.startsWith("/")) {
    if (raw.length === 0) return { path: "/", query: new URLSearchParams() };
    // Tolerate missing leading slash.
    raw = "/" + raw;
  }

  const [path, queryString = ""] = raw.split("?", 2);
  return { path: path || "/", query: new URLSearchParams(queryString) };
}

interface MatchedPattern {
  pattern: (typeof ROUTE_PATTERNS)[number];
  params: Record<string, string>;
}

function matchPath(path: string): MatchedPattern | null {
  // Normalize: remove trailing slash unless root.
  const norm = path === "/" ? "/" : path.replace(/\/+$/, "");
  const segments = norm.split("/").filter(Boolean);

  for (const pattern of ROUTE_PATTERNS) {
    const patSegments = pattern.path.split("/").filter(Boolean);
    if (patSegments.length !== segments.length) continue;

    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < patSegments.length; i++) {
      const ps = patSegments[i];
      const ss = segments[i];
      if (ps.startsWith(":")) {
        params[ps.slice(1)] = decodeURIComponent(ss);
      } else if (ps !== ss) {
        ok = false;
        break;
      }
    }
    if (ok) return { pattern, params };
  }
  return null;
}

// Canonical useSyncExternalStore pattern: maintain a STABLE currentRoute
// reference that only changes when the hash actually changes. getSnapshot
// returns this stable reference, so React never sees a "new" snapshot unless
// the store (hash) genuinely changed. This prevents the "getSnapshot should
// be cached" infinite-loop warning.
const SSR_HOME: Route = { name: "home" };
let currentRoute: Route = SSR_HOME;

function recomputeCurrentRoute() {
  currentRoute = parseRouteImpl();
}

/** Read the current route (stable reference until the hash changes). */
export function parseRoute(): Route {
  if (typeof window === "undefined") return SSR_HOME;
  return currentRoute;
}

function parseRouteImpl(): Route {
  const { path, query } = readHash();
  const matched = matchPath(path);
  if (!matched) {
    // Empty hash → home. Unknown path → not-found.
    if (path === "/" || path === "") return { name: "home" };
    return { name: "not-found" };
  }
  const { pattern, params } = matched;
  const q = (k: string) => query.get(k) || undefined;

  switch (pattern.name as RouteName) {
    case "home":
      return { name: "home" };
    case "new":
      return {
        name: "new",
        params: {
          mode: q("mode") as "standard" | "agent" | "discovery" | "plan" | "monitor" | undefined,
          target: q("target"),
        },
      };
    case "investigations":
      return { name: "investigations" };
    case "investigation":
      return params.id ? { name: "investigation", params: { id: params.id } } : { name: "investigations" };
    case "investigation-report":
      return params.id ? { name: "investigation-report", params: { id: params.id } } : { name: "investigations" };
    case "agents":
      return { name: "agents" };
    case "agent":
      return params.id ? { name: "agent", params: { id: params.id } } : { name: "agents" };
    case "discoveries":
      return { name: "discoveries" };
    case "discovery":
      return params.id ? { name: "discovery", params: { id: params.id } } : { name: "discoveries" };
    case "plans":
      return { name: "plans" };
    case "plan":
      return params.id ? { name: "plan", params: { id: params.id } } : { name: "plans" };
    case "monitors":
      return { name: "monitors" };
    case "monitor":
      return params.id ? { name: "monitor", params: { id: params.id } } : { name: "monitors" };
    case "monitor-snapshots":
      return params.id ? { name: "monitor-snapshots", params: { id: params.id } } : { name: "monitors" };
    case "monitor-alerts":
      return params.id ? { name: "monitor-alerts", params: { id: params.id } } : { name: "monitors" };
    case "kb":
      return { name: "kb" };
    case "kb-entities":
      return { name: "kb-entities", query: { type: q("type"), q: q("q") } };
    case "kb-entity":
      return params.id
        ? { name: "kb-entity", params: { id: params.id }, query: { tab: q("tab") } }
        : { name: "kb-entities" };
    case "kb-relationships":
      return { name: "kb-relationships" };
    case "kb-evidence":
      return { name: "kb-evidence", query: { entityId: q("entityId"), source: q("source") } };
    case "kb-conflicts":
      return { name: "kb-conflicts", query: { status: q("status") } };
    case "kb-versions":
      return { name: "kb-versions", query: { entityType: q("entityType"), recordId: q("recordId") } };
    case "kb-graph":
      return { name: "kb-graph", query: { focus: q("focus") } };
    case "kb-search":
      return { name: "kb-search", query: { q: q("q") } };
    case "dashboard":
      return { name: "dashboard" };
    case "analytics-sources":
      return { name: "analytics-sources", query: { target: q("target") } };
    case "analytics-versions":
      return { name: "analytics-versions", query: { target: q("target") } };
    case "analytics-provenance":
      return { name: "analytics-provenance" };
    case "provenance":
      return { name: "provenance", query: { investigationId: q("investigationId"), eventType: q("eventType") } };
    case "provenance-investigation":
      return params.id ? { name: "provenance-investigation", params: { id: params.id } } : { name: "provenance" };
    case "provenance-trace":
      return params.evidenceId
        ? { name: "provenance-trace", params: { evidenceId: params.evidenceId } }
        : { name: "provenance" };
    case "audit":
      return { name: "audit", query: { actor: q("actor"), action: q("action") } };
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
      return { name: "collections" };
    case "collection":
      return params.id ? { name: "collection", params: { id: params.id } } : { name: "collections" };
    case "bookmarks":
      return { name: "bookmarks" };
    case "starred":
      return { name: "starred" };
    case "tags":
      return { name: "tags", query: { tag: q("tag") } };
    case "notifications":
      return { name: "notifications", query: { filter: q("filter") } };
    case "activity":
      return { name: "activity", query: { actor: q("actor") } };
    case "settings":
      return { name: "settings" };
    case "settings-llm":
      return { name: "settings-llm" };
    case "settings-preferences":
      return { name: "settings-preferences" };
    case "settings-api-keys":
      return { name: "settings-api-keys" };
    case "settings-notifications":
      return { name: "settings-notifications" };
    case "settings-export":
      return { name: "settings-export" };
    case "settings-import":
      return { name: "settings-import" };
    case "system":
      return { name: "system" };
    case "system-status":
      return { name: "system-status" };
    case "system-health":
      return { name: "system-health" };
    case "system-diagnostics":
      return { name: "system-diagnostics" };
    case "system-scheduler":
      return { name: "system-scheduler" };
    case "system-queues":
      return { name: "system-queues" };
    case "system-metrics":
      return { name: "system-metrics" };
    case "docs":
      return { name: "docs" };
    case "docs-playbooks":
      return { name: "docs-playbooks" };
    case "docs-api":
      return { name: "docs-api" };
    case "docs-changelog":
      return { name: "docs-changelog" };
    case "docs-about":
      return { name: "docs-about" };
    case "docs-privacy":
      return { name: "docs-privacy" };
    case "docs-terms":
      return { name: "docs-terms" };
    case "docs-legal":
      return { name: "docs-legal" };
    case "sitemap":
      return { name: "sitemap" };
    case "support":
      return { name: "support" };
    case "feedback":
      return { name: "feedback" };
    case "pricing":
      return { name: "pricing", query: { cycle: q("cycle") as "monthly" | "annual" | undefined } };
    case "billing":
      return { name: "billing" };
    case "billing-invoices":
      return { name: "billing-invoices" };
    case "billing-credits":
      return { name: "billing-credits" };
    case "billing-api-keys":
      return { name: "billing-api-keys" };
    case "login":
      return { name: "login" };
    case "signup":
      return { name: "signup" };
    case "forgot-password":
      return { name: "forgot-password" };
    case "reset-password":
      return { name: "reset-password", query: { status: q("status") } };
    case "verify-email":
      return { name: "verify-email", query: { email: q("email") } };
    case "account":
      return { name: "account" };
    case "error":
      return { name: "error", query: { code: q("code"), message: q("message") } };
    case "maintenance":
      return { name: "maintenance" };
    case "not-found":
      return { name: "not-found" };
    default:
      return { name: "home" };
  }
}

/** Serialize a Route into a canonical hash string (e.g. "#/investigations/abc"). */
export function serializeRoute(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "new": {
      const q = new URLSearchParams();
      if (route.params?.mode) q.set("mode", route.params.mode);
      if (route.params?.target) q.set("target", route.params.target);
      const qs = q.toString();
      return qs ? `#/new?${qs}` : "#/new";
    }
    case "investigations":
      return "#/investigations";
    case "investigation":
      return `#/investigations/${encodeURIComponent(route.params.id)}`;
    case "investigation-report":
      return `#/investigations/${encodeURIComponent(route.params.id)}/report`;
    case "agents":
      return "#/agents";
    case "agent":
      return `#/agent/${encodeURIComponent(route.params.id)}`;
    case "discoveries":
      return "#/discoveries";
    case "discovery":
      return `#/discovery/${encodeURIComponent(route.params.id)}`;
    case "plans":
      return "#/plans";
    case "plan":
      return `#/plan/${encodeURIComponent(route.params.id)}`;
    case "monitors":
      return "#/monitors";
    case "monitor":
      return `#/monitor/${encodeURIComponent(route.params.id)}`;
    case "monitor-snapshots":
      return `#/monitor/${encodeURIComponent(route.params.id)}/snapshots`;
    case "monitor-alerts":
      return `#/monitor/${encodeURIComponent(route.params.id)}/alerts`;
    case "kb":
      return "#/kb";
    case "kb-entities": {
      const q = new URLSearchParams();
      if (route.query?.type) q.set("type", route.query.type);
      if (route.query?.q) q.set("q", route.query.q);
      const qs = q.toString();
      return qs ? `#/kb/entities?${qs}` : "#/kb/entities";
    }
    case "kb-entity": {
      const base = `#/kb/entities/${encodeURIComponent(route.params.id)}`;
      const q = new URLSearchParams();
      if (route.query?.tab) q.set("tab", route.query.tab);
      const qs = q.toString();
      return qs ? `${base}?${qs}` : base;
    }
    case "kb-relationships":
      return "#/kb/relationships";
    case "kb-evidence": {
      const q = new URLSearchParams();
      if (route.query?.entityId) q.set("entityId", route.query.entityId);
      if (route.query?.source) q.set("source", route.query.source);
      const qs = q.toString();
      return qs ? `#/kb/evidence?${qs}` : "#/kb/evidence";
    }
    case "kb-conflicts": {
      const q = new URLSearchParams();
      if (route.query?.status) q.set("status", route.query.status);
      const qs = q.toString();
      return qs ? `#/kb/conflicts?${qs}` : "#/kb/conflicts";
    }
    case "kb-versions": {
      const q = new URLSearchParams();
      if (route.query?.entityType) q.set("entityType", route.query.entityType);
      if (route.query?.recordId) q.set("recordId", route.query.recordId);
      const qs = q.toString();
      return qs ? `#/kb/versions?${qs}` : "#/kb/versions";
    }
    case "kb-graph": {
      const q = new URLSearchParams();
      if (route.query?.focus) q.set("focus", route.query.focus);
      const qs = q.toString();
      return qs ? `#/kb/graph?${qs}` : "#/kb/graph";
    }
    case "kb-search": {
      const q = new URLSearchParams();
      if (route.query?.q) q.set("q", route.query.q);
      const qs = q.toString();
      return qs ? `#/kb/search?${qs}` : "#/kb/search";
    }
    case "dashboard":
      return "#/dashboard";
    case "analytics-sources": {
      const q = new URLSearchParams();
      if (route.query?.target) q.set("target", route.query.target);
      const qs = q.toString();
      return qs ? `#/analytics/sources?${qs}` : "#/analytics/sources";
    }
    case "analytics-versions": {
      const q = new URLSearchParams();
      if (route.query?.target) q.set("target", route.query.target);
      const qs = q.toString();
      return qs ? `#/analytics/versions?${qs}` : "#/analytics/versions";
    }
    case "analytics-provenance":
      return "#/analytics/provenance";
    case "provenance": {
      const q = new URLSearchParams();
      if (route.query?.investigationId) q.set("investigationId", route.query.investigationId);
      if (route.query?.eventType) q.set("eventType", route.query.eventType);
      const qs = q.toString();
      return qs ? `#/provenance?${qs}` : "#/provenance";
    }
    case "provenance-investigation":
      return `#/provenance/${encodeURIComponent(route.params.id)}`;
    case "provenance-trace":
      return `#/provenance/trace/${encodeURIComponent(route.params.evidenceId)}`;
    case "audit": {
      const q = new URLSearchParams();
      if (route.query?.actor) q.set("actor", route.query.actor);
      if (route.query?.action) q.set("action", route.query.action);
      const qs = q.toString();
      return qs ? `#/audit?${qs}` : "#/audit";
    }
    case "tools":
      return "#/tools";
    case "tool-visual":
      return "#/tools/visual";
    case "tool-crypto":
      return "#/tools/crypto";
    case "tool-sanctions":
      return "#/tools/sanctions";
    case "tool-batch":
      return "#/tools/batch";
    case "tools-playbooks":
      return "#/tools/playbooks";
    case "collections":
      return "#/collections";
    case "collection":
      return `#/collections/${encodeURIComponent(route.params.id)}`;
    case "bookmarks":
      return "#/bookmarks";
    case "starred":
      return "#/starred";
    case "tags": {
      const q = new URLSearchParams();
      if (route.query?.tag) q.set("tag", route.query.tag);
      const qs = q.toString();
      return qs ? `#/tags?${qs}` : "#/tags";
    }
    case "notifications": {
      const q = new URLSearchParams();
      if (route.query?.filter) q.set("filter", route.query.filter);
      const qs = q.toString();
      return qs ? `#/notifications?${qs}` : "#/notifications";
    }
    case "activity": {
      const q = new URLSearchParams();
      if (route.query?.actor) q.set("actor", route.query.actor);
      const qs = q.toString();
      return qs ? `#/activity?${qs}` : "#/activity";
    }
    case "settings":
      return "#/settings";
    case "settings-llm":
      return "#/settings/llm";
    case "settings-preferences":
      return "#/settings/preferences";
    case "settings-api-keys":
      return "#/settings/api-keys";
    case "settings-notifications":
      return "#/settings/notifications";
    case "settings-export":
      return "#/settings/export";
    case "settings-import":
      return "#/settings/import";
    case "system":
      return "#/system";
    case "system-status":
      return "#/system/status";
    case "system-health":
      return "#/system/health";
    case "system-diagnostics":
      return "#/system/diagnostics";
    case "system-scheduler":
      return "#/system/scheduler";
    case "system-queues":
      return "#/system/queues";
    case "system-metrics":
      return "#/system/metrics";
    case "docs":
      return "#/docs";
    case "docs-playbooks":
      return "#/docs/playbooks";
    case "docs-api":
      return "#/docs/api";
    case "docs-changelog":
      return "#/docs/changelog";
    case "docs-about":
      return "#/docs/about";
    case "docs-privacy":
      return "#/docs/privacy";
    case "docs-terms":
      return "#/docs/terms";
    case "docs-legal":
      return "#/docs/legal";
    case "sitemap":
      return "#/sitemap";
    case "support":
      return "#/support";
    case "feedback":
      return "#/feedback";
    case "pricing": {
      const q = new URLSearchParams();
      if (route.query?.cycle) q.set("cycle", route.query.cycle);
      const qs = q.toString();
      return qs ? `#/pricing?${qs}` : "#/pricing";
    }
    case "billing":
      return "#/billing";
    case "billing-invoices":
      return "#/billing/invoices";
    case "billing-credits":
      return "#/billing/credits";
    case "billing-api-keys":
      return "#/billing/api-keys";
    case "login":
      return "#/login";
    case "signup":
      return "#/signup";
    case "forgot-password":
      return "#/forgot-password";
    case "reset-password": {
      const q = new URLSearchParams();
      if (route.query?.status) q.set("status", route.query.status);
      const qs = q.toString();
      return qs ? `#/reset-password?${qs}` : "#/reset-password";
    }
    case "verify-email": {
      const q = new URLSearchParams();
      if (route.query?.email) q.set("email", route.query.email);
      const qs = q.toString();
      return qs ? `#/verify-email?${qs}` : "#/verify-email";
    }
    case "account":
      return "#/account";
    case "error": {
      const q = new URLSearchParams();
      if (route.query?.code) q.set("code", route.query.code);
      if (route.query?.message) q.set("message", route.query.message);
      const qs = q.toString();
      return qs ? `#/error?${qs}` : "#/error";
    }
    case "maintenance":
      return "#/maintenance";
    case "not-found":
      return "#/404";
    default:
      return "#/";
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────

type Listener = (route: Route) => void;
const listeners = new Set<Listener>();
let initialized = false;

function notify() {
  // Recompute the stable route reference BEFORE notifying listeners, so
  // getSnapshot returns the updated value.
  recomputeCurrentRoute();
  const route = currentRoute;
  listeners.forEach((l) => {
    try {
      l(route);
    } catch {
      // listener errors must never break the router
    }
  });
}

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  // Compute the initial route once the router is first used on the client.
  recomputeCurrentRoute();
  window.addEventListener("hashchange", notify);
  // Also listen to popstate for robustness (some browsers fire it on hash nav).
  window.addEventListener("popstate", notify);
}

/** Subscribe to route changes. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  ensureInit();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Navigate to a route, adding a new history entry (back button works). */
export function navigate(route: Route) {
  ensureInit();
  const hash = serializeRoute(route);
  if (window.location.hash === hash) {
    // Same hash — still notify so callers can re-run effects.
    notify();
    return;
  }
  window.location.hash = hash;
  // hashchange listener will fire notify()
}

/** Navigate to a route, replacing the current history entry (no back step). */
export function replace(route: Route) {
  ensureInit();
  const hash = serializeRoute(route);
  history.replaceState(null, "", hash);
  notify();
}

/** Go back in history. Falls back to home if no history. */
export function back() {
  if (typeof window === "undefined") return;
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigate({ name: "home" });
  }
}

// ─── Link helpers ───────────────────────────────────────────────────────────

/** Build a hash href string for a route (for <a href=...> usage). */
export function hrefFor(route: Route): string {
  return serializeRoute(route);
}

/** Look up a route pattern by name. */
export function getRoutePattern(name: RouteName) {
  return ROUTE_BY_NAME[name];
}

/** Get the document title for a route. */
export function titleFor(route: Route): string {
  const base = "OSINTiger";
  const pattern = ROUTE_BY_NAME[route.name];
  const title = pattern?.title || route.name;
  return `${title} · ${base}`;
}
