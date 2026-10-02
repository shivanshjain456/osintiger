// POST /api/stripe/credit-pack — create a Stripe Checkout Session for a
// one-time AI credit pack purchase.
//
// Body: { packId: string }   — must match an id in CREDIT_PACKS
// Success: 200 { url: string }   — redirect the browser to this URL
// Failure: 400 | 401 | 500 { error: string }

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { createCreditPackCheckout } from "@/lib/saas/stripe";
import { CREDIT_PACKS } from "@/lib/saas/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to purchase credits" },
      { status: 401 }
    );
  }

  let body: { packId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const packId = typeof body.packId === "string" ? body.packId : "";
  if (!packId || !CREDIT_PACKS.some((p) => p.id === packId)) {
    return NextResponse.json(
      { error: "Invalid or missing 'packId'." },
      { status: 400 }
    );
  }

  try {
    const { url } = await createCreditPackCheckout({
      userId: user.id,
      email: user.email,
      name: user.name,
      packId,
    });
    return NextResponse.json({ url }, { status: 200 });
  } catch (e) {
    return safeErrorResponse(e, "Failed to create credit pack checkout", 500);
  }
}
