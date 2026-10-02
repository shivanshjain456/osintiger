"use client";

// SaasViews — the commercial experience: pricing, billing, auth, account.
//
// Exports:
//   - PricingView          the public pricing page (5 tiers + credit packs + FAQ)
//   - BillingView          the signed-in billing dashboard
//   - BillingInvoicesView  invoice history table
//   - BillingCreditsView   AI credit balance + packs + cost reference
//   - BillingApiKeysView   API key management (Professional+)
//   - LoginView            sign-in form (NextAuth credentials)
//   - SignupView           registration form + auto sign-in
//   - AccountView          profile / password / danger zone
//
// All views use the existing cyberpunk/hacker aesthetic (green/cyan/amber on
// near-black, monospace fonts, glow on featured elements). Forms have proper
// loading/error/success states. Navigation goes through the hash router so
// every state is deep-linkable.
//
// API surface used:
//   /api/auth/me            → session + subscription + planLimits
//   (Supabase Auth handles signup client-side via supabase.auth.signUp())
//   /api/billing/plans      → public plan catalog
//   /api/billing/subscription → tier + usage + credit balance
//   /api/billing/invoices   → invoice history
//   /api/billing/credits    → (optional, may 404) recent credit transactions
//   /api/api-keys           → (optional, may 404) API key CRUD
//   /api/account/profile    → (optional, may 404) profile edits
//   /api/account/password   → (optional, may 404) password change
//   /api/stripe/checkout    → { url } for plan checkout
//   /api/stripe/portal      → { url } for the Stripe customer portal
//   /api/stripe/credit-pack → { url } for one-time credit pack purchase

import { useState, useEffect, useCallback } from "react";

import {
  Tag,
  CreditCard,
  Receipt,
  Zap,
  KeyRound,
  LogIn,
  UserPlus,
  CircleUser,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Lock,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Trash2,
  ShieldAlert,
  ExternalLink,
  Info,
  Download,
  Plus,
  Copy,
  Eye,
  EyeOff,
} from "lucide-react";
import { PageHeader, SectionHeader, Tag as PTag, EmptyState } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate } from "@/lib/router/useRouter";
import { useSubscription, reloadSubscription } from "@/lib/saas/use-subscription";
import {
  CREDIT_PACKS,
  AI_CREDIT_COSTS,
  PLAN_DEFINITIONS,
  isUnlimited,
  type PlanTier,
} from "@/lib/saas/plans";

// ─── Shared layout shell ─────────────────────────────────────────────────────

function Shell({ children, max = "max-w-7xl" }: { children: React.ReactNode; max?: string }) {
  return (
    <div className={`mx-auto ${max} px-4 sm:px-6 lg:px-8 py-8`}>
      <RouteBreadcrumbs />
      {children}
    </div>
  );
}

const TIER_DOT: Record<PlanTier, string> = {
  free: "bg-[var(--hack-gray)]",
  investigator: "bg-[var(--hack-green)]",
  professional: "bg-[var(--hack-cyan)]",
  team: "bg-[var(--hack-purple)]",
  enterprise: "bg-[var(--hack-amber)]",
};
const TIER_TEXT: Record<PlanTier, string> = {
  free: "text-[var(--hack-gray)]",
  investigator: "text-[var(--hack-green)]",
  professional: "text-[var(--hack-cyan)]",
  team: "text-[var(--hack-purple)]",
  enterprise: "text-[var(--hack-amber)]",
};

// ─── Plan shape from the API ─────────────────────────────────────────────────

interface PlanRow {
  id: string;
  tier: PlanTier;
  name: string;
  tagline: string;
  description: string;
  priceMonthly: number;
  priceAnnual: number;
  isFeatured: boolean;
  featuresJson: string;
  limitsJson: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRICING VIEW
// ─────────────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: "Can I change plans at any time?",
    a: "Yes. Upgrades take effect immediately and you're billed a prorated amount for the remainder of the cycle. Downgrades take effect at the start of your next billing period.",
  },
  {
    q: "What happens when I hit my investigation limit?",
    a: "You'll see an upgrade prompt inline. Existing investigations remain accessible — you just can't start new ones until the next period or until you upgrade.",
  },
  {
    q: "Do unused AI credits roll over?",
    a: "Monthly credit grants reset each billing period. Purchased credit packs never expire and are consumed only after your monthly grant is exhausted.",
  },
  {
    q: "Is there a free trial?",
    a: "Every paid plan starts with a 14-day free trial. No credit card required until the trial ends. You can cancel anytime during the trial at no cost.",
  },
  {
    q: "Can I get a refund?",
    a: "We offer a no-questions-asked refund within 7 days of any payment. Contact support from the in-app feedback form or email billing@osintiger.example.",
  },
];

export function PricingView({ initialCycle = "monthly" }: { initialCycle?: "monthly" | "annual" }) {
  const [cycle, setCycle] = useState<"monthly" | "annual">(initialCycle);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutTier, setCheckoutTier] = useState<PlanTier | null>(null);
  const [checkoutPack, setCheckoutPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/billing/plans", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        // The API returns plans ordered by sortOrder ASC, but we re-sort here
        // to be defensive (in case the seed was tampered with).
        const rows = ((d.plans || []) as PlanRow[]).slice().sort((a, b) => {
          const ao = PLAN_ORDER[a.tier] ?? 99;
          const bo = PLAN_ORDER[b.tier] ?? 99;
          return ao - bo;
        });
        setPlans(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load plans.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function startCheckout(tier: PlanTier) {
    if (tier === "free") {
      navigate({ name: "signup" });
      return;
    }
    if (tier === "enterprise") {
      navigate({ name: "support" });
      return;
    }
    setError(null);
    setCheckoutTier(tier);
    try {
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, cycle }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Checkout failed");
      if (d.url) window.location.href = d.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setCheckoutTier(null);
    }
  }

  async function buyCreditPack(packId: string) {
    setError(null);
    setCheckoutPack(packId);
    try {
      const r = await fetch("/api/stripe/credit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Purchase failed");
      if (d.url) window.location.href = d.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setCheckoutPack(null);
    }
  }

  return (
    <Shell>
      <PageHeader
        icon={Tag}
        title="Pricing"
        subtitle="// pick a tier · 14-day free trial on every paid plan"
        accent="green"
        actions={
          <div className="inline-flex border border-[var(--hack-border)] bg-black/30">
            <CycleButton active={cycle === "monthly"} onClick={() => setCycle("monthly")}>
              Monthly
            </CycleButton>
            <CycleButton active={cycle === "annual"} onClick={() => setCycle("annual")}>
              Annual{" "}
              <span className="ml-1 text-[9px] text-[var(--hack-green)]">−2mo</span>
            </CycleButton>
          </div>
        }
      />

      {error && (
        <div className="mb-4 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-3 text-xs font-mono text-[var(--hack-red)] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Plan grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-96 border border-[var(--hack-border)] bg-black/20 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
          {plans.map((p) => (
            <PlanCard
              key={p.tier}
              plan={p}
              cycle={cycle}
              onCta={() => startCheckout(p.tier)}
              loading={checkoutTier === p.tier}
            />
          ))}
        </div>
      )}

      {/* ── Credit packs ──────────────────────────────────────────────────── */}
      <div className="mt-14">
        <SectionHeader title="AI Credit Packs" icon={Zap} right={
          <span className="text-[10px] font-mono text-[var(--hack-gray)]/70">
            top up anytime · credits never expire
          </span>
        } />
        <p className="text-xs text-[var(--hack-gray)] font-mono mb-4">
          Need more AI credits without changing plans? Purchase a one-time pack. Credits are consumed only after your monthly grant runs out.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative border ${
                pack.popular
                  ? "border-[var(--hack-cyan)]/50 bg-[var(--hack-cyan)]/[0.04]"
                  : "border-[var(--hack-border)] bg-black/20"
              } p-4 flex flex-col`}
            >
              {pack.popular && (
                <span className="absolute -top-2 left-3 inline-flex items-center gap-1 border border-[var(--hack-cyan)]/50 bg-[var(--hack-bg)] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[var(--hack-cyan)]">
                  <Sparkles className="h-2.5 w-2.5" /> Best Value
                </span>
              )}
              <div className="text-2xl font-bold font-mono text-[var(--hack-green)]">
                {pack.credits.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)] mt-0.5">
                credits
              </div>
              <div className="mt-3 text-lg font-mono text-[var(--hack-cyan)]">
                ${(pack.priceCents / 100).toFixed(2)}
              </div>
              <div className="text-[10px] font-mono text-[var(--hack-gray)]/60 mb-3">
                ${(pack.priceCents / pack.credits).toFixed(3)}/credit
              </div>
              <button
                onClick={() => buyCreditPack(pack.id)}
                disabled={checkoutPack !== null}
                className="mt-auto border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--hack-green)] transition hover:bg-[var(--hack-green)]/15 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              >
                {checkoutPack === pack.id ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Redirecting…</>
                ) : (
                  <>Buy Pack</>
                )}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-[var(--hack-gray)]/60 font-mono">
          {"// You'll be redirected to Stripe Checkout. Credits post to your account within seconds of payment confirmation."}
        </p>
      </div>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <div className="mt-14">
        <SectionHeader title="Frequently Asked Questions" icon={Info} />
        <div className="space-y-2 max-w-3xl">
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

const PLAN_ORDER: Record<PlanTier, number> = {
  free: 0,
  investigator: 1,
  professional: 2,
  team: 3,
  enterprise: 4,
};

function CycleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[11px] font-mono uppercase tracking-wider transition ${
        active
          ? "bg-[var(--hack-green)]/15 text-[var(--hack-green)]"
          : "text-[var(--hack-gray)] hover:text-[var(--hack-green)]"
      }`}
    >
      {children}
    </button>
  );
}

function PlanCard({
  plan,
  cycle,
  onCta,
  loading,
}: {
  plan: PlanRow;
  cycle: "monthly" | "annual";
  onCta: () => void;
  loading: boolean;
}) {
  const features = parseFeatures(plan.featuresJson);
  const isEnterprise = plan.tier === "enterprise";
  const isFree = plan.tier === "free";
  const featured = plan.isFeatured;

  const price = cycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
  const perMonthEquivalent =
    cycle === "annual" && plan.priceAnnual > 0
      ? Math.round((plan.priceAnnual / 12) / 100) * 100
      : plan.priceMonthly;
  const savings =
    cycle === "annual" && plan.priceMonthly > 0
      ? plan.priceMonthly * 12 - plan.priceAnnual
      : 0;

  const ctaLabel = isFree ? "Start Free" : isEnterprise ? "Contact Sales" : "Start 14-Day Trial";

  return (
    <div
      className={`relative flex flex-col border p-5 ${
        featured
          ? "border-[var(--hack-green)]/60 bg-gradient-to-b from-[var(--hack-green)]/[0.06] to-transparent glow-green"
          : "border-[var(--hack-border)] bg-black/20"
      } transition hover:border-[var(--hack-green)]/40`}
      style={featured ? { boxShadow: "0 0 24px rgba(0,255,65,0.18)" } : undefined}
    >
      {featured && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 border border-[var(--hack-green)] bg-[var(--hack-bg)] px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.15em] text-[var(--hack-green)]">
          <Sparkles className="h-2.5 w-2.5" /> Most Popular
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <span className={`h-2 w-2 rounded-full ${TIER_DOT[plan.tier]}`} />
        <h3 className={`font-mono text-sm font-bold uppercase tracking-wider ${TIER_TEXT[plan.tier]}`}>
          {plan.name}
        </h3>
      </div>
      <p className="text-[11px] text-[var(--hack-gray)] font-mono mb-3 leading-relaxed">{plan.tagline}</p>

      <div className="mb-4">
        {isEnterprise ? (
          <div className="text-3xl font-bold font-mono text-[var(--hack-amber)]">Custom</div>
        ) : (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold font-mono text-[var(--hack-green)]">
                ${price === 0 ? "0" : (price / 100).toFixed(price % 100 === 0 ? 0 : 2)}
              </span>
              <span className="text-[10px] font-mono text-[var(--hack-gray)] uppercase">
                {price === 0 ? "/forever" : cycle === "annual" ? "/yr" : "/mo"}
              </span>
            </div>
            {cycle === "annual" && perMonthEquivalent > 0 && (
              <div className="text-[10px] font-mono text-[var(--hack-cyan)] mt-0.5">
                ≈ ${(perMonthEquivalent / 100).toFixed(0)}/mo equiv
                {savings > 0 && (
                  <span className="ml-1 inline-flex items-center border border-[var(--hack-green)]/30 px-1 text-[9px] text-[var(--hack-green)]">
                    save ${(savings / 100).toFixed(0)}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ul className="space-y-1.5 mb-5 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] font-mono text-[var(--hack-gray)] leading-relaxed">
            <Check className="h-3 w-3 mt-0.5 text-[var(--hack-green)] shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onCta}
        disabled={loading}
        className={`w-full border px-3 py-2 text-[11px] font-mono uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 ${
          featured
            ? "border-[var(--hack-green)] bg-[var(--hack-green)]/20 text-[var(--hack-green)] hover:bg-[var(--hack-green)]/30"
            : isEnterprise
            ? "border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/5 text-[var(--hack-amber)] hover:bg-[var(--hack-amber)]/15"
            : "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 text-[var(--hack-green)] hover:bg-[var(--hack-green)]/15"
        }`}
      >
        {loading ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting…</>
        ) : (
          <>{ctaLabel} <ArrowRight className="h-3.5 w-3.5" /></>
        )}
      </button>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--hack-border)] bg-black/20">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 p-3 text-left"
      >
        <span className="font-mono text-xs text-[var(--hack-green)]">{q}</span>
        <ChevronDown className={`h-4 w-4 text-[var(--hack-gray)] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 text-[11px] font-mono text-[var(--hack-gray)] leading-relaxed">
          {a}
        </div>
      )}
    </div>
  );
}

function parseFeatures(json: string): string[] {
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  } catch {
    // ignore
  }
  // Fallback: use the in-app definitions so the page always has content even
  // if the DB hasn't been seeded yet.
  const tier = (json as never) as PlanTier;
  const def = PLAN_DEFINITIONS.find((p) => p.tier === tier);
  return def?.marketing.features || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. BILLING VIEW
// ─────────────────────────────────────────────────────────────────────────────

interface SubscriptionData {
  subscription: {
    tier: PlanTier;
    status: string;
    billingCycle: "monthly" | "annual";
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  usage: {
    investigations: { count: number; limit: number };
    aiCredits: { count: number; limit: number };
  } | null;
  creditBalance: number;
}

export function BillingView() {
  const navigate = useNavigate();
  const { user, loading: subLoading } = useSubscription();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/billing/subscription", { cache: "no-store" });
      if (r.status === 401) {
        setData(null);
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load subscription");
      setData(d as SubscriptionData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/stripe/portal", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to open portal");
      if (d.url) window.location.href = d.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setPortalLoading(false);
    }
  }

  // Not signed in.
  if (!subLoading && !user) {
    return (
      <Shell max="max-w-3xl">
        <PageHeader icon={CreditCard} title="Billing & Subscription" subtitle="// manage your plan" />
        <div className="border border-dashed border-[var(--hack-border)] bg-black/20 p-10 text-center">
          <Lock className="h-10 w-10 text-[var(--hack-gray)]/40 mx-auto mb-3" />
          <h3 className="font-mono text-sm font-semibold text-[var(--hack-gray)] mb-1">Sign in to manage your subscription</h3>
          <p className="text-xs text-[var(--hack-gray)]/60 font-mono mb-4">
            View usage, change plans, download invoices, and buy credit packs.
          </p>
          <button
            onClick={() => navigate({ name: "login" })}
            className="inline-flex items-center gap-1.5 border border-[var(--hack-green)]/50 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 transition"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign In
          </button>
        </div>
      </Shell>
    );
  }

  const tier = data?.subscription?.tier || "free";
  const planDef = PLAN_DEFINITIONS.find((p) => p.tier === tier);
  const isFree = tier === "free";
  const isCanceled = data?.subscription?.cancelAtPeriodEnd === true;

  return (
    <Shell>
      <PageHeader
        icon={CreditCard}
        title="Billing & Subscription"
        subtitle="// plan · usage · credits"
        accent="green"
        actions={
          !isFree && data?.subscription ? (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-1.5 border border-[var(--hack-border)] bg-black/30 px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--hack-gray)] hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)] transition disabled:opacity-50"
              title="Stripe Customer Portal — update card, cancel, view invoices"
            >
              {portalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
              <span className="hidden sm:inline">Manage in Stripe</span>
            </button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-3 text-xs font-mono text-[var(--hack-red)] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {loading || !data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 border border-[var(--hack-border)] bg-black/20 animate-pulse" />
          <div className="h-64 border border-[var(--hack-border)] bg-black/20 animate-pulse" />
        </div>
      ) : (
        <>
          {/* ── Current plan ────────────────────────────────────────────── */}
          {isFree ? (
            <FreeUpgradeCard onUpgrade={() => navigate({ name: "pricing" })} />
          ) : (
            <div className="border border-[var(--hack-border)] bg-black/20 p-5 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-2.5 w-2.5 rounded-full ${TIER_DOT[tier]}`} />
                    <h2 className={`font-mono text-lg font-bold uppercase tracking-wider ${TIER_TEXT[tier]}`}>
                      {planDef?.name || tier}
                    </h2>
                    <StatusBadge status={data.subscription?.status || "active"} />
                    {isCanceled && (
                      <PTag color="amber">cancels at period end</PTag>
                    )}
                  </div>
                  <p className="text-xs text-[var(--hack-gray)] font-mono">
                    {planDef?.tagline}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-[10px] font-mono text-[var(--hack-gray)]/70">
                    <span>
                      billing cycle: <span className="text-[var(--hack-cyan)]">{data.subscription?.billingCycle}</span>
                    </span>
                    {data.subscription?.currentPeriodEnd && (
                      <span>
                        renews: <span className="text-[var(--hack-green)]">{new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate({ name: "pricing" })}
                    className="inline-flex items-center gap-1.5 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/15 transition"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" /> Upgrade
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Usage meters ────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <UsageMeter
              label="Investigations"
              used={data.usage?.investigations.count ?? 0}
              limit={data.usage?.investigations.limit ?? planDef?.limits.investigationsPerMonth ?? 0}
              period="this billing period"
            />
            <UsageMeter
              label="AI Credits"
              used={data.usage?.aiCredits.count ?? 0}
              limit={data.usage?.aiCredits.limit ?? planDef?.limits.aiCreditsPerMonth ?? 0}
              period="this billing period"
            />
          </div>

          {/* ── Credits balance + quick links ──────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/[0.04] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)]">Purchased Credit Balance</span>
                <Zap className="h-4 w-4 text-[var(--hack-cyan)]" />
              </div>
              <div className="text-3xl font-bold font-mono text-[var(--hack-cyan)]">
                {data.creditBalance.toLocaleString()}
              </div>
              <div className="text-[10px] text-[var(--hack-gray)]/70 font-mono mt-1 mb-3">
                consumed after monthly grant runs out · never expire
              </div>
              <button
                onClick={() => navigate({ name: "billing-credits" })}
                className="inline-flex items-center gap-1 border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--hack-cyan)] hover:bg-[var(--hack-cyan)]/15 transition"
              >
                <Plus className="h-3 w-3" /> Buy more credits
              </button>
            </div>

            <QuickLink
              icon={Receipt}
              title="Invoices"
              desc="Download past invoices and receipts."
              onClick={() => navigate({ name: "billing-invoices" })}
            />
            <QuickLink
              icon={KeyRound}
              title="API Keys"
              desc="Programmatic access for automation."
              onClick={() => navigate({ name: "billing-api-keys" })}
              locked={planDef ? !planDef.limits.apiAccess : true}
            />
          </div>
        </>
      )}
    </Shell>
  );
}

function FreeUpgradeCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="relative border border-[var(--hack-green)]/40 bg-gradient-to-br from-[var(--hack-green)]/[0.08] to-transparent p-5 mb-4 overflow-hidden">
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[var(--hack-green)]/[0.06] blur-3xl pointer-events-none" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--hack-gray)]" />
            <h2 className="font-mono text-lg font-bold uppercase tracking-wider text-[var(--hack-gray)]">Free Plan</h2>
            <PTag color="gray">limited</PTag>
          </div>
          <p className="text-xs text-[var(--hack-gray)] font-mono">
            3 investigations / month · 10 AI credits · basic sources. Upgrade to unlock the full platform.
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="inline-flex items-center gap-1.5 border border-[var(--hack-green)] bg-[var(--hack-green)]/20 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/30 transition"
        >
          <Sparkles className="h-3.5 w-3.5" /> View Plans <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function UsageMeter({
  label,
  used,
  limit,
  period,
}: {
  label: string;
  used: number;
  limit: number;
  period: string;
}) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
  const color =
    pct < 70 ? "var(--hack-green)" : pct < 90 ? "var(--hack-amber)" : "var(--hack-red)";
  const text =
    pct < 70 ? "text-[var(--hack-green)]" : pct < 90 ? "text-[var(--hack-amber)]" : "text-[var(--hack-red)]";

  return (
    <div className="border border-[var(--hack-border)] bg-black/20 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)]">{label}</span>
        <span className="text-[10px] font-mono text-[var(--hack-gray)]/60">{period}</span>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className={`text-2xl font-bold font-mono ${text}`}>{used.toLocaleString()}</span>
          <span className="text-xs font-mono text-[var(--hack-gray)] mx-1">/</span>
          <span className="text-sm font-mono text-[var(--hack-gray)]">
            {unlimited ? "∞" : limit.toLocaleString()}
          </span>
        </div>
        {!unlimited && pct >= 90 && (
          <PTag color="red">limit reached</PTag>
        )}
      </div>
      <div className="h-2 bg-black/40 border border-[var(--hack-border)] overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${unlimited ? 8 : Math.max(2, pct)}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
      {!unlimited && (
        <div className="mt-1 text-[10px] font-mono text-[var(--hack-gray)]/60">
          {pct < 70
            ? `${(100 - pct).toFixed(0)}% remaining`
            : pct < 90
            ? `${(100 - pct).toFixed(0)}% remaining — approaching limit`
            : `limit reached — upgrade to continue`}
        </div>
      )}
    </div>
  );
}

function QuickLink({
  icon: Icon,
  title,
  desc,
  onClick,
  locked,
}: {
  icon: typeof Receipt;
  title: string;
  desc: string;
  onClick: () => void;
  locked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left border border-[var(--hack-border)] bg-black/20 p-4 transition hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5"
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-5 w-5 text-[var(--hack-green)]" />
        {locked ? (
          <Lock className="h-3 w-3 text-[var(--hack-amber)]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--hack-gray)] group-hover:translate-x-0.5 transition" />
        )}
      </div>
      <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase tracking-wider">
        {title}
      </h3>
      <p className="mt-1 text-xs text-[var(--hack-gray)] leading-relaxed">{desc}</p>
      {locked && (
        <p className="mt-2 text-[10px] font-mono text-[var(--hack-amber)]">requires Professional+</p>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "active" || status === "free"
      ? "green"
      : status === "trialing"
      ? "cyan"
      : status === "past_due" || status === "canceled"
      ? "red"
      : "amber";
  return <PTag color={color as "green" | "cyan" | "red" | "amber"}>{status}</PTag>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. BILLING INVOICES VIEW
// ─────────────────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string;
  number: string | null;
  status: string;
  amountPaid: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  invoicePdfUrl: string | null;
  hostedInvoiceUrl: string | null;
  paidAt: string | null;
}

export function BillingInvoicesView() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Defer setLoading to avoid the synchronous-setState-in-effect anti-pattern.
    queueMicrotask(() => setLoading(true));
    fetch("/api/billing/invoices", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          setError("Sign in to view invoices");
          return [];
        }
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to load invoices");
        return (d.invoices || []) as InvoiceRow[];
      })
      .then((rows) => !cancelled && setInvoices(rows))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Failed"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Shell max="max-w-5xl">
      <PageHeader icon={Receipt} title="Invoices" subtitle="// billing history & receipts" accent="cyan" />
      {error && (
        <div className="mb-4 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-3 text-xs font-mono text-[var(--hack-red)] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 border border-[var(--hack-border)] bg-black/20 animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices yet"
          description="Invoices appear here after your first paid subscription payment. Free plan usage isn't invoiced."
          action={
            <button
              onClick={() => navigate({ name: "pricing" })}
              className="inline-flex items-center gap-1.5 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/15 transition"
            >
              <ArrowUpRight className="h-3.5 w-3.5" /> View Plans
            </button>
          }
        />
      ) : (
        <div className="border border-[var(--hack-border)] bg-black/20 overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--hack-border)] text-left text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Invoice #</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-[var(--hack-border)]/50 hover:bg-[var(--hack-green)]/[0.03]">
                  <td className="px-3 py-2 text-[var(--hack-gray)]">
                    {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--hack-cyan)]">{inv.number || "—"}</td>
                  <td className="px-3 py-2 text-[var(--hack-green)]">
                    {formatCurrency(inv.amountPaid, inv.currency)}
                  </td>
                  <td className="px-3 py-2">
                    <InvoiceStatus status={inv.status} />
                  </td>
                  <td className="px-3 py-2 text-[var(--hack-gray)]">
                    {inv.periodStart && inv.periodEnd
                      ? `${new Date(inv.periodStart).toLocaleDateString()} → ${new Date(inv.periodEnd).toLocaleDateString()}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {inv.invoicePdfUrl ? (
                      <a
                        href={inv.invoicePdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--hack-green)] hover:underline"
                      >
                        <Download className="h-3 w-3" /> PDF
                      </a>
                    ) : inv.hostedInvoiceUrl ? (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--hack-cyan)] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> View
                      </a>
                    ) : (
                      <span className="text-[var(--hack-gray)]/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

function InvoiceStatus({ status }: { status: string }) {
  const map: Record<string, "green" | "amber" | "red" | "gray"> = {
    paid: "green",
    open: "amber",
    void: "gray",
    uncollectible: "red",
  };
  return <PTag color={map[status] || "gray"}>{status}</PTag>;
}

function formatCurrency(amount: number, currency: string): string {
  if (amount === 0) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() || "USD" }).format(amount / 100);
  } catch {
    return `$${(amount / 100).toFixed(2)}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. BILLING CREDITS VIEW
// ─────────────────────────────────────────────────────────────────────────────

export function BillingCreditsView() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Array<{ reason: string; amount: number; balanceAfter: number; createdAt: string; description: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subR, txR] = await Promise.allSettled([
        fetch("/api/billing/subscription", { cache: "no-store" }),
        fetch("/api/billing/credits", { cache: "no-store" }),
      ]);
      if (subR.status === "fulfilled") {
        const d = await subR.value.json();
        if (subR.value.ok) setBalance(d.creditBalance ?? 0);
        else if (subR.value.status === 401) setError("Sign in to manage credits");
      }
      if (txR.status === "fulfilled") {
        const d = await txR.value.json();
        if (txR.value.ok) {
          setTransactions(d.transactions || []);
        } else if (txR.value.status === 401) {
          setError("Sign in to manage credits");
        }
        // For other errors (500, etc.), leave transactions empty — don't show "coming soon"
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function buyPack(packId: string) {
    setBuyingPack(packId);
    setError(null);
    try {
      const r = await fetch("/api/stripe/credit-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      if (d.url) window.location.href = d.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBuyingPack(null);
    }
  }

  return (
    <Shell max="max-w-5xl">
      <PageHeader icon={Zap} title="AI Credits" subtitle="// balance · packs · consumption" accent="cyan" />

      {error && (
        <div className="mb-4 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-3 text-xs font-mono text-[var(--hack-red)] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── Balance ─────────────────────────────────────────────────────── */}
      <div className="border border-[var(--hack-cyan)]/40 bg-gradient-to-br from-[var(--hack-cyan)]/[0.08] to-transparent p-5 mb-4 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-[var(--hack-cyan)]/[0.08] blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)] mb-1">
              Purchased Credit Balance
            </div>
            <div className="text-4xl font-bold font-mono text-[var(--hack-cyan)]">
              {loading ? "···" : (balance ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] text-[var(--hack-gray)]/70 font-mono mt-1">
              {"// consumed only after your monthly grant · never expire"}
            </div>
          </div>
          <button
            onClick={() => document.getElementById("credit-packs")?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-1.5 border border-[var(--hack-cyan)]/50 bg-[var(--hack-cyan)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-cyan)] hover:bg-[var(--hack-cyan)]/20 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Buy Credits
          </button>
        </div>
      </div>

      {/* ── Recent transactions ─────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Recent Transactions" icon={Receipt} />
        {transactions.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="AI credit consumption and grants will appear here once you start using AI features or purchase a pack."
          />
        ) : (
          <div className="border border-[var(--hack-border)] bg-black/20 overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-[var(--hack-border)] text-left text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Operation</th>
                  <th className="px-3 py-2 text-right">Change</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 25).map((t, i) => (
                  <tr key={i} className="border-b border-[var(--hack-border)]/50">
                    <td className="px-3 py-2 text-[var(--hack-gray)]">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-[var(--hack-cyan)]">{t.description || t.reason}</td>
                    <td className={`px-3 py-2 text-right ${t.amount >= 0 ? "text-[var(--hack-green)]" : "text-[var(--hack-red)]"}`}>
                      {t.amount >= 0 ? "+" : ""}{t.amount}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--hack-gray)]">{t.balanceAfter.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Credit packs ────────────────────────────────────────────────── */}
      <div id="credit-packs" className="mb-6 scroll-mt-20">
        <SectionHeader title="Purchase Credit Packs" icon={Sparkles} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative border ${
                pack.popular
                  ? "border-[var(--hack-cyan)]/50 bg-[var(--hack-cyan)]/[0.04]"
                  : "border-[var(--hack-border)] bg-black/20"
              } p-4 flex flex-col`}
            >
              {pack.popular && (
                <span className="absolute -top-2 left-3 inline-flex items-center gap-1 border border-[var(--hack-cyan)]/50 bg-[var(--hack-bg)] px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider text-[var(--hack-cyan)]">
                  <Sparkles className="h-2.5 w-2.5" /> Best Value
                </span>
              )}
              <div className="text-2xl font-bold font-mono text-[var(--hack-green)]">
                {pack.credits.toLocaleString()}
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)] mt-0.5">credits</div>
              <div className="mt-3 text-lg font-mono text-[var(--hack-cyan)]">
                ${(pack.priceCents / 100).toFixed(2)}
              </div>
              <div className="text-[10px] font-mono text-[var(--hack-gray)]/60 mb-3">
                ${(pack.priceCents / pack.credits).toFixed(3)}/credit
              </div>
              <button
                onClick={() => buyPack(pack.id)}
                disabled={buyingPack !== null}
                className="mt-auto border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-[var(--hack-green)] transition hover:bg-[var(--hack-green)]/15 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
              >
                {buyingPack === pack.id ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Redirecting…</>
                ) : (
                  <>Buy</>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Credit costs ────────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="How Credits Are Used" icon={Info} />
        <p className="text-xs text-[var(--hack-gray)] font-mono mb-3">
          Each AI-powered operation debits a fixed number of credits from your balance. Monthly grant is consumed first; purchased packs are tapped only after the grant runs out.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(AI_CREDIT_COSTS).map(([op, cost]) => (
            <div key={op} className="flex items-center justify-between border border-[var(--hack-border)] bg-black/20 px-3 py-2">
              <span className="font-mono text-[11px] text-[var(--hack-gray)] uppercase tracking-wider">
                {op.replace(/_/g, " ")}
              </span>
              <span className="font-mono text-xs font-bold text-[var(--hack-cyan)]">{cost}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-[var(--hack-gray)]/60 font-mono">
          {"// Need higher limits? "}<button onClick={() => navigate({ name: "pricing" })} className="text-[var(--hack-green)] hover:underline">View plans →</button>
        </p>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BILLING API KEYS VIEW
// ─────────────────────────────────────────────────────────────────────────────

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export function BillingApiKeysView() {
  const navigate = useNavigate();
  const { planLimits, loading: subLoading } = useSubscription();

  if (!subLoading && planLimits && !planLimits.apiAccess) {
    return (
      <Shell max="max-w-3xl">
        <PageHeader icon={KeyRound} title="API Keys" subtitle="// programmatic access" accent="amber" />
        <div className="border border-dashed border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/[0.04] p-8 text-center">
          <div className="flex h-12 w-12 mx-auto mb-3 items-center justify-center border border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10">
            <Lock className="h-6 w-6 text-[var(--hack-amber)]" />
          </div>
          <h3 className="font-mono text-sm font-semibold text-[var(--hack-amber)] uppercase tracking-wider mb-1">
            API Access requires Professional
          </h3>
          <p className="text-xs text-[var(--hack-gray)] font-mono mb-4 max-w-md mx-auto">
            Generate API keys to run investigations, queries, and exports programmatically. Available on the Professional plan and above.
          </p>
          <button
            onClick={() => navigate({ name: "pricing" })}
            className="inline-flex items-center gap-1.5 border border-[var(--hack-green)]/50 bg-[var(--hack-green)]/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 transition"
          >
            <ArrowUpRight className="h-3.5 w-3.5" /> View Plans
          </button>
        </div>
      </Shell>
    );
  }

  return <ApiKeysInner />;
}

function ApiKeysInner() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState("read");
  const [expiry, setExpiry] = useState("30");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/api-keys", { cache: "no-store" });
      if (r.status === 401) {
        setError("Sign in to manage API keys");
        return;
      }
      if (r.status === 402) {
        // Plan doesn't include API access — show upgrade prompt, not "coming soon"
        const d = await r.json();
        setError(d.error || "API access requires a higher plan");
        return;
      }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load");
      setKeys(d.keys || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    setNewKey(null);
    try {
      const r = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          scopes: scopes.split(",").map((s) => s.trim()).filter(Boolean),
          expiresInDays: Number(expiry) || 30,
        }),
      });
      const d = await r.json();
      if (r.status === 402) {
        setError(d.error || "API access requires a higher plan");
        return;
      }
      if (!r.ok) throw new Error(d.error || "Failed to create key");
      if (d.key) {
        setNewKey(d.key);
        setCopied(false);
      }
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? Any scripts using it will stop working immediately.")) return;
    setRevokingId(id);
    try {
      const r = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 404) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || "Failed to revoke");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setRevokingId(null);
    }
  }

  function copyNewKey() {
    if (!newKey) return;
    navigator.clipboard?.writeText(newKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Shell max="max-w-4xl">
      <PageHeader icon={KeyRound} title="API Keys" subtitle="// programmatic access · professional+" accent="green" />

      {error && (
        <div className="mb-4 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-3 text-xs font-mono text-[var(--hack-red)] flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── New key reveal ─────────────────────────────────────────────── */}
      {newKey && (
        <div className="mb-4 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="h-4 w-4 text-[var(--hack-green)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-green)]">Key Created — copy now</span>
          </div>
          <p className="text-[11px] text-[var(--hack-gray)] font-mono mb-2">
            {"// This is the only time the full key will be shown. Store it securely."}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-black/50 border border-[var(--hack-border)] px-3 py-2 text-xs font-mono text-[var(--hack-green)] break-all">
              {newKey}
            </code>
            <button
              onClick={copyNewKey}
              className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 transition inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setNewKey(null)}
              className="border border-[var(--hack-border)] px-3 py-2 text-[11px] font-mono uppercase tracking-wider text-[var(--hack-gray)] hover:text-[var(--hack-green)] transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Create form ────────────────────────────────────────────────── */}
      <form onSubmit={createKey} className="border border-[var(--hack-border)] bg-black/20 p-4 mb-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-[var(--hack-green)] mb-3 flex items-center gap-2">
          <Plus className="h-3.5 w-3.5" /> Create New API Key
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)] mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="production-bot"
              required
              className="w-full bg-[var(--hack-surface)] border border-[var(--hack-border)] px-2 py-1.5 text-xs font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)] mb-1">Scopes (csv)</label>
            <input
              type="text"
              value={scopes}
              onChange={(e) => setScopes(e.target.value)}
              placeholder="read,investigate"
              className="w-full bg-[var(--hack-surface)] border border-[var(--hack-border)] px-2 py-1.5 text-xs font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/50"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--hack-gray)] mb-1">Expires (days)</label>
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full bg-[var(--hack-surface)] border border-[var(--hack-border)] px-2 py-1.5 text-xs font-mono text-[var(--hack-green)] focus:outline-none focus:border-[var(--hack-green)]/50"
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="0">never</option>
            </select>
          </div>
        </div>
        <div className="mt-3">
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="inline-flex items-center gap-1.5 border border-[var(--hack-green)]/50 bg-[var(--hack-green)]/10 px-4 py-1.5 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Generate Key
          </button>
        </div>
      </form>

      {/* ── Existing keys ──────────────────────────────────────────────── */}
      <SectionHeader title="Your API Keys" icon={KeyRound} count={keys.length} />
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-12 border border-[var(--hack-border)] bg-black/20 animate-pulse" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys yet"
          description="Generate your first key above. Keys are shown in full only once at creation — store them securely."
        />
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="border border-[var(--hack-border)] bg-black/20 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-[var(--hack-green)]">{k.name}</span>
                  <code className="font-mono text-[10px] text-[var(--hack-cyan)] bg-black/40 px-1.5 py-0.5">{k.prefix}…</code>
                  {k.scopes.map((s) => (
                    <PTag key={s} color="cyan">{s}</PTag>
                  ))}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] font-mono text-[var(--hack-gray)]/60">
                  <span>created {new Date(k.createdAt).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>last used {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "never"}</span>
                  {k.expiresAt && (
                    <>
                      <span>·</span>
                      <span className={new Date(k.expiresAt) < new Date() ? "text-[var(--hack-red)]" : ""}>
                        expires {new Date(k.expiresAt).toLocaleDateString()}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => revokeKey(k.id)}
                disabled={revokingId === k.id}
                className="shrink-0 inline-flex items-center gap-1 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--hack-red)] hover:bg-[var(--hack-red)]/15 transition disabled:opacity-50"
              >
                {revokingId === k.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

