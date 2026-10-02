// POST /api/analyze-image — Visual Intelligence Module (VLM via z-ai SDK).
// Accepts multipart (image file) OR JSON { imageUrl }. Uses VLM for OSINT analysis.

import { NextResponse } from "next/server";
import { analyzeImageWithVLM } from "@/lib/osint/ai-client";
import type { VisualIntelResult, SourceConsulted } from "@/lib/osint/types";
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
export const maxDuration = 60;

const OSINT_IMAGE_PROMPT = `Analyze this image strictly for OSINT purposes. Identify:
1. Visible text / signage / license plates / labels (quote exactly)
2. Geolocation cues (architecture, vegetation, infrastructure, language on signs, sun direction)
3. Objects, vehicles, technology, brands
4. People (count, roles, uniforms) — do NOT attempt facial recognition or identification
5. Apparent time/season
6. Any signs of digital manipulation or synthetic generation

Return ONLY a JSON object:
{
  "analysis": "structured 4-6 sentence OSINT analysis",
  "entities": ["entity1", "entity2"],
  "geolocation": "best-effort location or 'Unknown'",
  "confidence": 0.0,
  "warnings": ["any manipulation/safety concerns"]
}
Confidence reflects how confident you are in the geolocation + entity identification.`;

function stripJson(s: string): string {
  let t = s.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const a = t.indexOf("{");
  const b = t.lastIndexOf("}");
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1);
  return t;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  let imageUrl = "";
  let fileName = "uploaded-image";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided" }, { status: 400 });
    }
    fileName = file.name || "image";
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large (max 8MB)" }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "image/jpeg";
    imageUrl = `data:${mime};base64,${buf.toString("base64")}`;
  } else {
    try {
      const j = await req.json();
      imageUrl = j?.imageUrl || "";
    } catch {
      return NextResponse.json({ error: "Provide multipart image or { imageUrl }" }, { status: 400 });
    }
  }

  if (!imageUrl) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Prevent excessively large data URIs or URLs
  if (imageUrl.length > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Image URL or data too large (max 8MB)" }, { status: 413 });
  }

  // ─── Entitlement gate ────────────────────────────────────────────────────
  // Visual Intelligence requires the `visualIntelligence` plan flag AND a
  // positive AI credit balance for the VLM operation. Anonymous users are
  // gated out (free tier has visualIntelligence=false).
  let ent: Awaited<ReturnType<typeof resolveEntitlement>> | null = null;
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
    ent = await resolveEntitlement(user?.id || null);

    const featureCheck = checkFeatureEntitlement(ent, "visualIntelligence");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        {
          error: featureCheck.reason || "Visual Intelligence is not available on your plan",
          code: "plan_required",
          upgradeTier: featureCheck.upgradeTier,
        },
        { status: 402 }
      );
    }

    const creditCheck = await checkAICredits(ent, "vlm_analysis");
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: creditCheck.reason || "Insufficient AI credits for VLM analysis",
          code: "insufficient_credits",
          upgradeTier: creditCheck.upgradeTier,
          usage: creditCheck.usage,
        },
        { status: 402 }
      );
    }
  } catch (entErr) {
    console.error("[analyze-image] entitlement check failed", entErr);
  }

  try {
    const raw = await analyzeImageWithVLM(imageUrl, OSINT_IMAGE_PROMPT);
    let parsed: {
      analysis?: string;
      entities?: string[];
      geolocation?: string;
      confidence?: number;
      warnings?: string[];
    } = {};
    try {
      parsed = JSON.parse(stripJson(raw));
    } catch {
      parsed = { analysis: raw, entities: [], geolocation: "Unknown", confidence: 0.4, warnings: [] };
    }
    const sources: SourceConsulted[] = [
      {
        source: "vlm",
        source_label: "Visual Intelligence (VLM)",
        status: "success",
        url: fileName ? `upload://${fileName}` : "image-url",
        finding_count: 1,
      },
    ];
    const result: VisualIntelResult = {
      analysis: parsed.analysis || raw,
      entities: parsed.entities || [],
      geolocation: parsed.geolocation || "Unknown",
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.4,
      warnings: parsed.warnings || [],
      sources,
    };

    // ─── AI credit consumption (best-effort) ────────────────────────────────
    // Debit the VLM cost now that the analysis succeeded.
    try {
      if (user?.id) {
        await consumeAICredits(
          user.id,
          "vlm_analysis",
          ent?.subscription?.id || null,
          ""
        );
      }
    } catch (creditErr) {
      console.error("[analyze-image] credit consumption failed", creditErr);
    }

    return NextResponse.json(result);
  } catch (e) {
    return safeErrorResponse(e, "Visual analysis failed");
  }
}
