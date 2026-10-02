// POST /api/agent/investigate — initiate an autonomous investigation.
// Creates the agent state, fires the runner in the background, returns immediately.

import { NextResponse } from "next/server";
import { initAgentInvestigation, runAgent, DEFAULT_AGENT_CONFIG } from "@/lib/osint/agent";
import type { AgentConfig } from "@/lib/osint/agent";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import {
  resolveEntitlement,
  checkModeEntitlement,
  checkInvestigationEntitlement,
  incrementUsage,
} from "@/lib/saas/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for long-running agents

export async function POST(req: Request) {
  let body: {
    target?: string;
    objective?: string;
    input_type?: string;
    config?: Partial<AgentConfig>;
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
  // Agent mode is Investigator+; also enforce monthly investigation limit.
  let ent: Awaited<ReturnType<typeof resolveEntitlement>> | null = null;
  try {
    const user = await getSessionUser();
    ent = await resolveEntitlement(user?.id || null);

    const modeCheck = checkModeEntitlement(ent, "agent");
    if (!modeCheck.allowed) {
      return NextResponse.json(
        {
          error: modeCheck.reason || "Agent mode not available on your plan",
          code: "plan_required",
          upgradeTier: modeCheck.upgradeTier,
        },
        { status: 402 }
      );
    }

    const invCheck = await checkInvestigationEntitlement(ent);
    if (!invCheck.allowed) {
      return NextResponse.json(
        {
          error: invCheck.reason || "Investigation limit reached",
          code: "limit_exceeded",
          upgradeTier: invCheck.upgradeTier,
          usage: invCheck.usage,
        },
        { status: 402 }
      );
    }
  } catch (entErr) {
    console.error("[agent-investigate] entitlement check failed", entErr);
  }

  // Plan limit for agent iterations. Clamp any caller-supplied value down to
  // the subscription's maxAgentIterations when the caller exceeds it.
  const planMaxIterations = ent?.planLimits?.maxAgentIterations ?? 0;

  // Validate config overrides
  const config: Partial<AgentConfig> = {};
  if (body.config) {
    if (typeof body.config.maxIterations === "number" && body.config.maxIterations >= 1 && body.config.maxIterations <= 10) {
      let iter = body.config.maxIterations;
      // Clamp to the plan ceiling (only when the plan ceiling is finite and > 0).
      if (planMaxIterations > 0 && iter > planMaxIterations) {
        iter = planMaxIterations;
      }
      if (iter >= 1) config.maxIterations = iter;
    }
    if (typeof body.config.maxEntities === "number" && body.config.maxEntities >= 1 && body.config.maxEntities <= 200) {
      config.maxEntities = body.config.maxEntities;
    }
    if (typeof body.config.maxTimeSeconds === "number" && body.config.maxTimeSeconds >= 30 && body.config.maxTimeSeconds <= 600) {
      config.maxTimeSeconds = body.config.maxTimeSeconds;
    }
    if (typeof body.config.maxDepth === "number" && body.config.maxDepth >= 0 && body.config.maxDepth <= 5) {
      config.maxDepth = body.config.maxDepth;
    }
    if (typeof body.config.maxActionsPerIteration === "number" && body.config.maxActionsPerIteration >= 1 && body.config.maxActionsPerIteration <= 10) {
      config.maxActionsPerIteration = body.config.maxActionsPerIteration;
    }
    if (typeof body.config.enableRecursiveExpansion === "boolean") {
      config.enableRecursiveExpansion = body.config.enableRecursiveExpansion;
    }
    if (typeof body.config.enableReportSynthesis === "boolean") {
      config.enableReportSynthesis = body.config.enableReportSynthesis;
    }
  }

  // Initialize the agent
  const { id, state, detection } = initAgentInvestigation({
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

  // Fire the agent runner in the background (do not await)
  runAgent(id, detection).catch((err) => {
    console.error(`[agent-api] runner error for ${id}`, err);
  });

  // ─── Usage metering (best-effort) ────────────────────────────────────────
  try {
    if (ent?.subscription?.id) {
      await incrementUsage(ent.subscription.id, "investigations", 1, ent.userId || undefined);
    }
  } catch (usageErr) {
    console.error("[agent-investigate] usage increment failed", usageErr);
  }

  return NextResponse.json({
    investigation_id: id,
    status: state.status,
    objective: state.objective,
    target: state.target,
    input_type: state.inputType,
    config: state.config,
  });
  } catch (e) {
    return safeErrorResponse(e, "Failed to start agent investigation");
  }
}
