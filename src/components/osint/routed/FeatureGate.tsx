"use client";

// FeatureGate — conditional rendering wrapper that hides premium features
// from users whose plan doesn't include them. Renders the children when the
// current plan allows the feature; otherwise renders an UpgradePrompt.
//
// Usage:
//   <FeatureGate feature="multiAgentDebate">
//     <MultiAgentDebatePanel />
//   </FeatureGate>
//
// The gate reads from the singleton useSubscription() hook, so adding a gate
// anywhere in the tree is free (one /api/auth/me fetch for the whole app).
//
// While the subscription is still loading, we render children by default —
// better to flash the feature briefly than to flash a locked state on every
// page load. After load completes, if the user is denied, we swap in the
// fallback. This avoids an unpleasant "flash of locked content".

import type { ReactNode } from "react";
import { Lock, ArrowUpRight, Sparkles } from "lucide-react";
import { useSubscription } from "@/lib/saas/use-subscription";
import { useNavigate } from "@/lib/router/useRouter";
import type { PlanLimits, PlanTier } from "@/lib/saas/plans";
import { PLAN_DEFINITIONS } from "@/lib/saas/plans";
import { TIER_COLORS } from "./PlanBadge";

export type FeatureKey = keyof PlanLimits;

// Human-readable names + descriptions for every gateable feature. Used by the
// default UpgradePrompt so we get a nice "Multi-Agent Debate requires the
// Investigator plan" message instead of a raw camelCase key.
export const FEATURE_INFO: Partial<
  Record<FeatureKey, { label: string; description: string; recommendedTier: PlanTier }>
> = {
  multiAgentDebate: {
    label: "Multi-Agent Debate",
    description: "7 specialized agents analyze the target in parallel and a coordinator synthesizes their findings into a consensus report with dissent preservation.",
    recommendedTier: "investigator",
  },
  visualIntelligence: {
    label: "Visual Intelligence (VLM)",
    description: "Vision-language model analysis of images — faces, objects, text, scene context, and metadata extraction for visual OSINT.",
    recommendedTier: "investigator",
  },
  cryptoTracing: {
    label: "Crypto Wallet Tracing",
    description: "Address resolution, transaction graph analysis, risk scoring, and cluster detection for blockchain investigations.",
    recommendedTier: "investigator",
  },
  batchSanctions: {
    label: "Batch Sanctions Screening",
    description: "Upload a CSV of names/entities for bulk OFAC + sanctions screening with fuzzy matching and risk-tiered results.",
    recommendedTier: "free",
  },
  apiAccess: {
    label: "Programmatic API Access",
    description: "Generate API keys to run investigations, queries, and exports from external scripts, automation, or integrations.",
    recommendedTier: "professional",
  },
  automationEnabled: {
    label: "Automation & Scheduled Investigations",
    description: "Schedule recurring investigations, trigger monitors on a cron, and chain pipelines via webhooks.",
    recommendedTier: "professional",
  },
  whiteLabelReports: {
    label: "White-Label Reports",
    description: "Custom branding, logos, and color schemes on exported PDF/Markdown intelligence reports for client deliverables.",
    recommendedTier: "team",
  },
  customSources: {
    label: "Custom OSINT Sources",
    description: "Register your own private source adapters (internal databases, paid feeds) for inclusion in the routing pipeline.",
    recommendedTier: "enterprise",
  },
  ssoEnabled: {
    label: "SSO / SAML",
    description: "Single sign-on via SAML 2.0 / OIDC for enterprise identity providers (Okta, Azure AD, Google Workspace).",
    recommendedTier: "enterprise",
  },
  prioritySupport: {
    label: "Priority Support",
    description: "Faster response times, dedicated escalation path, and direct access to senior engineering.",
    recommendedTier: "professional",
  },
  dedicatedCsm: {
    label: "Dedicated Customer Success Manager",
    description: "A named CSM who owns your account, provides onboarding, and acts as your advocate inside OSINTiger.",
    recommendedTier: "enterprise",
  },
};

// ─── UpgradePrompt ────────────────────────────────────────────────────────────

export function UpgradePrompt({
  feature,
  message,
  compact = false,
}: {
  feature: FeatureKey;
  message?: string;
  compact?: boolean;
}) {
  const navigate = useNavigate();
  const info = FEATURE_INFO[feature];
  const label = info?.label || prettifyKey(feature);
  const description = message || info?.description || "This capability is available on a higher plan.";
  const recommendedTier: PlanTier = info?.recommendedTier || "investigator";
  const recPlan = PLAN_DEFINITIONS.find((p) => p.tier === recommendedTier);
  const recColors = TIER_COLORS[recommendedTier];

  if (compact) {
    return (
      <button
        onClick={() => navigate({ name: "pricing" })}
        className="inline-flex items-center gap-1.5 border border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--hack-amber)] transition hover:bg-[var(--hack-amber)]/15"
        title={`Upgrade to unlock ${label}`}
      >
        <Lock className="h-3 w-3" />
        <span>{label}</span>
        <ArrowUpRight className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="border border-dashed border-[var(--hack-amber)]/40 bg-gradient-to-br from-[var(--hack-amber)]/[0.04] to-transparent p-5 my-3 relative overflow-hidden">
      {/* Subtle corner accent */}
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full bg-[var(--hack-amber)]/[0.06] blur-2xl pointer-events-none" />

      <div className="flex items-start gap-3 relative">
        <div className="flex h-10 w-10 items-center justify-center border border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10 shrink-0">
          <Lock className="h-5 w-5 text-[var(--hack-amber)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-mono text-sm font-semibold text-[var(--hack-amber)] uppercase tracking-wider">
              {label}
            </h3>
            {recPlan && (
              <span className={`inline-flex items-center gap-1 border ${recColors.border} px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider ${recColors.text}`}>
                <Sparkles className="h-2.5 w-2.5" />
                {recPlan.name} plan
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--hack-gray)] font-mono leading-relaxed">
            {description}
          </p>
          {recPlan && (
            <p className="mt-1 text-[10px] text-[var(--hack-gray)]/60 font-mono">
              {"// available on the "}<span className={recColors.text}>{recPlan.name}</span>{" plan"}
              {recPlan.priceMonthly > 0 && (
                <span> · {"from "}<span className={recColors.text}>${(recPlan.priceMonthly / 100).toFixed(0)}/mo</span></span>
              )}
            </p>
          )}
          <div className="mt-3">
            <button
              onClick={() => navigate({ name: "pricing" })}
              className="inline-flex items-center gap-1.5 border border-[var(--hack-green)]/50 bg-[var(--hack-green)]/10 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--hack-green)] transition hover:bg-[var(--hack-green)]/20 hover:border-[var(--hack-green)]"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── FeatureGate ──────────────────────────────────────────────────────────────

export function FeatureGate({
  feature,
  fallback,
  children,
}: {
  feature: FeatureKey;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { planLimits, loading } = useSubscription();

  // Optimistic default while loading — flash the feature rather than a locked
  // state on first paint. After load, the real check kicks in.
  if (loading && !planLimits) {
    return <>{children}</>;
  }

  const allowed = isFeatureAllowed(planLimits, feature);
  if (allowed) return <>{children}</>;
  return <>{fallback ?? <UpgradePrompt feature={feature} />}</>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pure check used by both FeatureGate and any non-hook code. Mirrors the
 * server-side `checkFeatureEntitlement` in src/lib/saas/entitlements.ts so
 * the gating logic stays in sync.
 */
export function isFeatureAllowed(
  limits: PlanLimits | null | undefined,
  feature: FeatureKey
): boolean {
  if (!limits) return false;
  const value = limits[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0 || value === -1;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function prettifyKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}
