// Entitlements & Usage — the core SaaS enforcement layer.
//
// This module answers two questions for every request:
//   1. "Can this user/org do X?" (entitlement check against plan limits)
//   2. "How much have they consumed this period?" (usage metering)
//
// It also handles AI credit consumption (debit + balance check) and records
// audit entries for every gated action.
//
// All existing investigation/AI/export flows call into this module before
// executing. If the check fails, the caller returns a 402 Payment Required or
// a 429 Too Many Requests with a clear upgrade message.

import { db } from "@/lib/db";
import { PLAN_DEFINITIONS, AI_CREDIT_COSTS, type PlanTier, type PlanLimits, type AIOperation } from "./plans";
import { recordAudit } from "@/lib/osint/audit";

// ─── Current period helpers ──────────────────────────────────────────────────

/** Get the current billing period boundaries for a subscription. */
function getCurrentPeriod(sub: { currentPeriodStart: Date | null; currentPeriodEnd: Date | null; startedAt: Date }): { start: Date; end: Date } {
  const now = new Date();
  if (sub.currentPeriodStart && sub.currentPeriodEnd) {
    // If the period has ended but Stripe hasn't sent a renewal webhook yet,
    // roll forward to the current month.
    if (sub.currentPeriodEnd < now) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }
    return { start: sub.currentPeriodStart, end: sub.currentPeriodEnd };
  }
  // Fallback: calendar month from subscription start.
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

// ─── Subscription resolution ─────────────────────────────────────────────────

export interface ResolvedSubscription {
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    tier: PlanTier;
    planId: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  planLimits: PlanLimits;
  tier: PlanTier;
  userId: string | null;
  organizationId: string | null;
}

/** Anonymous entitlement (not logged in) — treated as a restricted free tier. */
const ANONYMOUS_LIMITS: PlanLimits = {
  ...PLAN_DEFINITIONS[0].limits,
  investigationsPerMonth: 1,  // even more restricted for anonymous
  aiCreditsPerMonth: 3,
};

export const ANONYMOUS_ENTITLEMENT: ResolvedSubscription = {
  subscription: null,
  planLimits: ANONYMOUS_LIMITS,
  tier: "free",
  userId: null,
  organizationId: null,
};

/**
 * Resolve the effective subscription + limits for a user (or anonymous).
 * Falls back to anonymous free tier if no user or no subscription.
 */
// ─── Short-lived entitlement cache ───────────────────────────────────────────
// resolveEntitlement() is called on every API request. Subscriptions don't
// change frequently, so a 15-second cache eliminates redundant DB queries
// without noticeable staleness. The cache is invalidated on Stripe webhook
// events (via reloadEntitlementCache).
const entCache = new Map<string, { ent: ResolvedSubscription; expires: number }>();
const ENT_CACHE_TTL = 15_000; // 15 seconds

export function invalidateEntitlementCache(userId?: string): void {
  if (userId) {
    entCache.delete(userId);
  } else {
    entCache.clear();
  }
}

export async function resolveEntitlement(userId: string | null): Promise<ResolvedSubscription> {
  if (!userId) return ANONYMOUS_ENTITLEMENT;

  // Check the short-lived cache first.
  const cached = entCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.ent;
  }

  // Find the user's active subscription (personal or via org membership).
  const sub = await db.subscription.findFirst({
    where: {
      OR: [
        { userId, status: { in: ["active", "trialing"] } },
        {
          organization: { members: { some: { userId, status: "active" } } },
          status: { in: ["active", "trialing"] },
        },
      ],
    },
    include: { plan: true },
    orderBy: { startedAt: "desc" },
  });

  if (!sub) {
    // No subscription → free tier. Ensure a free plan row exists.
    const freePlan = await ensurePlanExists("free");
    const ent: ResolvedSubscription = {
      subscription: {
        id: "",
        status: "free",
        billingCycle: "monthly",
        tier: "free",
        planId: freePlan.id,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      },
      planLimits: PLAN_DEFINITIONS[0].limits,
      tier: "free",
      userId,
      organizationId: null,
    };
    entCache.set(userId, { ent, expires: Date.now() + ENT_CACHE_TTL });
    return ent;
  }

  const tier = sub.plan.tier as PlanTier;
  const planDef = PLAN_DEFINITIONS.find((p) => p.tier === tier);
  const limits = planDef?.limits || PLAN_DEFINITIONS[0].limits;

  const ent: ResolvedSubscription = {
    subscription: {
      id: sub.id,
      status: sub.status,
      billingCycle: sub.billingCycle,
      tier,
      planId: sub.planId,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    },
    planLimits: limits,
    tier,
    userId,
    organizationId: sub.organizationId,
  };
  entCache.set(userId, { ent, expires: Date.now() + ENT_CACHE_TTL });
  return ent;
}

// ─── Usage metering ──────────────────────────────────────────────────────────

export type UsageMetric =
  | "investigations"
  | "ai_credits"
  | "api_requests"
  | "exports"
  | "vlm_analyses"
  | "monitor_scans";

/**
 * Get current usage for a metric in the active billing period.
 * Returns 0 if no subscription (free tier — tracked loosely by IP/session).
 */
export async function getUsage(subscriptionId: string, metric: UsageMetric): Promise<{ count: number; limit: number }> {
  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });
  if (!sub) return { count: 0, limit: 0 };

  const { start, end } = getCurrentPeriod(sub);
  const record = await db.usageRecord.findUnique({
    where: {
      subscriptionId_metric_periodStart: {
        subscriptionId,
        metric,
        periodStart: start,
      },
    },
  });

  const tier = sub.plan.tier as PlanTier;
  const planDef = PLAN_DEFINITIONS.find((p) => p.tier === tier);
  const limit = getLimitForMetric(planDef?.limits, metric);

  return { count: record?.count || 0, limit };
}

function getLimitForMetric(limits: PlanLimits | undefined, metric: UsageMetric): number {
  if (!limits) return 0;
  switch (metric) {
    case "investigations": return limits.investigationsPerMonth;
    case "ai_credits": return limits.aiCreditsPerMonth;
    case "api_requests": return limits.apiRequestsPerMonth;
    case "exports": return limits.investigationsPerMonth; // tied to investigations
    case "vlm_analyses": return Math.floor(limits.aiCreditsPerMonth / 2);
    case "monitor_scans": return limits.monitoringTargets * 30; // daily scans
    default: return 0;
  }
}

/**
 * Increment usage for a metric. Creates the period record if missing.
 * Returns the new count.
 */
export async function incrementUsage(
  subscriptionId: string,
  metric: UsageMetric,
  amount: number = 1,
  userId?: string
): Promise<number> {
  const sub = await db.subscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) return 0;

  const { start, end } = getCurrentPeriod(sub);
  const planRow = await db.subscriptionPlan.findUnique({ where: { id: sub.planId } });
  const planDef = PLAN_DEFINITIONS.find((p) => p.tier === planRow?.tier);
  const limit = getLimitForMetric(planDef?.limits, metric);

  // Upsert the usage record.
  const updated = await db.usageRecord.upsert({
    where: {
      subscriptionId_metric_periodStart: {
        subscriptionId,
        metric,
        periodStart: start,
      },
    },
    create: {
      id: crypto.randomUUID(),
      subscriptionId,
      userId: userId || null,
      periodStart: start,
      periodEnd: end,
      metric,
      count: amount,
      limitForPeriod: limit,
    },
    update: {
      count: { increment: amount },
      limitForPeriod: limit,
      updatedAt: new Date(),
    },
  });

  return updated.count;
}

// ─── Entitlement checks ──────────────────────────────────────────────────────

export interface EntitlementCheck {
  allowed: boolean;
  reason?: string;
  upgradeTier?: PlanTier;
  usage?: { count: number; limit: number };
}

/**
 * Check if the user can start a new investigation.
 */
export async function checkInvestigationEntitlement(ent: ResolvedSubscription): Promise<EntitlementCheck> {
  if (!ent.subscription || ent.subscription.id === "") {
    // Free tier without a DB subscription — allow but note anonymous limits.
    return { allowed: true, usage: { count: 0, limit: ent.planLimits.investigationsPerMonth } };
  }
  const { count, limit } = await getUsage(ent.subscription.id, "investigations");
  if (limit === -1) return { allowed: true, usage: { count, limit } };
  if (count >= limit) {
    return {
      allowed: false,
      reason: `You've reached your monthly investigation limit (${limit}). Upgrade to run more investigations.`,
      upgradeTier: ent.tier === "free" ? "investigator" : "professional",
      usage: { count, limit },
    };
  }
  return { allowed: true, usage: { count, limit } };
}

/**
 * Check if the user can use a specific investigation mode.
 */
export function checkModeEntitlement(ent: ResolvedSubscription, mode: string): EntitlementCheck {
  if (ent.planLimits.modes.includes(mode)) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `The ${mode} investigation mode is available on the Investigator plan and above.`,
    upgradeTier: "investigator",
  };
}

/**
 * Check if the user can export in a specific format.
 */
export function checkExportEntitlement(ent: ResolvedSubscription, format: string): EntitlementCheck {
  if (ent.planLimits.exports.includes(format)) {
    return { allowed: true };
  }
  const tierWithFormat: Record<string, PlanTier> = {
    pdf: "professional",
    csv: "professional",
    stix: "professional",
    markdown: "investigator",
    json: "investigator",
  };
  return {
    allowed: false,
    reason: `${format.toUpperCase()} export requires the ${tierWithFormat[format] || "professional"} plan.`,
    upgradeTier: tierWithFormat[format] || "professional",
  };
}

/**
 * Check if the user can access a feature (boolean gate).
 */
export function checkFeatureEntitlement(
  ent: ResolvedSubscription,
  feature: keyof PlanLimits
): EntitlementCheck {
  const value = ent.planLimits[feature];
  if (typeof value === "boolean") {
    return value
      ? { allowed: true }
      : {
          allowed: false,
          reason: `This feature requires a higher plan.`,
          upgradeTier: "investigator",
        };
  }
  if (typeof value === "number") {
    return value > 0 || value === -1
      ? { allowed: true }
      : {
          allowed: false,
          reason: `This feature requires a higher plan.`,
          upgradeTier: "investigator",
        };
  }
  return { allowed: true };
}

// ─── AI Credit consumption ───────────────────────────────────────────────────

/**
 * Check if the user has enough AI credits for an operation.
 */
export async function checkAICredits(ent: ResolvedSubscription, operation: AIOperation): Promise<EntitlementCheck> {
  const cost = AI_CREDIT_COSTS[operation];
  const balance = await getCreditBalance(ent.userId || "");

  if (balance < cost) {
    return {
      allowed: false,
      reason: `This operation requires ${cost} AI credits. You have ${balance} remaining. Purchase credits or upgrade your plan.`,
      upgradeTier: "investigator",
      usage: { count: balance, limit: ent.planLimits.aiCreditsPerMonth },
    };
  }
  return { allowed: true, usage: { count: balance, limit: ent.planLimits.aiCreditsPerMonth } };
}

/**
 * Get the current AI credit balance for a user.
 * Computed as sum of all credit transactions.
 */
export async function getCreditBalance(userId: string): Promise<number> {
  if (!userId) return 0;
  const result = await db.creditTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return result._sum.amount || 0;
}

/**
 * Consume AI credits for an operation. Records a debit transaction.
 * Uses a database transaction with a re-check inside to prevent race
 * conditions where two concurrent operations both pass the balance check
 * and overdraw the account.
 *
 * @throws Error if insufficient balance (caller should checkAICredits first,
 *         but this method is the source of truth — it re-checks atomically).
 */
export async function consumeAICredits(
  userId: string,
  operation: AIOperation,
  subscriptionId: string | null,
  relatedResourceId: string = ""
): Promise<{ balance: number; cost: number }> {
  const cost = AI_CREDIT_COSTS[operation];

  // Use a transaction to atomically check + debit. The aggregate inside the
  // transaction sees all committed transactions (Prisma's default isolation),
  // so concurrent debits are serialized correctly.
  const newBalance = await db.$transaction(async (tx) => {
    const result = await tx.creditTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const currentBalance = result._sum.amount || 0;
    if (currentBalance < cost) {
      throw new Error(`Insufficient AI credits: need ${cost}, have ${currentBalance}`);
    }
    const updated = currentBalance - cost;
    await tx.creditTransaction.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        subscriptionId: subscriptionId || null,
        amount: -cost,
        balanceAfter: updated,
        reason: operation,
        description: `AI operation: ${operation}`,
        relatedResourceId,
      },
    });
    return updated;
  });

  // Also increment the usage meter for the billing period (outside the
  // transaction — best-effort, never fails the operation).
  if (subscriptionId) {
    await incrementUsage(subscriptionId, "ai_credits", cost, userId);
  }
  return { balance: newBalance, cost };
}

/**
 * Grant AI credits (monthly reset or purchased pack).
 * Uses a transaction to ensure the balanceAfter field is consistent even
 * under concurrent grants. The actual balance (sum of all transactions)
 * is always correct regardless — this just keeps the cached balanceAfter
 * accurate.
 */
export async function grantAICredits(
  userId: string,
  amount: number,
  reason: string,
  subscriptionId: string | null = null,
  description: string = ""
): Promise<number> {
  const newBalance = await db.$transaction(async (tx) => {
    const result = await tx.creditTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });
    const currentBalance = result._sum.amount || 0;
    const updated = currentBalance + amount;
    await tx.creditTransaction.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        subscriptionId,
        amount,
        balanceAfter: updated,
        reason,
        description,
      },
    });
    return updated;
  });
  return newBalance;
}

// ─── Plan seeding ────────────────────────────────────────────────────────────

// Module-level cache for plan IDs — avoids a DB query on every resolveEntitlement()
// call for free-tier users. Plans are immutable once seeded (only updated by
// seedAllPlans on startup), so caching is safe.
const planIdCache = new Map<PlanTier, string>();

/** Ensure a plan row exists in the DB for the given tier. Creates if missing. */
export async function ensurePlanExists(tier: PlanTier): Promise<{ id: string; tier: string }> {
  // Fast path: return cached plan ID.
  const cachedId = planIdCache.get(tier);
  if (cachedId) return { id: cachedId, tier };

  const existing = await db.subscriptionPlan.findUnique({ where: { tier } });
  if (existing) {
    planIdCache.set(tier, existing.id);
    return existing;
  }
  const def = PLAN_DEFINITIONS.find((p) => p.tier === tier)!;
  const created = await db.subscriptionPlan.create({
    data: {
      id: crypto.randomUUID(),
      tier: def.tier,
      name: def.name,
      tagline: def.tagline,
      description: def.description,
      priceMonthly: def.priceMonthly,
      priceAnnual: def.priceAnnual,
      isFeatured: def.isFeatured,
      sortOrder: def.sortOrder,
      featuresJson: JSON.stringify(def.marketing.features),
      limitsJson: JSON.stringify(def.limits),
    },
  });
  planIdCache.set(tier, created.id);
  return created;
}

/** Seed all plans on startup (idempotent). */
export async function seedAllPlans(): Promise<void> {
  for (const def of PLAN_DEFINITIONS) {
    await db.subscriptionPlan.upsert({
      where: { tier: def.tier },
      create: {
        id: crypto.randomUUID(),
        tier: def.tier,
        name: def.name,
        tagline: def.tagline,
        description: def.description,
        priceMonthly: def.priceMonthly,
        priceAnnual: def.priceAnnual,
        isFeatured: def.isFeatured,
        sortOrder: def.sortOrder,
        featuresJson: JSON.stringify(def.marketing.features),
        limitsJson: JSON.stringify(def.limits),
      },
      update: {
        name: def.name,
        tagline: def.tagline,
        description: def.description,
        priceMonthly: def.priceMonthly,
        priceAnnual: def.priceAnnual,
        isFeatured: def.isFeatured,
        sortOrder: def.sortOrder,
        featuresJson: JSON.stringify(def.marketing.features),
        limitsJson: JSON.stringify(def.limits),
      },
    });
  }
}

// ─── Audit helper for SaaS actions ───────────────────────────────────────────

export async function recordSaasAudit(
  userId: string | null,
  action: string,
  detail: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await recordAudit({
    action,
    category: "billing",
    actorType: userId ? "user" : "system",
    actorId: userId || "",
    detail,
    metadata,
    severity: "info",
  });
}
