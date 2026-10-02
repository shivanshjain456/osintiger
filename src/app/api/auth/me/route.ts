// GET /api/auth/me — return the current session user + entitlement.
//
// Response (authenticated):
//   {
//     user: { id, email, name, role },
//     subscription: {
//       tier: "free" | "investigator" | ...,
//       status: string,
//       planLimits: PlanLimits
//     }
//   }
//
// Response (anonymous):
//   { user: null, subscription: { tier: "free", planLimits: {...} } }
//
// This is the primary endpoint the SPA calls on boot to decide whether to
// render the login form or the dashboard. It's also polled after sign-in to
// pick up entitlement changes (e.g. after a Stripe webhook fires).

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/session";
import { resolveEntitlement } from "@/lib/saas/entitlements";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessionUser = await getSessionUser();

    // Anonymous / unauthenticated — return free-tier entitlement so the SPA
    // can still render anonymous-restricted views consistently.
    if (!sessionUser) {
      const ent = await resolveEntitlement(null);
      return NextResponse.json({
        user: null,
        subscription: {
          tier: ent.tier,
          status: ent.subscription?.status || "free",
          planLimits: ent.planLimits,
        },
      });
    }

    const ent = await resolveEntitlement(sessionUser.id);

    return NextResponse.json({
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        role: sessionUser.role,
      },
      subscription: {
        tier: ent.tier,
        status: ent.subscription?.status || "free",
        planId: ent.subscription?.planId || "",
        billingCycle: ent.subscription?.billingCycle || "monthly",
        currentPeriodEnd: ent.subscription?.currentPeriodEnd || null,
        cancelAtPeriodEnd: ent.subscription?.cancelAtPeriodEnd || false,
        planLimits: ent.planLimits,
      },
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch session", 500);
  }
}
