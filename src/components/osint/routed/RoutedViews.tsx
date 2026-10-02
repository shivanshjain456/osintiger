"use client";

// RoutedViews — the central switch that maps the current Route to its view
// component. This is the single integration point between the router and the
// rendered UI. Adding a route = add a case here.

import type { Route } from "@/lib/router/types";
import { useRoute } from "@/lib/router/useRouter";

// Existing (pre-router) views — wrapped for URL-addressability.
import { HomeView } from "../HomeView";
import {
  RoutedProgressView,
  RoutedReportView,
  RoutedAgentView,
  RoutedDiscoveryView,
  RoutedPlanView,
  RoutedMonitorView,
} from "./RoutedInvestigationViews";

// New routed views.
import { NewInvestigationView } from "./NewInvestigationView";
import { InvestigationsListView, SessionListView } from "./InvestigationsListView";
import { ToolsView, ToolVisualView, ToolCryptoView, ToolSanctionsView, ToolBatchView } from "./ToolsViews";
import {
  DocsView, DocsAboutView, DocsChangelogView, DocsPrivacyView, DocsTermsView,
  DocsLegalView, DocsApiView, DocsPlaybooksView, SitemapView, SupportView,
  FeedbackView, NotFoundView, ErrorView, MaintenanceView,
} from "./StaticViews";
import {
  SettingsView, SettingsLlmView, SettingsPreferencesView, SettingsApiKeysView,
  SettingsNotificationsView, SettingsExportView, SettingsImportView,
} from "./SettingsViews";
import {
  SystemView, SystemStatusView, SystemHealthView, SystemDiagnosticsView,
  SystemSchedulerView, SystemQueuesView, SystemMetricsView,
} from "./SystemViews";
import {
  CollectionsView, CollectionDetailView, BookmarksView, StarredView, TagsView,
  NotificationsView, ActivityView, AuditView,
} from "./CollectionsViews";
import { KbView, KbEntitiesView, KbEntityView, KbSearchView } from "./KBViews";
import {
  DashboardView, AnalyticsSourcesView, AnalyticsVersionsView, AnalyticsProvenanceView,
  ProvenanceView, ProvenanceInvestigationView, ProvenanceTraceView,
} from "./AnalyticsViews";
import { MonitorSnapshotsView, MonitorAlertsView } from "./MonitorViews";

// KB sub-views (relationships / evidence / conflicts / versions / graph) —
// functional list views backed by direct DB-backed API routes.
import {
  KbRelationshipsView, KbEvidenceView, KbConflictsView, KbVersionsView, KbGraphView,
} from "./KBSubViews";

// SaaS views — pricing, billing, auth, account.
import {
  PricingView,
  BillingView,
  BillingInvoicesView,
  BillingCreditsView,
  BillingApiKeysView,
} from "./SaasViews";
import {
  LoginView,
  SignupView,
  ForgotPasswordView,
  ResetPasswordView,
  VerifyEmailView,
  AccountView,
} from "./AuthViews";

// Placeholder for HomeView extras needed by the legacy AppShell callbacks.
export interface HomeViewCallbacks {
  onInvestigate: (id: string, target: string) => void;
  onAgentInvestigate: (id: string, target: string) => void;
  onStartDiscovery: (target: string, inputType: string) => void;
  onStartPlan: (target: string, objective: string, inputType: string) => void;
  onStartMonitor: (target: string, inputType: string) => void;
  onOpenHistory: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  homeKey: number;
}

export function RoutedViews({ homeCallbacks }: { homeCallbacks: HomeViewCallbacks }) {
  const route = useRoute();

  switch (route.name) {
    // ── Core ────────────────────────────────────────────────────────────────
    case "home":
      return (
        <HomeView
          key={homeCallbacks.homeKey}
          searchInputRef={homeCallbacks.searchInputRef}
          onInvestigate={homeCallbacks.onInvestigate}
          onAgentInvestigate={homeCallbacks.onAgentInvestigate}
          onStartDiscovery={homeCallbacks.onStartDiscovery}
          onStartPlan={homeCallbacks.onStartPlan}
          onStartMonitor={homeCallbacks.onStartMonitor}
          onOpenHistory={homeCallbacks.onOpenHistory}
        />
      );
    case "new":
      return <NewInvestigationView />;
    case "sitemap":
      return <SitemapView />;

    // ── Investigations ──────────────────────────────────────────────────────
    case "investigations":
      return <InvestigationsListView />;
    case "investigation":
      return <RoutedProgressView id={route.params.id} />;
    case "investigation-report":
      return <RoutedReportView id={route.params.id} />;

    // ── Agents ──────────────────────────────────────────────────────────────
    case "agents":
      return <SessionListView kind="agents" />;
    case "agent":
      return <RoutedAgentView id={route.params.id} />;

    // ── Discoveries ─────────────────────────────────────────────────────────
    case "discoveries":
      return <SessionListView kind="discoveries" />;
    case "discovery":
      return <RoutedDiscoveryView id={route.params.id} />;

    // ── Plans ───────────────────────────────────────────────────────────────
    case "plans":
      return <SessionListView kind="plans" />;
    case "plan":
      return <RoutedPlanView id={route.params.id} />;

    // ── Monitors ────────────────────────────────────────────────────────────
    case "monitors":
      return <SessionListView kind="monitors" />;
    case "monitor":
      return <RoutedMonitorView id={route.params.id} />;
    case "monitor-snapshots":
      return <MonitorSnapshotsView id={route.params.id} />;
    case "monitor-alerts":
      return <MonitorAlertsView id={route.params.id} />;

    // ── Knowledge Base ──────────────────────────────────────────────────────
    case "kb":
      return <KbView />;
    case "kb-entities":
      return <KbEntitiesView initialType={route.query?.type} initialQ={route.query?.q} />;
    case "kb-entity":
      return <KbEntityView id={route.params.id} tab={route.query?.tab} />;
    case "kb-relationships":
      return <KbRelationshipsView />;
    case "kb-evidence":
      return <KbEvidenceView entityId={route.query?.entityId} source={route.query?.source} />;
    case "kb-conflicts":
      return <KbConflictsView status={route.query?.status} />;
    case "kb-versions":
      return <KbVersionsView entityType={route.query?.entityType} recordId={route.query?.recordId} />;
    case "kb-graph":
      return <KbGraphView focus={route.query?.focus} />;
    case "kb-search":
      return <KbSearchView initialQ={route.query?.q} />;

    // ── Analytics ───────────────────────────────────────────────────────────
    case "dashboard":
      return <DashboardView />;
    case "analytics-sources":
      return <AnalyticsSourcesView target={route.query?.target} />;
    case "analytics-versions":
      return <AnalyticsVersionsView target={route.query?.target} />;
    case "analytics-provenance":
      return <AnalyticsProvenanceView />;

    // ── Provenance & Audit ──────────────────────────────────────────────────
    case "provenance":
      return <ProvenanceView investigationId={route.query?.investigationId} eventType={route.query?.eventType} />;
    case "provenance-investigation":
      return <ProvenanceInvestigationView id={route.params.id} />;
    case "provenance-trace":
      return <ProvenanceTraceView evidenceId={route.params.evidenceId} />;
    case "audit":
      return <AuditView />;

    // ── Tools ───────────────────────────────────────────────────────────────
    case "tools":
      return <ToolsView />;
    case "tool-visual":
      return <ToolVisualView />;
    case "tool-crypto":
      return <ToolCryptoView />;
    case "tool-sanctions":
      return <ToolSanctionsView />;
    case "tool-batch":
      return <ToolBatchView />;
    case "tools-playbooks":
      return <DocsPlaybooksView />;

    // ── Collections ─────────────────────────────────────────────────────────
    case "collections":
      return <CollectionsView />;
    case "collection":
      return <CollectionDetailView id={route.params.id} />;
    case "bookmarks":
      return <BookmarksView />;
    case "starred":
      return <StarredView />;
    case "tags":
      return <TagsView />;

    // ── Notifications & Activity ────────────────────────────────────────────
    case "notifications":
      return <NotificationsView />;
    case "activity":
      return <ActivityView />;

    // ── Settings ────────────────────────────────────────────────────────────
    case "settings":
      return <SettingsView />;
    case "settings-llm":
      return <SettingsLlmView />;
    case "settings-preferences":
      return <SettingsPreferencesView />;
    case "settings-api-keys":
      return <SettingsApiKeysView />;
    case "settings-notifications":
      return <SettingsNotificationsView />;
    case "settings-export":
      return <SettingsExportView />;
    case "settings-import":
      return <SettingsImportView />;

    // ── System ──────────────────────────────────────────────────────────────
    case "system":
      return <SystemView />;
    case "system-status":
      return <SystemStatusView />;
    case "system-health":
      return <SystemHealthView />;
    case "system-diagnostics":
      return <SystemDiagnosticsView />;
    case "system-scheduler":
      return <SystemSchedulerView />;
    case "system-queues":
      return <SystemQueuesView />;
    case "system-metrics":
      return <SystemMetricsView />;

    // ── Docs ────────────────────────────────────────────────────────────────
    case "docs":
      return <DocsView />;
    case "docs-playbooks":
      return <DocsPlaybooksView />;
    case "docs-api":
      return <DocsApiView />;
    case "docs-changelog":
      return <DocsChangelogView />;
    case "docs-about":
      return <DocsAboutView />;
    case "docs-privacy":
      return <DocsPrivacyView />;
    case "docs-terms":
      return <DocsTermsView />;
    case "docs-legal":
      return <DocsLegalView />;

    // ── Support ─────────────────────────────────────────────────────────────
    case "support":
      return <SupportView />;
    case "feedback":
      return <FeedbackView />;

    // ── SaaS / Billing / Account ────────────────────────────────────────────
    case "pricing":
      return <PricingView initialCycle={route.query?.cycle} />;
    case "billing":
      return <BillingView />;
    case "billing-invoices":
      return <BillingInvoicesView />;
    case "billing-credits":
      return <BillingCreditsView />;
    case "billing-api-keys":
      return <BillingApiKeysView />;
    case "login":
      return <LoginView />;
    case "signup":
      return <SignupView />;
    case "forgot-password":
      return <ForgotPasswordView />;
    case "reset-password":
      return <ResetPasswordView status={route.query?.status} />;
    case "verify-email":
      return <VerifyEmailView email={route.query?.email} />;
    case "account":
      return <AccountView />;

    // ── Error states ────────────────────────────────────────────────────────
    case "not-found":
      return <NotFoundView />;
    case "error":
      return <ErrorView />;
    case "maintenance":
      return <MaintenanceView />;

    default:
      return <NotFoundView />;
  }
}

// Re-export for convenience.
export type { Route };
