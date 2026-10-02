// SPA Router — Route Registry
// The single source of truth for every route in OSINTiger.
// Order matters: more specific patterns (longer paths) MUST come before shorter
// prefixes so the matcher picks the right one. e.g. /investigations/:id/report
// before /investigations/:id before /investigations.

import type { RoutePattern, RouteGroup } from "./types";

export const ROUTE_PATTERNS: RoutePattern[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  { name: "home", path: "/", title: "Command Center", group: "core", icon: "Terminal" },
  { name: "new", path: "/new", title: "New Investigation", group: "core", icon: "Plus" },
  { name: "sitemap", path: "/sitemap", title: "Sitemap", group: "core", icon: "Map" },

  // ── Investigations ────────────────────────────────────────────────────────
  { name: "investigation-report", path: "/investigations/:id/report", title: "Intelligence Report", group: "investigations", icon: "FileText", requiresParam: true },
  { name: "investigation", path: "/investigations/:id", title: "Investigation", group: "investigations", icon: "Loader", requiresParam: true },
  { name: "investigations", path: "/investigations", title: "Investigations", group: "investigations", icon: "History" },

  // ── Autonomous Agent ───────────────────────────────────────────────────────
  { name: "agent", path: "/agent/:id", title: "Autonomous Agent", group: "investigations", icon: "Bot", requiresParam: true },
  { name: "agents", path: "/agents", title: "Agent Runs", group: "investigations", icon: "Bot" },

  // ── Recursive Discovery ────────────────────────────────────────────────────
  { name: "discovery", path: "/discovery/:id", title: "Discovery Session", group: "investigations", icon: "Layers", requiresParam: true },
  { name: "discoveries", path: "/discoveries", title: "Discovery Sessions", group: "investigations", icon: "Layers" },

  // ── AI Plan ────────────────────────────────────────────────────────────────
  { name: "plan", path: "/plan/:id", title: "AI Plan", group: "investigations", icon: "Brain", requiresParam: true },
  { name: "plans", path: "/plans", title: "Plan Sessions", group: "investigations", icon: "Brain" },

  // ── Live Monitoring ────────────────────────────────────────────────────────
  { name: "monitor-alerts", path: "/monitor/:id/alerts", title: "Monitor Alerts", group: "investigations", icon: "BellRing", requiresParam: true },
  { name: "monitor-snapshots", path: "/monitor/:id/snapshots", title: "Monitor Snapshots", group: "investigations", icon: "Camera", requiresParam: true },
  { name: "monitor", path: "/monitor/:id", title: "Live Monitor", group: "investigations", icon: "Radio", requiresParam: true },
  { name: "monitors", path: "/monitors", title: "Monitor Sessions", group: "investigations", icon: "Radio" },

  // ── Knowledge Base ─────────────────────────────────────────────────────────
  { name: "kb-entity", path: "/kb/entities/:id", title: "Entity", group: "knowledge-base", icon: "CircleUser", requiresParam: true },
  { name: "kb-entities", path: "/kb/entities", title: "Entities", group: "knowledge-base", icon: "Users" },
  { name: "kb-relationships", path: "/kb/relationships", title: "Relationships", group: "knowledge-base", icon: "Network" },
  { name: "kb-evidence", path: "/kb/evidence", title: "Evidence", group: "knowledge-base", icon: "Fingerprint" },
  { name: "kb-conflicts", path: "/kb/conflicts", title: "Conflicts", group: "knowledge-base", icon: "AlertTriangle" },
  { name: "kb-versions", path: "/kb/versions", title: "Version History", group: "knowledge-base", icon: "GitBranch" },
  { name: "kb-graph", path: "/kb/graph", title: "Knowledge Graph", group: "knowledge-base", icon: "Share2" },
  { name: "kb-search", path: "/kb/search", title: "KB Search", group: "knowledge-base", icon: "Search" },
  { name: "kb", path: "/kb", title: "Knowledge Base", group: "knowledge-base", icon: "Library" },

  // ── Analytics & Dashboards ─────────────────────────────────────────────────
  { name: "analytics-sources", path: "/analytics/sources", title: "Source Analytics", group: "analytics", icon: "BarChart3" },
  { name: "analytics-versions", path: "/analytics/versions", title: "Version Analytics", group: "analytics", icon: "GitBranch" },
  { name: "analytics-provenance", path: "/analytics/provenance", title: "Provenance Analytics", group: "analytics", icon: "Fingerprint" },
  { name: "dashboard", path: "/dashboard", title: "Analytics Dashboard", group: "analytics", icon: "LayoutDashboard" },

  // ── Provenance & Audit ─────────────────────────────────────────────────────
  { name: "provenance-trace", path: "/provenance/trace/:evidenceId", title: "Evidence Trace", group: "provenance", icon: "Link2", requiresParam: true },
  { name: "provenance-investigation", path: "/provenance/:id", title: "Investigation Provenance", group: "provenance", icon: "Fingerprint", requiresParam: true },
  { name: "provenance", path: "/provenance", title: "Provenance Chain", group: "provenance", icon: "Fingerprint" },
  { name: "audit", path: "/audit", title: "Audit Log", group: "provenance", icon: "ScrollText" },

  // ── Tools ──────────────────────────────────────────────────────────────────
  { name: "tool-visual", path: "/tools/visual", title: "Visual Intelligence", group: "tools", icon: "ScanEye" },
  { name: "tool-crypto", path: "/tools/crypto", title: "Crypto Tracing", group: "tools", icon: "Wallet" },
  { name: "tool-sanctions", path: "/tools/sanctions", title: "Sanctions Screening", group: "tools", icon: "ShieldAlert" },
  { name: "tool-batch", path: "/tools/batch", title: "Batch Screening", group: "tools", icon: "FileText" },
  { name: "tools-playbooks", path: "/tools/playbooks", title: "Playbook Library", group: "tools", icon: "BookOpen" },
  { name: "tools", path: "/tools", title: "Investigation Tools", group: "tools", icon: "Wrench" },

  // ── Collections, Bookmarks, Tags ───────────────────────────────────────────
  { name: "collection", path: "/collections/:id", title: "Collection", group: "collections", icon: "FolderOpen", requiresParam: true },
  { name: "collections", path: "/collections", title: "Collections", group: "collections", icon: "Folder" },
  { name: "bookmarks", path: "/bookmarks", title: "Bookmarks", group: "collections", icon: "Bookmark" },
  { name: "starred", path: "/starred", title: "Starred", group: "collections", icon: "Star" },
  { name: "tags", path: "/tags", title: "Tags", group: "collections", icon: "Tags" },

  // ── Notifications & Activity ───────────────────────────────────────────────
  { name: "notifications", path: "/notifications", title: "Notifications", group: "notifications", icon: "Bell" },
  { name: "activity", path: "/activity", title: "Activity Feed", group: "notifications", icon: "Activity" },

  // ── Settings & Account ─────────────────────────────────────────────────────
  { name: "settings-llm", path: "/settings/llm", title: "AI Provider", group: "settings", icon: "Key" },
  { name: "settings-preferences", path: "/settings/preferences", title: "Preferences", group: "settings", icon: "SlidersHorizontal" },
  { name: "settings-api-keys", path: "/settings/api-keys", title: "Source API Keys", group: "settings", icon: "KeyRound" },
  { name: "settings-notifications", path: "/settings/notifications", title: "Notification Settings", group: "settings", icon: "BellRing" },
  { name: "settings-export", path: "/settings/export", title: "Data Export", group: "settings", icon: "Download" },
  { name: "settings-import", path: "/settings/import", title: "Data Import", group: "settings", icon: "Upload" },
  { name: "settings", path: "/settings", title: "Settings", group: "settings", icon: "Settings" },

  // ── System & Operations ────────────────────────────────────────────────────
  { name: "system-status", path: "/system/status", title: "System Status", group: "system", icon: "Activity" },
  { name: "system-health", path: "/system/health", title: "Health Checks", group: "system", icon: "HeartPulse" },
  { name: "system-diagnostics", path: "/system/diagnostics", title: "Diagnostics", group: "system", icon: "Stethoscope" },
  { name: "system-scheduler", path: "/system/scheduler", title: "Scheduler", group: "system", icon: "Clock" },
  { name: "system-queues", path: "/system/queues", title: "Job Queues", group: "system", icon: "ListChecks" },
  { name: "system-metrics", path: "/system/metrics", title: "Metrics", group: "system", icon: "Gauge" },
  { name: "system", path: "/system", title: "System Operations", group: "system", icon: "Server" },

  // ── Documentation & Info ───────────────────────────────────────────────────
  { name: "docs-playbooks", path: "/docs/playbooks", title: "Playbook Docs", group: "docs", icon: "BookOpen" },
  { name: "docs-api", path: "/docs/api", title: "API Reference", group: "docs", icon: "Code2" },
  { name: "docs-changelog", path: "/docs/changelog", title: "Changelog", group: "docs", icon: "GitCommitHorizontal" },
  { name: "docs-about", path: "/docs/about", title: "About", group: "docs", icon: "Info" },
  { name: "docs-privacy", path: "/docs/privacy", title: "Privacy Policy", group: "docs", icon: "ShieldCheck" },
  { name: "docs-terms", path: "/docs/terms", title: "Terms of Service", group: "docs", icon: "FileCheck" },
  { name: "docs-legal", path: "/docs/legal", title: "Legal Disclaimer", group: "docs", icon: "Scale" },
  { name: "docs", path: "/docs", title: "Documentation", group: "docs", icon: "BookOpen" },

  // ── Support & Feedback ─────────────────────────────────────────────────────
  { name: "support", path: "/support", title: "Support", group: "support", icon: "LifeBuoy" },
  { name: "feedback", path: "/feedback", title: "Feedback", group: "support", icon: "MessageSquare" },

  // ── SaaS / Billing / Account ───────────────────────────────────────────────
  { name: "billing-invoices", path: "/billing/invoices", title: "Invoices", group: "billing", icon: "Receipt" },
  { name: "billing-credits", path: "/billing/credits", title: "AI Credits", group: "billing", icon: "Zap" },
  { name: "billing-api-keys", path: "/billing/api-keys", title: "API Keys", group: "billing", icon: "KeyRound" },
  { name: "billing", path: "/billing", title: "Billing & Subscription", group: "billing", icon: "CreditCard" },
  { name: "pricing", path: "/pricing", title: "Pricing", group: "billing", icon: "Tag" },
  { name: "login", path: "/login", title: "Sign In", group: "billing", icon: "LogIn" },
  { name: "signup", path: "/signup", title: "Sign Up", group: "billing", icon: "UserPlus" },
  { name: "forgot-password", path: "/forgot-password", title: "Forgot Password", group: "billing", icon: "KeyRound" },
  { name: "reset-password", path: "/reset-password", title: "Reset Password", group: "billing", icon: "KeyRound" },
  { name: "verify-email", path: "/verify-email", title: "Verify Email", group: "billing", icon: "MailCheck" },
  { name: "account", path: "/account", title: "Account", group: "billing", icon: "CircleUser" },

  // ── Error / edge cases ─────────────────────────────────────────────────────
  { name: "error", path: "/error", title: "Error", group: "error", icon: "AlertOctagon" },
  { name: "maintenance", path: "/maintenance", title: "Maintenance", group: "error", icon: "Wrench" },
  { name: "not-found", path: "/404", title: "Not Found", group: "error", icon: "FileQuestion" },
];

// Fast lookup by name.
export const ROUTE_BY_NAME: Record<string, RoutePattern> = Object.fromEntries(
  ROUTE_PATTERNS.map((r) => [r.name, r])
);

export const ROUTE_GROUPS: { group: RouteGroup; label: string; icon: string }[] = [
  { group: "core", label: "Command", icon: "Terminal" },
  { group: "investigations", label: "Investigations", icon: "Crosshair" },
  { group: "knowledge-base", label: "Knowledge Base", icon: "Library" },
  { group: "analytics", label: "Analytics", icon: "LayoutDashboard" },
  { group: "provenance", label: "Provenance & Audit", icon: "Fingerprint" },
  { group: "tools", label: "Tools", icon: "Wrench" },
  { group: "collections", label: "Collections", icon: "Folder" },
  { group: "notifications", label: "Notifications", icon: "Bell" },
  { group: "settings", label: "Settings", icon: "Settings" },
  { group: "system", label: "System Ops", icon: "Server" },
  { group: "docs", label: "Documentation", icon: "BookOpen" },
  { group: "support", label: "Support", icon: "LifeBuoy" },
  { group: "billing", label: "Billing & Account", icon: "CreditCard" },
];
