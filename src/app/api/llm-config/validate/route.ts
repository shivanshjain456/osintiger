// POST /api/llm-config/validate — Validate LLM provider credentials
// Makes a minimal API call to verify the key works with the specified model.

import { NextResponse } from "next/server";
import {
  validateLLMConfig,
  updateValidationStatus,
  getActiveLLMConfig,
  type LLMProvider,
} from "@/lib/osint/llm-provider";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  let body: {
    provider?: string;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const provider = body.provider as LLMProvider;
  if (!provider || !["openai", "anthropic"].includes(provider)) {
    return NextResponse.json(
      { error: "Provider must be 'openai' or 'anthropic'" },
      { status: 400 }
    );
  }

  const apiKey = (body.apiKey || "").trim();
  const model = (body.model || "").trim();
  const baseUrl = body.baseUrl?.trim() || undefined;

  // If no apiKey provided, try to use the stored config
  let keyToValidate = apiKey;
  let modelToValidate = model;
  if (!keyToValidate) {
    const config = await getActiveLLMConfig();
    if (!config || config.provider !== provider) {
      return NextResponse.json(
        { error: "No API key provided and no active config found for this provider" },
        { status: 400 }
      );
    }
    keyToValidate = config.apiKey;
    modelToValidate = modelToValidate || config.model;
  }

  if (!modelToValidate) {
    return NextResponse.json({ error: "Model is required" }, { status: 400 });
  }

  try {
    const result = await validateLLMConfig(provider, keyToValidate, modelToValidate, baseUrl);

    // Update validation status in the database
    await updateValidationStatus(result.valid, result.valid ? undefined : result.detail);

    return NextResponse.json(result);
  } catch (e) {
    return safeErrorResponse(e, "Validation failed");
  }
}
