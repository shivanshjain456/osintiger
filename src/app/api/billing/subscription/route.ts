// GET /api/billing/subscription — the billing dashboard's primary data fetch.
//
// Returns the signed-in user's current subscription, billing-period usage
// for the two metered metrics (investigations + AI credits), and their
// purchased/granted AI credit balance.
//
// Auth: required.
// Success: 200 {
//   subscription: { tier, status, billingCycle, currentPeriodEnd, cancelAtPeriodEnd } | null,
//   usage: { investigations: { count, limit }, aiCredits: { count, limit } } | null,
//   creditBalance: number
// }
// Failure: 401 { error } | 500 { error }

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import {
  resolveEntitlement,
  getUsage,
  getCreditBalance,
} from "@/lib/saas/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to view billing" },
      { status: 401 }
    );
  }

  try {
    const ent = await resolveEntitlement(user.id);
    const sub = ent.subscription;

    let usage: {
      investigations: { count: number; limit: number };
      aiCredits: { count: number; limit: number };
    } | null = null;

    if (sub && sub.id) {
      const [investigations, aiCredits] = await Promise.all([
        getUsage(sub.id, "investigations"),
        getUsage(sub.id, "ai_credits"),
      ]);
      usage = { investigations, aiCredits };
    }

    const creditBalance = await getCreditBalance(user.id);

    return NextResponse.json(
      {
        subscription: sub
          ? {
              tier: sub.tier,
              status: sub.status,
              billingCycle: sub.billingCycle,
              currentPeriodEnd: sub.currentPeriodEnd,
              cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            }
          : null,
        usage,
        creditBalance,
      },
      { status: 200 }
    );
  } catch (e) {
    return safeErrorResponse(e, "Failed to load subscription", 500);
  }
}
