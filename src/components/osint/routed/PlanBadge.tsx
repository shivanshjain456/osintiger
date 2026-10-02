"use client";

// PlanBadge — compact header widget showing the user's current plan tier.
//
// Renders three states:
//   1. Not logged in → "Sign In" button (navigates to #/login)
//   2. Logged in, free tier → "Free · Upgrade" with a link to #/pricing
//   3. Logged in, paid tier → colored dot + tier name (links to #/billing)
//
// Uses the singleton useSubscription hook (backed by /api/auth/me which reads
// the Supabase session) + the Supabase useAuth() hook for instant state updates.

import { LogIn, ArrowUpRight } from "lucide-react";
import { useSubscription, primeSubscriptionCache, reloadSubscription } from "@/lib/saas/use-subscription";
import { useNavigate } from "@/lib/router/useRouter";
import type { PlanTier } from "@/lib/saas/plans";
import { useEffect } from "react";

export const TIER_COLORS: Record<PlanTier, { dot: string; text: string; border: string }> = {
  free: { dot: "bg-[var(--hack-gray)]", text: "text-[var(--hack-gray)]", border: "border-[var(--hack-border)]" },
  investigator: { dot: "bg-[var(--hack-green)]", text: "text-[var(--hack-green)]", border: "border-[var(--hack-green)]/40" },
  professional: { dot: "bg-[var(--hack-cyan)]", text: "text-[var(--hack-cyan)]", border: "border-[var(--hack-cyan)]/40" },
  team: { dot: "bg-[var(--hack-purple)]", text: "text-[var(--hack-purple)]", border: "border-[var(--hack-purple)]/40" },
  enterprise: { dot: "bg-[var(--hack-amber)]", text: "text-[var(--hack-amber)]", border: "border-[var(--hack-amber)]/40" },
};

const TIER_LABEL: Record<PlanTier, string> = {
  free: "Free",
  investigator: "Investigator",
  professional: "Professional",
  team: "Team",
  enterprise: "Enterprise",
};

export function PlanBadge() {
  const navigate = useNavigate();
  const { user, tier, loading } = useSubscription();

  // Kick off the singleton fetch as soon as the badge mounts (it's in the
  // always-rendered header, so this effectively primes the cache for every
  // other SaaS-aware component on the page).
  useEffect(() => {
    primeSubscriptionCache();
  }, []);

  // Loading skeleton — keep height stable to avoid layout shift.
  if (loading && !user) {
    return (
      <div className="flex items-center gap-1.5 h-7 px-2 border border-[var(--hack-border)] bg-transparent">
        <span className="h-1.5 w-1.5 bg-[var(--hack-gray)]/40 rounded-full animate-pulse" />
        <span className="text-[10px] font-mono text-[var(--hack-gray)]/40 uppercase tracking-wider">···</span>
      </div>
    );
  }

  // Not logged in — show Sign In CTA.
  if (!user) {
    return (
      <button
        onClick={() => navigate({ name: "login" })}
        className="flex items-center gap-1.5 h-7 px-2 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 text-[10px] font-mono uppercase tracking-wider text-[var(--hack-green)] transition hover:bg-[var(--hack-green)]/15"
        title="Sign in"
      >
        <LogIn className="h-3 w-3" />
        <span className="hidden sm:inline">Sign In</span>
      </button>
    );
  }

  const colors = TIER_COLORS[tier] || TIER_COLORS.free;
  const isFree = tier === "free";

  // Free tier → show "Free" + Upgrade link to push conversion.
  if (isFree) {
    return (
      <button
        onClick={() => navigate({ name: "pricing" })}
        className="group flex items-center gap-1.5 h-7 px-2 border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 text-[10px] font-mono uppercase tracking-wider text-[var(--hack-green)] transition hover:bg-[var(--hack-green)]/15"
        title="You're on the Free plan — click to upgrade"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
        <span className="hidden sm:inline">{TIER_LABEL[tier]}</span>
        <ArrowUpRight className="h-3 w-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        <span className="hidden md:inline text-[var(--hack-cyan)]">Upgrade</span>
      </button>
    );
  }

  // Paid tier → colored dot + tier name → links to billing dashboard.
  return (
    <button
      onClick={() => navigate({ name: "billing" })}
      className={`group flex items-center gap-1.5 h-7 px-2 border ${colors.border} bg-black/30 text-[10px] font-mono uppercase tracking-wider ${colors.text} transition hover:bg-black/50`}
      title={`Plan: ${TIER_LABEL[tier]} — manage subscription`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      <span className="hidden sm:inline">{TIER_LABEL[tier]}</span>
    </button>
  );
}
