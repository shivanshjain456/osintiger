// GET /api/billing/credits — the AI credit ledger for the signed-in user.
//
// Returns the user's current credit balance and the last 50 credit
// transactions (purchases, monthly grants, debits). Used by the billing
// dashboard to render the credit history table.
//
// Auth: required. 401 if not signed in.
// Success: 200 { balance, transactions: CreditTransaction[] }
//
// Note: NEVER expose hashedKey or other credentials here. Only the
// CreditTransaction fields defined below are returned to the client.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { getCreditBalance } from "@/lib/saas/entitlements";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TRANSACTIONS = 50;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to view your credit balance" },
      { status: 401 }
    );
  }

  try {
    const [balance, transactions] = await Promise.all([
      getCreditBalance(user.id),
      db.creditTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: MAX_TRANSACTIONS,
        select: {
          id: true,
          amount: true,
          balanceAfter: true,
          reason: true,
          description: true,
          relatedResourceId: true,
          createdAt: true,
          subscriptionId: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        balance,
        transactions: transactions.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch (e) {
    return safeErrorResponse(e, "Failed to load credit history", 500);
  }
}
