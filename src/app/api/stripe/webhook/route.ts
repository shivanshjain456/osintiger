// POST /api/stripe/webhook — receive Stripe webhook events.
//
// CRITICAL: this route MUST read the raw request body (`req.text()`) and pass
// it to `stripe.webhooks.constructEvent` for signature verification. Using
// `req.json()` would re-serialize the body and break the signature.
//
// Returns 200 for all events whose signature verifies, even if our handler
// internally throws — Stripe retries on non-2xx, and we'd rather drop a
// single event than trigger a retry storm for a transient DB error.

import { NextResponse } from "next/server";
import type { Stripe } from "stripe";
import { stripe, handleStripeWebhook } from "@/lib/saas/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Read the raw body as text — this preserves the exact byte sequence
  // Stripe signed.
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch {
    // Signature verification failed — either the secret is wrong or someone
    // is trying to forge a webhook. Reject with 400 (Stripe won't retry
    // signatures — those are transport errors, not app errors).
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeWebhook(event);
  } catch (e) {
    // Defensive: handleStripeWebhook already wraps every branch in try/catch,
    // but if something escapes we must still return 200 so Stripe doesn't
    // retry. Log loudly so ops notices.
    console.error("[stripe-webhook] uncaught handler error:", e);
  }

  return NextResponse.json({ received: true });
}
