// GET  /api/llm-config — Get current LLM provider config status (masked)
// POST /api/llm-config — Save/update LLM provider credentials
// DELETE /api/llm-config — Remove LLM config (revert to default)
//
// Security: All operations require authentication. Only authenticated users
// can view, set, or delete LLM provider credentials.

import { NextResponse } from "next/server";
import {
  getLLMConfigStatus,
  saveLLMConfig,
  removeLLMConfig,
  type LLMProvider,
} from "@/lib/osint/llm-provider";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse, unauthorizedResponse, badRequestResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — returns current config status (never returns raw API key)
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to view AI provider configuration");
    const status = await getLLMConfigStatus();
    return NextResponse.json(status || { hasConfig: false });
  } catch (e) {
    return safeErrorResponse(e, "Failed to get LLM config");
  }
}

// POST — save or update LLM provider credentials
export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to configure AI provider credentials");

    let body: {
      provider?: string;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
    };

    try {
      body = await req.json();
    } catch {
      return badRequestResponse("Invalid JSON body");
    }

    const provider = body.provider as LLMProvider;
    if (!provider || !["openai", "anthropic"].includes(provider)) {
      return badRequestResponse("Provider must be 'openai' or 'anthropic'");
    }

    const apiKey = (body.apiKey || "").trim();
    if (!apiKey) return badRequestResponse("API key is required");
    if (apiKey.length < 10) return badRequestResponse("API key appears too short");
    if (apiKey.length > 500) return badRequestResponse("API key too long (max 500 chars)");

    const model = (body.model || "").trim();
    if (!model) return badRequestResponse("Model is required");
    if (model.length > 100) return badRequestResponse("Model name too long");

    const baseUrl = body.baseUrl?.trim() || undefined;
    if (baseUrl && baseUrl.length > 500) return badRequestResponse("Base URL too long");

    const result = await saveLLMConfig(provider, apiKey, model, baseUrl);
    return NextResponse.json({
      success: true,
      id: result.id,
      message: `${provider} credentials saved. Use the validate endpoint to verify.`,
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to save LLM config");
  }
}

// DELETE — remove LLM config (revert to default ZAI SDK)
export async function DELETE() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to remove AI provider configuration");
    await removeLLMConfig();
    return NextResponse.json({
      success: true,
      message: "LLM config removed. Platform will use the default AI provider.",
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to remove LLM config");
  }
}
