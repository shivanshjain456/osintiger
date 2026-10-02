// POST /api/stripe/checkout — create a Stripe Checkout Session for a
// subscription plan.
//
// Body: { tier: PlanTier, cycle: "monthly" | "annual" }
// Success: 200 { url: string }   — redirect the browser to this URL
// Failure: 400 | 401 | 500 { error: string }
//
// Auth: required (the user must be signed in so we can attach the Stripe
// Customer to their account). The free tier cannot be checked out (its price
// is $0); clients should hide the checkout button for `free` and `enterprise`.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { createCheckoutSession } from "@/lib/saas/stripe";
import type { PlanTier } from "@/lib/saas/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TIERS: PlanTier[] = [
  "free",
  "investigator",
  "professional",
  "team",
  "enterprise",
];

export async function POST(req: Request) {
  // ─── Auth ──────────────────────────────────────────────────────────────
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to subscribe" },
      { status: 401 }
    );
  }

  // ─── Parse + validate body ─────────────────────────────────────────────
  let body: { tier?: unknown; cycle?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tier = typeof body.tier === "string" ? (body.tier as PlanTier) : null;
  const cycle = typeof body.cycle === "string" ? body.cycle : null;

  if (!tier || !VALID_TIERS.includes(tier)) {
    return NextResponse.json(
      { error: "Invalid or missing 'tier'. Must be one of: free, investigator, professional, team, enterprise." },
      { status: 400 }
    );
  }
  if (cycle !== "monthly" && cycle !== "annual") {
    return NextResponse.json(
      { error: "Invalid or missing 'cycle'. Must be 'monthly' or 'annual'." },
      { status: 400 }
    );
  }

  // Free / enterprise aren't checkable — free is $0, enterprise is custom.
  if (tier === "free") {
    return NextResponse.json(
      { error: "The Free plan does not require checkout." },
      { status: 400 }
    );
  }
  if (tier === "enterprise") {
    return NextResponse.json(
      { error: "Enterprise plans require a custom contract. Contact sales." },
      { status: 400 }
    );
  }

  // ─── Create the checkout session ───────────────────────────────────────
  try {
    const { url } = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      tier,
      cycle,
    });
    return NextResponse.json({ url }, { status: 200 });
  } catch (e) {
    return safeErrorResponse(e, "Failed to create checkout session", 500);
  }
}
