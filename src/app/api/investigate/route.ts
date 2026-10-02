// POST /api/investigate — initiate a new OSINT investigation.
// Validates input, creates a job, fires the 8-step pipeline in the background,
// returns immediately with the investigation id for polling.

import { NextResponse } from "next/server";
import { initInvestigation, runPipeline } from "@/lib/osint/pipeline";
import { detectInput } from "@/lib/osint/detector";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import {
  resolveEntitlement,
  checkInvestigationEntitlement,
  incrementUsage,
} from "@/lib/saas/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: {
    target?: string;
    input_type?: string;
    language?: string;
    modules?: string[];
    playbook?: string; // Feature 24
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
  // ─── Entitlement check ──────────────────────────────────────────────────

  // Resolve the user for both entitlement checking and notification routing.
  const sessionUser = await getSessionUser();

  // ─── Entitlement gate ────────────────────────────────────────────────────
  // Anonymous users are allowed within the anonymous free tier; only block
  // when they exceed limits. Logged-in users get their subscription limits.
  try {
    const ent = await resolveEntitlement(sessionUser?.id || null);
    const check = await checkInvestigationEntitlement(ent);
    if (!check.allowed) {
      return NextResponse.json(
        {
          error: check.reason || "Investigation limit reached",
          code: "limit_exceeded",
          upgradeTier: check.upgradeTier,
          usage: check.usage,
        },
        { status: 402 }
      );
    }
  } catch (entErr) {
    // Never block the core flow on entitlement resolution failures — log and
    // continue. The investigation still runs; usage metering is best-effort.
    console.error("[investigate] entitlement check failed", entErr);
  }

  const detection = detectInput(target, (body.input_type as never) || "auto");
  if (!detection.valid) {
    return NextResponse.json(
      { error: detection.reason || "Invalid target", detection },
      { status: 400 }
    );
  }

  const { id, record } = initInvestigation({
    target,
    input_type: body.input_type,
    language: body.language,
    modules: body.modules,
    playbook: body.playbook, // Feature 24
    userId: sessionUser?.id || null,
  });

  // Fire pipeline in the background (do not await)
  runPipeline(id, detection).catch((err) => {
    console.error("[investigate] pipeline error", err);
  });

  // ─── Usage metering (best-effort) ────────────────────────────────────────
  // Increment the investigations counter for this billing period. Wrapped in
  // try/catch so a metering failure never breaks the investigation flow.
  try {
    if (sessionUser) {
      const ent = await resolveEntitlement(sessionUser.id);
      if (ent.subscription && ent.subscription.id) {
        await incrementUsage(ent.subscription.id, "investigations", 1, sessionUser.id);
      }
    }
  } catch (usageErr) {
    console.error("[investigate] usage increment failed", usageErr);
  }

  return NextResponse.json({
    investigation_id: id,
    status: record.status,
    estimated_time: 35,
    detection: {
      input_type: detection.inputType,
      script: detection.script,
      language: detection.languageGuess,
      region_hints: detection.regionHints,
    },
    playbook: body.playbook || null, // Feature 24
  });
  } catch (e) {
    return safeErrorResponse(e, "Failed to start investigation");
  }
}
