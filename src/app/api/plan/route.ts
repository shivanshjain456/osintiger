// POST /api/plan — start an AI-planned investigation.
// The AI generates a custom investigation plan from the objective, then executes it.

import { NextResponse } from "next/server";
import { initPlan, runPlan, DEFAULT_PLAN_CONFIG } from "@/lib/osint/agent";
import type { PlanConfig } from "@/lib/osint/agent";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import {
  resolveEntitlement,
  checkModeEntitlement,
  checkAICredits,
  consumeAICredits,
} from "@/lib/saas/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: {
    target?: string;
    objective?: string;
    input_type?: string;
    config?: Partial<PlanConfig>;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const target = (body.target || "").toString().trim();
  if (!target) {
    return NextResponse.json({ error: "target is required" }, { status: 400 });
  }
  if (target.length > 256) {
    return NextResponse.json({ error: "target too long (max 256 chars)" }, { status: 400 });
  }

  const rawObjective = body.objective?.trim() || undefined;
  const objective = rawObjective ? rawObjective.slice(0, 500) : undefined;

  try {
  // ─── Entitlement gate ────────────────────────────────────────────────────
  // Plan mode is Investigator+; also requires AI credits for plan generation.
  let ent: Awaited<ReturnType<typeof resolveEntitlement>> | null = null;
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
    ent = await resolveEntitlement(user?.id || null);

    const modeCheck = checkModeEntitlement(ent, "plan");
    if (!modeCheck.allowed) {
      return NextResponse.json(
        {
          error: modeCheck.reason || "Plan mode not available on your plan",
          code: "plan_required",
          upgradeTier: modeCheck.upgradeTier,
        },
        { status: 402 }
      );
    }

    const creditCheck = await checkAICredits(ent, "ai_plan_generation");
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: creditCheck.reason || "Insufficient AI credits for plan generation",
          code: "insufficient_credits",
          upgradeTier: creditCheck.upgradeTier,
          usage: creditCheck.usage,
        },
        { status: 402 }
      );
    }
  } catch (entErr) {
    console.error("[plan] entitlement check failed", entErr);
  }

  // Validate config overrides
  const config: Partial<PlanConfig> = {};
  if (body.config) {
    if (typeof body.config.maxSteps === "number" && body.config.maxSteps >= 3 && body.config.maxSteps <= 10) {
      config.maxSteps = body.config.maxSteps;
    }
    if (typeof body.config.maxSourcesPerStep === "number" && body.config.maxSourcesPerStep >= 1 && body.config.maxSourcesPerStep <= 10) {
      config.maxSourcesPerStep = body.config.maxSourcesPerStep;
    }
    if (typeof body.config.maxTimeSeconds === "number" && body.config.maxTimeSeconds >= 30 && body.config.maxTimeSeconds <= 600) {
      config.maxTimeSeconds = body.config.maxTimeSeconds;
    }
    if (typeof body.config.enableReportSynthesis === "boolean") {
      config.enableReportSynthesis = body.config.enableReportSynthesis;
    }
    if (typeof body.config.allowParallelExecution === "boolean") {
      config.allowParallelExecution = body.config.allowParallelExecution;
    }
  }

  const { id, state, detection } = initPlan({
    target,
    objective,
    input_type: body.input_type,
    config,
  });

  if (!detection.valid) {
    return NextResponse.json(
      { error: detection.reason || "Invalid target", detection },
      { status: 400 }
    );
  }

  // Fire the plan executor in the background
  runPlan(id, detection).catch((err) => {
    console.error(`[plan-api] executor error for ${id}`, err);
  });

  // ─── AI credit consumption (best-effort) ─────────────────────────────────
  // Debit the plan-generation cost now that the operation has been accepted.
  // Wrapped in try/catch — credit exhaustion must never break a started plan.
  try {
    if (user?.id) {
      await consumeAICredits(
        user.id,
        "ai_plan_generation",
        ent?.subscription?.id || null,
        id
      );
    }
  } catch (creditErr) {
    console.error("[plan] credit consumption failed", creditErr);
  }

  return NextResponse.json({
    plan_id: id,
    status: state.status,
    objective: state.objective,
    target: state.target,
    input_type: state.inputType,
  });
  } catch (e) {
    return safeErrorResponse(e, "Failed to start plan session");
  }
}
