// POST /api/entitlements/check — pre-flight entitlement gate for the frontend.
//
// The SPA calls this BEFORE opening a modal / starting a flow so we can show
// the upgrade wall without burning a server-side action. Body:
//   {
//     action: "investigate" | "ai_synthesis" | "ai_vlm" | "ai_debate" | "export" | "mode",
//     params?: { mode?, format?, operation? }
//   }
//
// Auth: optional. Anonymous callers are resolved to the anonymous free tier.
// Returns: 200 { allowed, reason?, upgradeTier?, usage? }

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  resolveEntitlement,
  checkInvestigationEntitlement,
  checkModeEntitlement,
  checkExportEntitlement,
  checkAICredits,
} from "@/lib/saas/entitlements";
import type { AIOperation } from "@/lib/saas/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | "investigate"
  | "ai_synthesis"
  | "ai_vlm"
  | "ai_debate"
  | "export"
  | "mode";

interface CheckBody {
  action?: Action;
  params?: {
    mode?: string;
    format?: string;
    operation?: AIOperation;
  };
}

const AI_ACTION_TO_OPERATION: Record<"ai_synthesis" | "ai_vlm" | "ai_debate", AIOperation> = {
  ai_synthesis: "synthesis",
  ai_vlm: "vlm_analysis",
  ai_debate: "multi_agent_debate",
};

export async function POST(req: Request) {
  let body: CheckBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  const allowedActions: Action[] = [
    "investigate",
    "ai_synthesis",
    "ai_vlm",
    "ai_debate",
    "export",
    "mode",
  ];
  if (!allowedActions.includes(action)) {
    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  }

  try {
    const user = await getSessionUser();
    const ent = await resolveEntitlement(user?.id || null);

    switch (action) {
      case "investigate": {
        const check = await checkInvestigationEntitlement(ent);
        return NextResponse.json(check);
      }
      case "ai_synthesis":
      case "ai_vlm":
      case "ai_debate": {
        const operation = AI_ACTION_TO_OPERATION[action];
        const check = await checkAICredits(ent, operation);
        return NextResponse.json(check);
      }
      case "export": {
        const format = (body.params?.format || "json").toLowerCase();
        const check = checkExportEntitlement(ent, format);
        return NextResponse.json(check);
      }
      case "mode": {
        const mode = body.params?.mode;
        if (!mode) {
          return NextResponse.json(
            { allowed: false, reason: "params.mode is required for mode check" },
            { status: 400 }
          );
        }
        const check = checkModeEntitlement(ent, mode);
        return NextResponse.json(check);
      }
      default: {
        // Exhaustive guard — should never reach here.
        return NextResponse.json(
          { allowed: false, reason: "Unhandled action" },
          { status: 400 }
        );
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { allowed: false, reason: `Entitlement check failed: ${msg}` },
      { status: 500 }
    );
  }
}
