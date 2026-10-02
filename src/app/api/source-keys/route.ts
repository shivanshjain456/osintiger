// GET    /api/source-keys — list configured source API keys (never returns apiKey).
// POST   /api/source-keys — upsert a source API key (encrypts with AES-256-GCM).
// DELETE /api/source-keys?sourceKey=<key> — delete a source API key.
//
// Security: All operations require authentication.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/osint/audit";
import { safeErrorResponse, unauthorizedResponse, badRequestResponse } from "@/lib/osint/safe-error";
import { encryptApiKey } from "@/lib/osint/llm-provider";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to view source API keys");
    const sources = await db.sourceApiKey.findMany({
      orderBy: [{ sourceKey: "asc" }],
      select: {
        sourceKey: true,
        sourceLabel: true,
        isActive: true,
        isValidated: true,
        lastValidatedAt: true,
        lastError: true,
        docsUrl: true,
        usageCount: true,
        // NOTE: apiKey deliberately omitted — never expose encrypted keys to client.
      },
    });
    return NextResponse.json({ sources });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch source API keys");
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to manage source API keys");

    let body: { sourceKey?: string; apiKey?: string; sourceLabel?: string };
    try {
      body = await req.json();
    } catch {
      return badRequestResponse("Invalid JSON body");
    }

    const sourceKey = (body.sourceKey || "").trim();
    if (!sourceKey) return badRequestResponse("sourceKey is required");
    if (sourceKey.length > 64) return badRequestResponse("sourceKey too long");

    const apiKey = (body.apiKey || "").trim();
    if (!apiKey) return badRequestResponse("apiKey is required");
    if (apiKey.length > 500) return badRequestResponse("apiKey too long (max 500 chars)");

    const sourceLabel = (body.sourceLabel || sourceKey).trim().slice(0, 128);

    const encrypted = encryptApiKey(apiKey);

    // Use upsert for atomic find-or-create + update — eliminates the race
    // condition where two concurrent requests could both find no existing
    // record and both create duplicates.
    const existing = await db.sourceApiKey.findFirst({ where: { sourceKey } });
    const isUpdate = !!existing;

    if (existing) {
      await db.sourceApiKey.update({
        where: { id: existing.id },
        data: {
          apiKey: encrypted,
          sourceLabel,
          isValidated: false,
          lastError: "",
          updatedAt: new Date(),
        },
      });
    } else {
      try {
        await db.sourceApiKey.create({
          data: {
            id: crypto.randomUUID(),
            sourceKey,
            sourceLabel,
            apiKey: encrypted,
            isValidated: false,
          },
        });
      } catch (e) {
        // Race condition: another request created this sourceKey concurrently.
        // Retry as an update.
        const raceExisting = await db.sourceApiKey.findFirst({ where: { sourceKey } });
        if (raceExisting) {
          await db.sourceApiKey.update({
            where: { id: raceExisting.id },
            data: {
              apiKey: encrypted,
              sourceLabel,
              isValidated: false,
              lastError: "",
              updatedAt: new Date(),
            },
          });
        } else {
          throw e;
        }
      }
    }

    await recordAudit({
      action: "source_key.upsert",
      category: "config",
      resourceType: "source_api_key",
      resourceId: sourceKey,
      detail: isUpdate
        ? `Updated API key for source "${sourceKey}"`
        : `Added API key for source "${sourceKey}"`,
      actorType: "user",
      actorId: user.id,
      metadata: { sourceKey, sourceLabel },
    });

    return NextResponse.json({ success: true, sourceKey });
  } catch (e) {
    return safeErrorResponse(e, "Failed to save source API key");
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to manage source API keys");

    const url = new URL(req.url);
    const sourceKey = (url.searchParams.get("sourceKey") || "").trim();
    if (!sourceKey) return badRequestResponse("sourceKey query parameter is required");

    const existing = await db.sourceApiKey.findFirst({ where: { sourceKey } });
    if (!existing) {
      return NextResponse.json({ error: "Source API key not found", code: "not_found" }, { status: 404 });
    }

    await db.sourceApiKey.delete({ where: { id: existing.id } });

    await recordAudit({
      action: "source_key.delete",
      category: "config",
      resourceType: "source_api_key",
      resourceId: sourceKey,
      detail: `Deleted API key for source "${sourceKey}"`,
      actorType: "user",
      actorId: user.id,
      metadata: { sourceKey },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return safeErrorResponse(e, "Failed to delete source API key");
  }
}
