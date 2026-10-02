// POST /api/discover — start a recursive discovery session.
// Creates the discovery state, fires the engine in the background, returns immediately.

import { NextResponse } from "next/server";
import { initDiscovery, runDiscovery, DEFAULT_DISCOVERY_CONFIG } from "@/lib/osint/agent";
import type { DiscoveryConfig } from "@/lib/osint/agent";
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
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: {
    target?: string;
    input_type?: string;
    config?: Partial<DiscoveryConfig>;
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

  try {
  // ─── Entitlement gate ────────────────────────────────────────────────────
  // Discovery mode is Investigator+; also enforce monthly investigation limit.
  let ent: Awaited<ReturnType<typeof resolveEntitlement>> | null = null;
  try {
    const user = await getSessionUser();
    ent = await resolveEntitlement(user?.id || null);

    const modeCheck = checkModeEntitlement(ent, "discovery");
    if (!modeCheck.allowed) {
      return NextResponse.json(
        {
          error: modeCheck.reason || "Discovery mode not available on your plan",
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
    console.error("[discover] entitlement check failed", entErr);
  }

  // Plan ceiling for discovery depth. Clamp any caller-supplied maxDepth
  // down to the subscription's maxDiscoveryDepth when the caller exceeds it.
  const planMaxDepth = ent?.planLimits?.maxDiscoveryDepth ?? 0;

  // Validate config overrides
  const config: Partial<DiscoveryConfig> = {};
  if (body.config) {
    if (typeof body.config.maxDepth === "number" && body.config.maxDepth >= 0 && body.config.maxDepth <= 5) {
      let depth = body.config.maxDepth;
      // Clamp to the plan ceiling (only when finite and > 0).
      if (planMaxDepth > 0 && depth > planMaxDepth) {
        depth = planMaxDepth;
      }
      if (depth >= 0) config.maxDepth = depth;
    }
    if (typeof body.config.maxEntities === "number" && body.config.maxEntities >= 1 && body.config.maxEntities <= 500) {
      config.maxEntities = body.config.maxEntities;
    }
    if (typeof body.config.maxTimeSeconds === "number" && body.config.maxTimeSeconds >= 30 && body.config.maxTimeSeconds <= 600) {
      config.maxTimeSeconds = body.config.maxTimeSeconds;
    }
    if (typeof body.config.maxSourcesPerEntity === "number" && body.config.maxSourcesPerEntity >= 1 && body.config.maxSourcesPerEntity <= 10) {
      config.maxSourcesPerEntity = body.config.maxSourcesPerEntity;
    }
    if (typeof body.config.allowSameTypeExpansion === "boolean") {
      config.allowSameTypeExpansion = body.config.allowSameTypeExpansion;
    }
  }

  const { id, state, detection } = initDiscovery({
    target,
    input_type: body.input_type,
    config,
  });

  if (!detection.valid) {
    return NextResponse.json(
      { error: detection.reason || "Invalid target", detection },
      { status: 400 }
    );
  }

  // Fire the discovery engine in the background
  runDiscovery(id, detection).catch((err) => {
    console.error(`[discover-api] engine error for ${id}`, err);
  });

  // ─── Usage metering (best-effort) ────────────────────────────────────────
  try {
    if (ent?.subscription?.id) {
      await incrementUsage(ent.subscription.id, "investigations", 1, ent.userId || undefined);
    }
  } catch (usageErr) {
    console.error("[discover] usage increment failed", usageErr);
  }

  return NextResponse.json({
    discovery_id: id,
    status: state.status,
    root_target: state.rootTarget,
    root_type: state.rootType,
    config: state.config,
  });
  } catch (e) {
    return safeErrorResponse(e, "Failed to start discovery session");
  }
}
