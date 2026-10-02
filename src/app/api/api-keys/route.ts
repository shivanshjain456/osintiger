// GET  /api/api-keys — list the signed-in user's API keys (hashedKey is NEVER returned).
// POST /api/api-keys — create a new API key. Returns the plaintext key ONCE.
//
// API access is gated to the `apiAccess` plan flag (Professional+). The
// plaintext key is returned only on creation; subsequent GETs only expose
// the `keyPrefix` (first 12 chars) for display.
//
// Auth: required. 401 if not signed in.
// 402 if the user's plan does not include API access.

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import {
  resolveEntitlement,
  checkFeatureEntitlement,
} from "@/lib/saas/entitlements";
import { recordAudit } from "@/lib/osint/audit";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BCRYPT_ROUNDS = 12;
const KEY_PREFIX_LENGTH = 12; // includes the "osk_" namespace

/**
 * Generate a new API key: `osk_` + 32 hex chars = 36 chars total.
 * Returned to the caller exactly once on creation.
 */
function generateApiKey(): string {
  const bytes = new Uint8Array(16); // 16 bytes → 32 hex chars
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `osk_${hex}`;
}

// ─── GET — list keys (never hashedKey) ──────────────────────────────────────

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to manage API keys" },
      { status: 401 }
    );
  }

  try {
    const ent = await resolveEntitlement(user.id);
    const accessCheck = checkFeatureEntitlement(ent, "apiAccess");
    if (!accessCheck.allowed) {
      return NextResponse.json(
        {
          error: accessCheck.reason || "API access is not available on your plan",
          code: "plan_required",
          upgradeTier: accessCheck.upgradeTier,
        },
        { status: 402 }
      );
    }

    const keys = await db.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopesJson: true,
        rateLimitPerMin: true,
        lastUsedAt: true,
        lastIp: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        // NOTE: hashedKey deliberately omitted — never expose to client.
      },
    });

    return NextResponse.json(
      {
        keys: keys.map((k) => ({
          ...k,
          scopes: safeParseScopes(k.scopesJson),
          scopesJson: undefined,
          lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
          expiresAt: k.expiresAt ? k.expiresAt.toISOString() : null,
          createdAt: k.createdAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch (e) {
    return safeErrorResponse(e, "Failed to load API keys", 500);
  }
}

// ─── POST — create a new key ────────────────────────────────────────────────

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to create an API key" },
      { status: 401 }
    );
  }

  let body: { name?: string; scopes?: string[]; rateLimitPerMin?: number; expiresAt?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name || "").trim().slice(0, 64);
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const scopes = Array.isArray(body.scopes)
    ? body.scopes.filter((s): s is string => typeof s === "string").slice(0, 10)
    : [];

  const rateLimitPerMin =
    typeof body.rateLimitPerMin === "number" && body.rateLimitPerMin >= 1 && body.rateLimitPerMin <= 1000
      ? Math.floor(body.rateLimitPerMin)
      : 60;

  let expiresAt: Date | null = null;
  if (typeof body.expiresAt === "string" && body.expiresAt) {
    const parsed = new Date(body.expiresAt);
    if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
      expiresAt = parsed;
    }
  }

  try {
    const ent = await resolveEntitlement(user.id);
    const accessCheck = checkFeatureEntitlement(ent, "apiAccess");
    if (!accessCheck.allowed) {
      return NextResponse.json(
        {
          error: accessCheck.reason || "API access is not available on your plan",
          code: "plan_required",
          upgradeTier: accessCheck.upgradeTier,
        },
        { status: 402 }
      );
    }

    const plaintextKey = generateApiKey();
    const keyPrefix = plaintextKey.slice(0, KEY_PREFIX_LENGTH);
    const hashedKey = await bcrypt.hash(plaintextKey, BCRYPT_ROUNDS);
    const id = crypto.randomUUID();

    await db.apiKey.create({
      data: {
        id,
        userId: user.id,
        organizationId: ent.organizationId || null,
        name,
        keyPrefix,
        hashedKey,
        scopesJson: JSON.stringify(scopes.length ? scopes : ["read"]),
        rateLimitPerMin,
        isActive: true,
        expiresAt,
      },
    });

    // Fire-and-forget audit entry.
    recordAudit({
      action: "api_key.create",
      category: "config",
      actorType: "user",
      actorId: user.id,
      resourceType: "api_key",
      resourceId: id,
      detail: `Created API key "${name}" (${keyPrefix}…)`,
      metadata: { name, scopes, rateLimitPerMin },
      severity: "info",
      outcome: "success",
    }).catch(() => { /* audit never throws */ });

    // Return the plaintext key ONCE. Subsequent GETs only expose keyPrefix.
    return NextResponse.json(
      {
        id,
        name,
        keyPrefix,
        key: plaintextKey,
        scopes: scopes.length ? scopes : ["read"],
        rateLimitPerMin,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        createdAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (e) {
    return safeErrorResponse(e, "Failed to create API key", 500);
  }
}

function safeParseScopes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}
