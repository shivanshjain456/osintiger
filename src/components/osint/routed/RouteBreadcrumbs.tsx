"use client";

// Route-aware breadcrumbs. Derives the crumb trail from the current route so
// every page has consistent, accurate navigation context without per-page
// boilerplate. Detail routes include their parent list as a clickable crumb.

import { useRoute, useNavigate } from "@/lib/router/useRouter";
import type { Route } from "@/lib/router/types";
import { ChevronRight, Home } from "lucide-react";

interface Crumb {
  label: string;
  route?: Route;
}

export function RouteBreadcrumbs() {
  const route = useRoute();
  const navigate = useNavigate();
  const crumbs = deriveCrumbs(route);

  if (crumbs.length <= 1) return null; // home has no trail

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1 text-[11px] font-mono flex-wrap">
      <button
        onClick={() => navigate({ name: "home" })}
        className="flex items-center gap-1 text-[var(--hack-gray)] hover:text-[var(--hack-green)] transition"
      >
        <Home className="h-3 w-3" />
        <span>Home</span>
      </button>
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]/40" />
            {c.route && !isLast ? (
              <button
                onClick={() => navigate(c.route!)}
                className="text-[var(--hack-gray)] hover:text-[var(--hack-green)] transition"
              >
                {c.label}
              </button>
            ) : (
              <span className={isLast ? "text-[var(--hack-green)]" : "text-[var(--hack-gray)]"}>
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function deriveCrumbs(route: Route): Crumb[] {
  switch (route.name) {
    case "home":
      return [];
    case "new":
      return [{ label: "New Investigation" }];
    case "investigations":
      return [{ label: "Investigations" }];
    case "investigation":
      return [
        { label: "Investigations", route: { name: "investigations" } },
        { label: route.params.id.slice(0, 8) },
      ];
    case "investigation-report":
      return [
        { label: "Investigations", route: { name: "investigations" } },
        { label: route.params.id.slice(0, 8), route: { name: "investigation", params: { id: route.params.id } } },
        { label: "Report" },
      ];
    case "agents":
      return [{ label: "Agent Runs" }];
    case "agent":
      return [
        { label: "Agent Runs", route: { name: "agents" } },
        { label: route.params.id.slice(0, 8) },
      ];
    case "discoveries":
      return [{ label: "Discovery Sessions" }];
    case "discovery":
      return [
        { label: "Discovery Sessions", route: { name: "discoveries" } },
        { label: route.params.id.slice(0, 8) },
      ];
    case "plans":
      return [{ label: "Plan Sessions" }];
    case "plan":
      return [
        { label: "Plan Sessions", route: { name: "plans" } },
        { label: route.params.id.slice(0, 8) },
      ];
    case "monitors":
      return [{ label: "Monitor Sessions" }];
    case "monitor":
      return [
        { label: "Monitor Sessions", route: { name: "monitors" } },
        { label: route.params.id.slice(0, 8) },
      ];
    case "monitor-snapshots":
      return [
        { label: "Monitor Sessions", route: { name: "monitors" } },
        { label: route.params.id.slice(0, 8), route: { name: "monitor", params: { id: route.params.id } } },
        { label: "Snapshots" },
      ];
    case "monitor-alerts":
      return [
        { label: "Monitor Sessions", route: { name: "monitors" } },
        { label: route.params.id.slice(0, 8), route: { name: "monitor", params: { id: route.params.id } } },
        { label: "Alerts" },
      ];
    case "kb":
      return [{ label: "Knowledge Base" }];
    case "kb-entities":
      return [
        { label: "Knowledge Base", route: { name: "kb" } },
        { label: "Entities" },
      ];
    case "kb-entity":
      return [
        { label: "Knowledge Base", route: { name: "kb" } },
        { label: "Entities", route: { name: "kb-entities" } },
        { label: route.params.id.slice(0, 8) },
      ];
    case "kb-relationships":
      return [
        { label: "Knowledge Base", route: { name: "kb" } },
        { label: "Relationships" },
      ];
    case "kb-evidence":
      return [
        { label: "Knowledge Base", route: { name: "kb" } },
        { label: "Evidence" },
      ];
    case "kb-conflicts":
      return [
        { label: "Knowledge Base", route: { name: "kb" } },
        { label: "Conflicts" },
      ];
    case "kb-versions":
      return [
        { label: "Knowledge Base", route: { name: "kb" } },
        { label: "Version History" },
      ];
    case "kb-graph":
      return [
        { label: "Knowledge Base", route: { name: "kb" } },
        { label: "Graph" },
      ];
    case "kb-search":
      return [
        { label: "Knowledge Base", route: { name: "kb" } },
        { label: "Search" },
      ];
    case "dashboard":
      return [{ label: "Analytics Dashboard" }];
    case "analytics-sources":
      return [
        { label: "Analytics", route: { name: "dashboard" } },
        { label: "Source Analytics" },
      ];
    case "analytics-versions":
      return [
        { label: "Analytics", route: { name: "dashboard" } },
        { label: "Version Analytics" },
      ];
    case "analytics-provenance":
      return [
        { label: "Analytics", route: { name: "dashboard" } },
        { label: "Provenance Analytics" },
      ];
    case "provenance":
      return [{ label: "Provenance Chain" }];
    case "provenance-investigation":
      return [
        { label: "Provenance", route: { name: "provenance" } },
        { label: route.params.id.slice(0, 8) },
      ];
    case "provenance-trace":
      return [
        { label: "Provenance", route: { name: "provenance" } },
        { label: "Trace" },
      ];
    case "audit":
      return [{ label: "Audit Log" }];
    case "tools":
      return [{ label: "Tools" }];
    case "tool-visual":
      return [
        { label: "Tools", route: { name: "tools" } },
        { label: "Visual Intelligence" },
      ];
    case "tool-crypto":
      return [
        { label: "Tools", route: { name: "tools" } },
        { label: "Crypto Tracing" },
      ];
    case "tool-sanctions":
      return [
        { label: "Tools", route: { name: "tools" } },
        { label: "Sanctions Screening" },
      ];
    case "tool-batch":
      return [
        { label: "Tools", route: { name: "tools" } },
        { label: "Batch Screening" },
      ];
    case "tools-playbooks":
      return [
        { label: "Tools", route: { name: "tools" } },
        { label: "Playbook Library" },
      ];
    case "collections":
      return [{ label: "Collections" }];
    case "collection":
      return [
        { label: "Collections", route: { name: "collections" } },
        { label: route.params.id.slice(0, 8) },
      ];
    case "bookmarks":
      return [{ label: "Bookmarks" }];
    case "starred":
      return [{ label: "Starred" }];
    case "tags":
      return [{ label: "Tags" }];
    case "notifications":
      return [{ label: "Notifications" }];
    case "activity":
      return [{ label: "Activity Feed" }];
    case "settings":
      return [{ label: "Settings" }];
    case "settings-llm":
      return [
        { label: "Settings", route: { name: "settings" } },
        { label: "AI Provider" },
      ];
    case "settings-preferences":
      return [
        { label: "Settings", route: { name: "settings" } },
        { label: "Preferences" },
      ];
    case "settings-api-keys":
      return [
        { label: "Settings", route: { name: "settings" } },
        { label: "Source API Keys" },
      ];
    case "settings-notifications":
      return [
        { label: "Settings", route: { name: "settings" } },
        { label: "Notification Settings" },
      ];
    case "settings-export":
      return [
        { label: "Settings", route: { name: "settings" } },
        { label: "Data Export" },
      ];
    case "settings-import":
      return [
        { label: "Settings", route: { name: "settings" } },
        { label: "Data Import" },
      ];
    case "system":
      return [{ label: "System Operations" }];
    case "system-status":
      return [
        { label: "System", route: { name: "system" } },
        { label: "Status" },
      ];
    case "system-health":
      return [
        { label: "System", route: { name: "system" } },
        { label: "Health Checks" },
      ];
    case "system-diagnostics":
      return [
        { label: "System", route: { name: "system" } },
        { label: "Diagnostics" },
      ];
    case "system-scheduler":
      return [
        { label: "System", route: { name: "system" } },
        { label: "Scheduler" },
      ];
    case "system-queues":
      return [
        { label: "System", route: { name: "system" } },
        { label: "Job Queues" },
      ];
    case "system-metrics":
      return [
        { label: "System", route: { name: "system" } },
        { label: "Metrics" },
      ];
    case "docs":
      return [{ label: "Documentation" }];
    case "docs-playbooks":
      return [
        { label: "Docs", route: { name: "docs" } },
        { label: "Playbooks" },
      ];
    case "docs-api":
      return [
        { label: "Docs", route: { name: "docs" } },
        { label: "API Reference" },
      ];
    case "docs-changelog":
      return [
        { label: "Docs", route: { name: "docs" } },
        { label: "Changelog" },
      ];
    case "docs-about":
      return [
        { label: "Docs", route: { name: "docs" } },
        { label: "About" },
      ];
    case "docs-privacy":
      return [
        { label: "Docs", route: { name: "docs" } },
        { label: "Privacy Policy" },
      ];
    case "docs-terms":
      return [
        { label: "Docs", route: { name: "docs" } },
        { label: "Terms of Service" },
      ];
    case "docs-legal":
      return [
        { label: "Docs", route: { name: "docs" } },
        { label: "Legal Disclaimer" },
      ];
    case "sitemap":
      return [{ label: "Sitemap" }];
    case "support":
      return [{ label: "Support" }];
    case "feedback":
      return [{ label: "Feedback" }];
    case "pricing":
      return [{ label: "Pricing" }];
    case "billing":
      return [{ label: "Billing & Subscription" }];
    case "billing-invoices":
      return [
        { label: "Billing", route: { name: "billing" } },
        { label: "Invoices" },
      ];
    case "billing-credits":
      return [
        { label: "Billing", route: { name: "billing" } },
        { label: "AI Credits" },
      ];
    case "billing-api-keys":
      return [
        { label: "Billing", route: { name: "billing" } },
        { label: "API Keys" },
      ];
    case "login":
      return [{ label: "Sign In" }];
    case "signup":
      return [{ label: "Sign Up" }];
    case "account":
      return [{ label: "Account" }];
    case "not-found":
      return [{ label: "Not Found" }];
    case "error":
      return [{ label: "Error" }];
    case "maintenance":
      return [{ label: "Maintenance" }];
    default:
      return [{ label: String((route as { name: string }).name) }];
  }
}
