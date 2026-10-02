// Stripe billing integration — server-side helpers.
//
// This module is the single seam between Stripe and the OSINTiger data model:
//   - Customer linkage (User.stripeCustomerId)
//   - Subscription checkout (monthly/annual, inline price creation if missing)
//   - Customer portal (self-serve subscription management)
//   - One-time credit-pack purchases
//   - Webhook event handling (subscription sync, invoice caching, credit grants)
//
// Design notes:
//   - All Stripe calls are made through the shared `stripe` instance below.
//   - The STRIPE_SECRET_KEY env var is a placeholder in dev; in production it
//     must be set to a real `sk_live_...` or `sk_test_...` key. If the key is
//     missing or invalid, Stripe will reject the API call and the caller's
//     try/catch surfaces a safe 500 to the client.
//   - Webhook handlers wrap every branch in try/catch so a single bad event
//     never returns a non-200 to Stripe (which would trigger retries).
//   - We cache Stripe subscription & invoice state locally so the billing UI
//     never has to call Stripe on the hot path.

import Stripe from "stripe";
import { db } from "@/lib/db";
import {
  CREDIT_PACKS,
  PLAN_DEFINITIONS,
  type PlanTier,
} from "@/lib/saas/plans";
import {
  ensurePlanExists,
  grantAICredits,
  recordSaasAudit,
} from "@/lib/saas/entitlements";

// ─── Stripe client ───────────────────────────────────────────────────────────
//
// The apiVersion is pinned to a known-good version so the server-side types
// match what we coded against. The double cast through `unknown` is required
// because Stripe's LatestApiVersion type is a single literal (the SDK's
// bundled default) and we're explicitly opting into an older pinned version.

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2024-12-18.acacia" as unknown as Stripe.LatestApiVersion,
});

// Public base URL for building success/cancel redirect URLs. Falls back to
// localhost for dev — Stripe requires an absolute URL.
const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";

// ─── Customer linkage ────────────────────────────────────────────────────────

/**
 * Get the user's Stripe customer ID, creating a new Stripe Customer if the
 * user doesn't have one yet. Persists the new customer id on the User row.
 *
 * If the user has a stripeCustomerId but the customer no longer exists in
 * Stripe (deleted via dashboard), we create a fresh one and update the row.
 */
export async function getOrCreateStripeCustomer(user: {
  id: string;
  email: string;
  name: string;
}): Promise<string> {
  // Check the DB first — avoids a Stripe round-trip on the hot path.
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });

  if (dbUser?.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(dbUser.stripeCustomerId);
      // Deleted customers come back as { deleted: true } — treat as missing.
      if (!("deleted" in existing)) {
        return dbUser.stripeCustomerId;
      }
    } catch {
      // Customer was deleted from Stripe or the id is stale — fall through
      // and create a new one.
    }
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { userId: user.id },
  });

  await db.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ─── Subscription checkout ───────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for a subscription plan.
 *
 * If the plan row doesn't yet have a stripePriceId configured for the chosen
 * cycle, we create an inline Price object under a per-plan Product and cache
 * the new price id on the SubscriptionPlan row so subsequent checkouts reuse
 * it (avoids creating duplicate prices on every checkout).
 */
export async function createCheckoutSession(params: {
  userId: string;
  email: string;
  name: string;
  tier: PlanTier;
  cycle: "monthly" | "annual";
}): Promise<{ url: string }> {
  const { userId, email, name, tier, cycle } = params;

  const customerId = await getOrCreateStripeCustomer({ id: userId, email, name });

  const plan = await db.subscriptionPlan.findUnique({ where: { tier } });
  if (!plan) {
    throw new Error(`Subscription plan tier '${tier}' not found`);
  }

  // Resolve the Stripe Price id for the chosen cycle. If missing, create one
  // inline and cache it on the plan row.
  let priceId = cycle === "annual" ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;

  if (!priceId) {
    const unitAmount = cycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
    if (!unitAmount || unitAmount <= 0) {
      throw new Error(
        `Cannot create checkout for plan '${tier}' with $0 price — configure a Stripe price manually or set a non-zero price.`
      );
    }
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: unitAmount,
      recurring: { interval: cycle === "annual" ? "year" : "month" },
      product_data: { name: `${plan.name} - ${cycle}` },
    });
    priceId = price.id;
    await db.subscriptionPlan.update({
      where: { id: plan.id },
      data:
        cycle === "annual"
          ? { stripePriceIdAnnual: priceId }
          : { stripePriceIdMonthly: priceId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/#/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/#/billing?status=canceled`,
    metadata: { userId, tier, cycle },
    subscription_data: { metadata: { userId, tier, cycle } },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return { url: session.url };
}

// ─── Customer portal ─────────────────────────────────────────────────────────

/**
 * Create a Stripe Billing Portal session for the given customer id. The
 * portal lets users self-serve: update payment method, swap plans, cancel,
 * view invoices.
 */
export async function createPortalSession(customerId: string): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${baseUrl}/#/billing`,
  });
  return { url: session.url };
}

// ─── Credit pack (one-time) checkout ─────────────────────────────────────────

/**
 * Create a Stripe Checkout Session for a one-time credit pack purchase.
 * Uses `mode: "payment"` with an inline price_data (we don't persist credit
 * packs as Stripe Price objects — they're too small / too frequently tweaked).
 */
export async function createCreditPackCheckout(params: {
  userId: string;
  email: string;
  name: string;
  packId: string;
}): Promise<{ url: string }> {
  const { userId, email, name, packId } = params;

  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    throw new Error(`Credit pack '${packId}' not found`);
  }

  const customerId = await getOrCreateStripeCustomer({ id: userId, email, name });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: { name: pack.name },
        },
      },
    ],
    success_url: `${baseUrl}/#/billing?status=success&pack=${packId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/#/billing?status=canceled`,
    metadata: {
      userId,
      packId,
      credits: String(pack.credits),
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return { url: session.url };
}

// ─── Subscription sync ───────────────────────────────────────────────────────

/**
 * Pull the latest state of a Stripe Subscription and sync it into our local
 * Subscription row. Creates the row if it doesn't exist yet (e.g. checkout
 * completed via Stripe dashboard rather than our flow).
 *
 * On a fresh activation (status flips to `active`), grant the plan's monthly
 * AI credit allotment so the user can start using paid features immediately.
 */
export async function syncSubscriptionFromStripe(stripeSubscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ["items.data.price", "latest_invoice"],
  });

  const stripeCustomerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const item = sub.items.data[0];
  const stripeItemId = item?.id || "";
  const priceId = item?.price?.id || "";

  // Stripe 2024-12-18.acacia moved current_period_{start,end} off the
  // Subscription object onto the SubscriptionItem. Fall back to null if the
  // subscription has no items yet (transitional state).
  const currentPeriodStart = item?.current_period_start
    ? new Date(item.current_period_start * 1000)
    : null;
  const currentPeriodEnd = item?.current_period_end
    ? new Date(item.current_period_end * 1000)
    : null;

  // Try to find the existing local subscription row.
  let local = await db.subscription.findFirst({
    where: { stripeSubscriptionId: sub.id },
    include: { plan: true },
  });

  let isNewActivation = false;

  if (!local) {
    // No local row — find the owner by stripeCustomerId.
    const user = await db.user.findFirst({ where: { stripeCustomerId } });
    if (!user) {
      throw new Error(
        `syncSubscriptionFromStripe: no user found for stripeCustomerId=${stripeCustomerId}`
      );
    }

    // Resolve the plan by matching the priceId. We deliberately type `plan`
    // as `{ id: string } | null` so it can hold either a full plan row from
    // findFirst or the trimmed object returned by ensurePlanExists.
    let plan: { id: string } | null = await db.subscriptionPlan.findFirst({
      where: {
        OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdAnnual: priceId }],
      },
      select: { id: true },
    });
    if (!plan) {
      // Fallback: can't infer the tier from the price — seed a free plan row
      // (the lowest-common-denominator) and let ops correct later via the
      // admin dashboard. This keeps the webhook from throwing.
      plan = await ensurePlanExists("free");
    }

    // Infer billing cycle from the price's recurring interval.
    const interval = item?.price?.recurring?.interval;
    const billingCycle = interval === "year" ? "annual" : "monthly";

    local = await db.subscription.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        planId: plan.id,
        status: sub.status,
        billingCycle,
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        stripeItemId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        startedAt: new Date(sub.start_date * 1000),
      },
      include: { plan: true },
    });

    isNewActivation = sub.status === "active";
  } else {
    const previousStatus = local.status;
    local = await db.subscription.update({
      where: { id: local.id },
      data: {
        status: sub.status,
        stripeCustomerId,
        stripeItemId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
      include: { plan: true },
    });
    isNewActivation = previousStatus !== "active" && sub.status === "active";
  }

  // On a fresh activation, grant the plan's monthly AI credit allotment.
  if (isNewActivation && local.userId) {
    const tier = local.plan.tier as PlanTier;
    const planDef = PLAN_DEFINITIONS.find((p) => p.tier === tier);
    const credits = planDef?.limits.aiCreditsPerMonth ?? 0;
    if (credits > 0) {
      await grantAICredits(
        local.userId,
        credits,
        "monthly_grant",
        local.id,
        `Monthly AI credit grant (${tier} plan activation)`
      );
    }
  }

  return local;
}

// ─── Webhook event handler ───────────────────────────────────────────────────
//
// Each branch is wrapped in its own try/catch so a single bad event never
// throws out of the webhook handler (which would make Stripe retry). Errors
// are logged with context.

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // ─── Checkout completed — route by metadata ────────────────────────────
    case "checkout.session.completed": {
      try {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata || {};
        const userId = metadata.userId || "";
        const tier = metadata.tier || "";
        const cycle = metadata.cycle || "";
        const packId = metadata.packId || "";
        const credits = metadata.credits ? Number(metadata.credits) : 0;

        if (packId) {
          // Credit pack purchase — grant credits + create AddOnPurchase row.
          // IDEMPOTENCY: check if we've already fulfilled this checkout session
          // to prevent double-granting on Stripe webhook retries.
          const paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || "";
          const existing = await db.addOnPurchase.findFirst({
            where: { stripePaymentIntentId: paymentIntentId },
            select: { id: true },
          });
          if (existing) {
            // Already fulfilled — skip (idempotent retry).
            break;
          }
          if (userId && credits > 0) {
            await grantAICredits(
              userId,
              credits,
              "purchase",
              null,
              `Credit pack purchase (${packId})`
            );
          }
          await db.addOnPurchase.create({
            data: {
              id: crypto.randomUUID(),
              userId: userId || null,
              type: "ai_credit_pack",
              stripePaymentIntentId: paymentIntentId,
              amountPaidCents: session.amount_total || 0,
              currency: session.currency || "usd",
              creditsGranted: credits,
              description: `Credit pack ${packId} (${credits} credits)`,
              fulfilledAt: new Date(),
            },
          });
        } else if (session.subscription) {
          // Subscription checkout — sync the new subscription.
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          await syncSubscriptionFromStripe(subId);
          // Notify the user that their subscription is active.
          if (userId) {
            const { createNotification } = await import("@/lib/saas/notifications");
            await createNotification({
              userId,
              type: "billing.subscription_activated",
              title: "Subscription activated",
              body: `Your ${tier} plan subscription is now active.`,
              severity: "success",
              category: "billing",
              resourceType: "subscription",
              routeName: "billing",
            });
          }
        }

        // Notify the user about credit pack purchases.
        if (packId && userId && credits > 0) {
          const { createNotification } = await import("@/lib/saas/notifications");
          await createNotification({
            userId,
            type: "billing.credits_purchased",
            title: `${credits} AI credits purchased`,
            body: `Your credit pack (${credits} credits) has been added to your account.`,
            severity: "success",
            category: "billing",
            resourceType: "credits",
            routeName: "billing-credits",
          });
        }

        if (userId) {
          await recordSaasAudit(
            userId,
            "billing.checkout_completed",
            packId
              ? `Credit pack ${packId} (${credits} credits)`
              : `Subscription ${tier}/${cycle}`,
            { sessionId: session.id }
          );
        }
      } catch (e) {
        console.error("[stripe-webhook] checkout.session.completed error:", e);
      }
      break;
    }

    // ─── Subscription created / updated — resync ───────────────────────────
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      try {
        const sub = event.data.object as Stripe.Subscription;
        const synced = await syncSubscriptionFromStripe(sub.id);
        // Invalidate the entitlement cache so the user's next API request
        // picks up the new plan limits immediately.
        if (synced?.userId) {
          const { invalidateEntitlementCache } = await import("@/lib/saas/entitlements");
          invalidateEntitlementCache(synced.userId);
        }
      } catch (e) {
        console.error(`[stripe-webhook] ${event.type} error:`, e);
      }
      break;
    }

    // ─── Subscription deleted — mark canceled locally ──────────────────────
    case "customer.subscription.deleted": {
      try {
        const sub = event.data.object as Stripe.Subscription;
        await db.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status: "canceled",
            canceledAt: new Date(),
            cancelAtPeriodEnd: false,
          },
        });
      } catch (e) {
        console.error("[stripe-webhook] customer.subscription.deleted error:", e);
      }
      break;
    }

    // ─── Invoice paid — cache it for the billing dashboard ────────────────
    case "invoice.paid": {
      try {
        const inv = event.data.object as Stripe.Invoice;
        // Stripe 2024-12-18.acacia: the Invoice.subscription field was
        // removed; the subscription is now nested under parent.subscription_details.
        const subRef = inv.parent?.subscription_details?.subscription;
        const stripeSubscriptionId =
          typeof subRef === "string" ? subRef : subRef?.id || "";

        const local = await db.subscription.findFirst({
          where: { stripeSubscriptionId },
        });
        if (!local) {
          // No local subscription yet — skip; will be backfilled on the
          // subscription.created/updated webhook that follows.
          break;
        }

        const periodStart = inv.period_start ? new Date(inv.period_start * 1000) : null;
        const periodEnd = inv.period_end ? new Date(inv.period_end * 1000) : null;

        await db.invoice.upsert({
          where: { stripeInvoiceId: inv.id },
          create: {
            id: crypto.randomUUID(),
            subscriptionId: local.id,
            stripeInvoiceId: inv.id,
            number: inv.number || "",
            status: "paid",
            amountDue: inv.amount_due,
            amountPaid: inv.amount_paid,
            currency: inv.currency || "usd",
            periodStart,
            periodEnd,
            invoicePdfUrl: inv.invoice_pdf || "",
            hostedInvoiceUrl: inv.hosted_invoice_url || "",
            paidAt: new Date(),
          },
          update: {
            number: inv.number || "",
            status: "paid",
            amountDue: inv.amount_due,
            amountPaid: inv.amount_paid,
            currency: inv.currency || "usd",
            periodStart,
            periodEnd,
            invoicePdfUrl: inv.invoice_pdf || "",
            hostedInvoiceUrl: inv.hosted_invoice_url || "",
            paidAt: new Date(),
          },
        });
      } catch (e) {
        console.error("[stripe-webhook] invoice.paid error:", e);
      }
      break;
    }

    // ─── Invoice payment failed — mark open + subscription past_due ───────
    case "invoice.payment_failed": {
      try {
        const inv = event.data.object as Stripe.Invoice;
        // Stripe 2024-12-18.acacia: the Invoice.subscription field was
        // removed; the subscription is now nested under parent.subscription_details.
        const subRef = inv.parent?.subscription_details?.subscription;
        const stripeSubscriptionId =
          typeof subRef === "string" ? subRef : subRef?.id || "";

        await db.invoice.updateMany({
          where: { stripeInvoiceId: inv.id },
          data: { status: "open" },
        });

        if (stripeSubscriptionId) {
          await db.subscription.updateMany({
            where: { stripeSubscriptionId },
            data: { status: "past_due" },
          });
        }
      } catch (e) {
        console.error("[stripe-webhook] invoice.payment_failed error:", e);
      }
      break;
    }

    default:
      // Unhandled event type — silently ignore. Stripe sends many event
      // types we don't care about (e.g. customer.source.created); returning
      // 200 for them is correct.
      break;
  }
}
