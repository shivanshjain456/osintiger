// POST /api/stripe/portal — create a Stripe Billing Portal session for the
// signed-in user so they can self-manage their subscription (update card,
// switch plans, cancel, view invoices).
//
// Body: none
// Success: 200 { url: string }   — redirect the browser to this URL
// Failure: 400 | 401 | 500 { error: string }

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { createPortalSession } from "@/lib/saas/stripe";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to manage billing" },
      { status: 401 }
    );
  }

  try {
    // Fetch the freshest stripeCustomerId from the DB (the JWT might be stale
    // if the user just completed checkout and the cookie hasn't rotated).
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });
    const customerId = dbUser?.stripeCustomerId || "";

    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 }
      );
    }

    const { url } = await createPortalSession(customerId);
    return NextResponse.json({ url }, { status: 200 });
  } catch (e) {
    return safeErrorResponse(e, "Failed to open billing portal", 500);
  }
}
