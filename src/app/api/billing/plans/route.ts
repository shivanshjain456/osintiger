// GET /api/billing/plans — public catalog of subscription plans for the
// pricing page. No auth required.
//
// Success: 200 { plans: PublicPlan[] }
//
// PublicPlan shape:
//   { id, tier, name, tagline, description, priceMonthly, priceAnnual,
//     isFeatured, featuresJson, limitsJson }

import { NextResponse } from "next/server";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plans = await db.subscriptionPlan.findMany({
      where: { isPublic: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        tier: true,
        name: true,
        tagline: true,
        description: true,
        priceMonthly: true,
        priceAnnual: true,
        isFeatured: true,
        featuresJson: true,
        limitsJson: true,
      },
    });

    return NextResponse.json({ plans }, { status: 200 });
  } catch (e) {
    return safeErrorResponse(e, "Failed to load plans", 500);
  }
}
