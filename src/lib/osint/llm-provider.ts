// LLM Provider Abstraction — BYO-LLM (Bring Your Own AI Agent)
//
// Provides a unified interface for AI calls that routes to either:
//   1. User-configured provider (OpenAI, Anthropic) if credentials exist
//   2. Default ZAI SDK if no user credentials configured
//
// Security:
//   - API keys are AES-256-GCM encrypted at rest
//   - Keys are never logged, never returned in full via API
//   - Only the encrypted form is stored in the database
//   - Decryption happens in-memory only at call time

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { db } from "@/lib/db";

// ============================================================================
// TYPES
// ============================================================================

export type LLMProvider = "openai" | "anthropic" | "default";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface LLMCompletionRequest {
  messages: { role: string; content: string }[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  tokensUsed?: number;
}

export interface LLMValidationResult {
  valid: boolean;
  provider: LLMProvider;
  model: string;
  error?: string;
  detail?: string;
}

// ============================================================================
// ENCRYPTION — AES-256-GCM for credential storage at rest
// ============================================================================

const ENCRYPTION_KEY = process.env.LLM_ENCRYPTION_KEY || "osintiger-default-encryption-key-change-in-production-32bytes";
const SALT = "osintiger-llm-salt";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function deriveKey(): Buffer {
  return scryptSync(ENCRYPTION_KEY, SALT, KEY_LENGTH);
}

export function encryptApiKey(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv:tag:encrypted (all hex-encoded)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptApiKey(ciphertext: string): string {
  const key = deriveKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const iv = Buffer.from(parts[0], "hex");
  const tag = Buffer.from(parts[1], "hex");
  const encrypted = Buffer.from(parts[2], "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

// ============================================================================
// CONFIG MANAGEMENT — CRUD for LLM provider credentials
// ============================================================================

/**
 * Get the active LLM configuration.
 * Returns user-configured provider if exists, otherwise null (use default ZAI).
 */
export async function getActiveLLMConfig(): Promise<LLMConfig | null> {
  try {
    const config = await db.lLMProviderConfig.findFirst({
      where: { isActive: true, isValidated: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!config) return null;

    return {
      provider: config.provider as LLMProvider,
      apiKey: decryptApiKey(config.apiKey),
      model: config.model,
      baseUrl: config.baseUrl || undefined,
    };
  } catch (e) {
    console.error("[llm-provider] getActiveLLMConfig failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Save or update LLM provider credentials.
 */
export async function saveLLMConfig(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<{ id: string; saved: boolean }> {
  const id = `llm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const encryptedKey = encryptApiKey(apiKey);

  // Use a transaction to ensure atomicity: deactivate existing configs AND
  // create the new config must succeed together. If the create fails, the
  // deactivation is rolled back, preserving the previous active config.
  await db.$transaction([
    // Deactivate any existing configs
    db.lLMProviderConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    // Create new config
    db.lLMProviderConfig.create({
      data: {
        id,
        provider,
        apiKey: encryptedKey,
        model,
        baseUrl: baseUrl || "",
        isActive: true,
        isValidated: false,
      },
    }),
  ]);

  return { id, saved: true };
}

/**
 * Remove the active LLM configuration (revert to default).
 */
export async function removeLLMConfig(): Promise<boolean> {
  await db.lLMProviderConfig.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });
  return true;
}

/**
 * Get the current LLM configuration status (for UI display).
 * Never returns the actual API key — only masked version.
 */
export async function getLLMConfigStatus(): Promise<{
  hasConfig: boolean;
  provider: LLMProvider | null;
  model: string;
  isActive: boolean;
  isValidated: boolean;
  lastValidatedAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  lastError: string;
  maskedKey: string;
} | null> {
  try {
    const config = await db.lLMProviderConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!config) {
      return {
        hasConfig: false,
        provider: null,
        model: "",
        isActive: false,
        isValidated: false,
        lastValidatedAt: null,
        lastUsedAt: null,
        usageCount: 0,
        lastError: "",
        maskedKey: "",
      };
    }

    // Mask the API key: show only last 4 characters
    let maskedKey = "";
    try {
      const decrypted = decryptApiKey(config.apiKey);
      maskedKey = decrypted.length > 8
        ? "•".repeat(decrypted.length - 4) + decrypted.slice(-4)
        : "•".repeat(decrypted.length);
    } catch {
      maskedKey = "[encrypted]";
    }

    return {
      hasConfig: true,
      provider: config.provider as LLMProvider,
      model: config.model,
      isActive: config.isActive,
      isValidated: config.isValidated,
      lastValidatedAt: config.lastValidatedAt?.toISOString() || null,
      lastUsedAt: config.lastUsedAt?.toISOString() || null,
      usageCount: config.usageCount,
      lastError: config.lastError,
      maskedKey,
    };
  } catch (e) {
    console.error("[llm-provider] getLLMConfigStatus failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Update validation status after a health check.
 */
export async function updateValidationStatus(
  valid: boolean,
  error?: string
): Promise<void> {
  const config = await db.lLMProviderConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!config) return;

  await db.lLMProviderConfig.update({
    where: { id: config.id },
    data: {
      isValidated: valid,
      lastValidatedAt: new Date(),
      lastError: error || "",
    },
  });
}

/**
 * Increment usage counter and update last used timestamp.
 */
export async function recordUsage(): Promise<void> {
  const config = await db.lLMProviderConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!config) return;

  await db.lLMProviderConfig.update({
    where: { id: config.id },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}

// ============================================================================
// LLM COMPLETION — Unified interface for all providers
// ============================================================================

/**
 * Execute an LLM completion call using the configured provider.
 * If no user-configured provider exists, falls back to the default ZAI SDK.
 */
export async function llmComplete(
  request: LLMCompletionRequest
): Promise<LLMCompletionResponse> {
  const config = await getActiveLLMConfig();

  if (!config) {
    // Use default ZAI SDK
    return llmCompleteDefault(request);
  }

  // Use user-configured provider
  try {
    await recordUsage();
    if (config.provider === "openai") {
      return await llmCompleteOpenAI(request, config);
    } else if (config.provider === "anthropic") {
      return await llmCompleteAnthropic(request, config);
    } else {
      // Unknown provider — fall back to default
      console.warn(`[llm-provider] Unknown provider: ${config.provider}, falling back to default`);
      return llmCompleteDefault(request);
    }
  } catch (e) {
    // If user provider fails, log and fall back to default
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error(`[llm-provider] ${config.provider} call failed: ${errorMsg}. Falling back to default.`);

    // Update error status
    await db.lLMProviderConfig.updateMany({
      where: { isActive: true },
      data: { lastError: errorMsg.slice(0, 200) },
    });

    // Fall back to default ZAI SDK
    return llmCompleteDefault(request);
  }
}

// ============================================================================
// DEFAULT PROVIDER (ZAI SDK)
// ============================================================================

async function llmCompleteDefault(
  request: LLMCompletionRequest
): Promise<LLMCompletionResponse> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const messages = (request.systemPrompt
    ? [{ role: "assistant" as const, content: request.systemPrompt }, ...request.messages]
    : request.messages) as { role: "assistant" | "system" | "user"; content: string }[];

  const completion = await zai.chat.completions.create({
    messages,
    thinking: { type: "disabled" },
  });

  return {
    content: completion.choices?.[0]?.message?.content || "",
    model: "zai-default",
    provider: "default",
  };
}

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

async function llmCompleteOpenAI(
  request: LLMCompletionRequest,
  config: LLMConfig
): Promise<LLMCompletionResponse> {
  const baseUrl = config.baseUrl || "https://api.openai.com/v1";
  const model = config.model || "gpt-4o";

  const messages = request.systemPrompt
    ? [{ role: "system", content: request.systemPrompt }, ...request.messages]
    : request.messages;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.3,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg: string;
    if (response.status === 401) {
      errorMsg = "Invalid API key — authentication failed";
    } else if (response.status === 429) {
      errorMsg = "Rate limit exceeded or insufficient quota";
    } else if (response.status === 404) {
      errorMsg = `Model '${model}' not found or not accessible with this API key`;
    } else if (response.status >= 500) {
      errorMsg = `OpenAI server error (${response.status})`;
    } else {
      errorMsg = `OpenAI API error (${response.status}): ${errorBody.slice(0, 200)}`;
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model || model,
    provider: "openai",
    tokensUsed: data.usage?.total_tokens,
  };
}

// ============================================================================
// ANTHROPIC PROVIDER
// ============================================================================

async function llmCompleteAnthropic(
  request: LLMCompletionRequest,
  config: LLMConfig
): Promise<LLMCompletionResponse> {
  const baseUrl = config.baseUrl || "https://api.anthropic.com";
  const model = config.model || "claude-3-5-sonnet-20241022";
  const anthropicVersion = "2023-06-01";

  // Anthropic uses a different message format: system is a top-level field
  const systemPrompt = request.systemPrompt || "";
  const messages = request.messages.map((m): { role: "user" | "assistant"; content: string } => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  // Ensure first message is a user message (Anthropic requirement)
  if (messages.length === 0 || messages[0].role !== "user") {
    messages.unshift({ role: "user", content: "Begin." });
  }

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": anthropicVersion,
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.3,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMsg: string;
    if (response.status === 401) {
      errorMsg = "Invalid API key — authentication failed";
    } else if (response.status === 429) {
      errorMsg = "Rate limit exceeded or insufficient quota";
    } else if (response.status === 404) {
      errorMsg = `Model '${model}' not found or not accessible with this API key`;
    } else if (response.status >= 500) {
      errorMsg = `Anthropic server error (${response.status})`;
    } else {
      errorMsg = `Anthropic API error (${response.status}): ${errorBody.slice(0, 200)}`;
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  // Anthropic returns content as an array of content blocks
  const content = Array.isArray(data.content)
    ? data.content.map((block: { type: string; text?: string }) => block.text || "").join("")
    : "";

  return {
    content,
    model: data.model || model,
    provider: "anthropic",
    tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
  };
}

// ============================================================================
// VALIDATION — Health check for user-configured credentials
// ============================================================================

/**
 * Validate that the provided API key works with the specified provider and model.
 * Makes a minimal API call to verify authentication and model access.
 */
export async function validateLLMConfig(
  provider: LLMProvider,
  apiKey: string,
  model: string,
  baseUrl?: string
): Promise<LLMValidationResult> {
  const config: LLMConfig = { provider, apiKey, model, baseUrl };

  try {
    if (provider === "openai") {
      // Make a minimal completion request to validate
      const response = await llmCompleteOpenAI(
        {
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
          maxTokens: 5,
        },
        config
      );
      return {
        valid: true,
        provider: "openai",
        model: response.model,
      };
    } else if (provider === "anthropic") {
      const response = await llmCompleteAnthropic(
        {
          messages: [{ role: "user", content: "Reply with exactly: OK" }],
          maxTokens: 5,
        },
        config
      );
      return {
        valid: true,
        provider: "anthropic",
        model: response.model,
      };
    } else {
      return {
        valid: false,
        provider,
        model,
        error: "Unknown provider",
      };
    }
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    let errorType = "unknown";
    let detail = errorMsg;

    if (errorMsg.includes("Invalid API key") || errorMsg.includes("authentication")) {
      errorType = "authentication";
    } else if (errorMsg.includes("Rate limit") || errorMsg.includes("quota")) {
      errorType = "quota";
    } else if (errorMsg.includes("not found") || errorMsg.includes("not accessible")) {
      errorType = "model";
    } else if (errorMsg.includes("server error") || errorMsg.includes("5")) {
      errorType = "provider_outage";
    } else if (errorMsg.includes("timeout") || errorMsg.includes("network")) {
      errorType = "network";
    }

    return {
      valid: false,
      provider,
      model,
      error: errorType,
      detail,
    };
  }
}
