// POST /api/investigate/[id]/debate — Run a multi-agent debate on a standard investigation.
// GET /api/investigate/[id]/debate — Same (triggers a fresh debate).
//
// 7 specialized agents analyze the investigation independently, then a coordinator
// synthesizes their outputs into a single defensible conclusion.
//
// Query/body params:
//   maxRounds?: number (default: 1, max: 3)
//   objective?: string (default: derived from investigation target)

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { runDebate, buildEvidenceBundle, type DebateContext } from "@/lib/osint/multi-agent-debate";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { getSessionUser } from "@/lib/auth";
import {
  resolveEntitlement,
  checkFeatureEntitlement,
  checkAICredits,
  consumeAICredits,
} from "@/lib/saas/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes — debate can take a while with 7 agents

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }
  if (!rec.report) {
    return NextResponse.json(
      { error: "report not yet available — investigation may still be in progress" },
      { status: 409 }
    );
  }

  let body: { maxRounds?: number; objective?: string } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    // Body is optional — GET requests have no body
  }

  const maxRounds = Math.min(Math.max(body.maxRounds || 1, 1), 3);
  const rawObjective = body.objective?.trim() || `Comprehensive multi-agent analysis of ${rec.target}`;
  const objective = rawObjective.slice(0, 500); // cap at 500 chars to prevent prompt injection

  // ─── Entitlement gate ────────────────────────────────────────────────────
  // Multi-agent debate is a feature flag (Investigator+) AND costs 25 AI
  // credits per run. Anonymous users are gated out by both checks.
  let ent: Awaited<ReturnType<typeof resolveEntitlement>> | null = null;
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
    ent = await resolveEntitlement(user?.id || null);

    const featureCheck = checkFeatureEntitlement(ent, "multiAgentDebate");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        {
          error: featureCheck.reason || "Multi-agent debate is not available on your plan",
          code: "plan_required",
          upgradeTier: featureCheck.upgradeTier,
        },
        { status: 402 }
      );
    }

    const creditCheck = await checkAICredits(ent, "multi_agent_debate");
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: creditCheck.reason || "Insufficient AI credits for multi-agent debate",
          code: "insufficient_credits",
          upgradeTier: creditCheck.upgradeTier,
          usage: creditCheck.usage,
        },
        { status: 402 }
      );
    }
  } catch (entErr) {
    console.error("[debate] entitlement check failed", entErr);
  }

  const evidenceBundle = buildEvidenceBundle(rec.report, rec.source_results);

  const context: DebateContext = {
    investigationId: id,
    objective,
    target: rec.target,
    inputType: rec.input_type,
    report: rec.report,
    sourceResults: rec.source_results,
    keyFindings: rec.report.key_findings,
    evidenceBundle,
    maxRounds,
  };

  try {
    const result = await runDebate(context);

    // ─── AI credit consumption (best-effort) ────────────────────────────────
    // Debit the 25-credit debate cost now that the operation has succeeded.
    try {
      if (user?.id) {
        await consumeAICredits(
          user.id,
          "multi_agent_debate",
          ent?.subscription?.id || null,
          id
        );
      }
    } catch (creditErr) {
      console.error("[debate] credit consumption failed", creditErr);
    }

    return NextResponse.json(result);
  } catch (e) {
    return safeErrorResponse(e, "Debate failed");
  }
}

// GET — alias for POST (so users can trigger via simple navigation)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(req, { params });
}
