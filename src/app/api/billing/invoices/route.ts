// GET /api/billing/invoices — list the user's cached Stripe invoices for the
// billing dashboard. Returns the 24 most recent, newest first.
//
// Auth: required.
// Success: 200 { invoices: Invoice[] }
// Failure: 401 { error } | 500 { error }
//
// Invoices are cached on the `invoice.paid` webhook. If a user is missing
// historical invoices (e.g. they existed before the webhook was wired up),
// they can be backfilled via a one-off admin script.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to view invoices" },
      { status: 401 }
    );
  }

  try {
    // Find the user's most recent subscription to scope invoices.
    const subscription = await db.subscription.findFirst({
      where: { userId: user.id },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    if (!subscription) {
      return NextResponse.json({ invoices: [] }, { status: 200 });
    }

    const invoices = await db.invoice.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        number: true,
        status: true,
        amountPaid: true,
        currency: true,
        periodStart: true,
        periodEnd: true,
        invoicePdfUrl: true,
        hostedInvoiceUrl: true,
        paidAt: true,
      },
    });

    return NextResponse.json({ invoices }, { status: 200 });
  } catch (e) {
    return safeErrorResponse(e, "Failed to load invoices", 500);
  }
}
