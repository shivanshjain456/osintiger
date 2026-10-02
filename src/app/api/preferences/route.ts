// GET  /api/preferences?clientId=<id> — get all preferences for a client.
// POST /api/preferences — upsert a preference by (clientId, key).
//
// Security: Requires authentication. The clientId should match the authenticated
// user's ID — if it doesn't, the user's own ID is used instead, preventing
// cross-user preference access.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeErrorResponse, unauthorizedResponse, badRequestResponse } from "@/lib/osint/safe-error";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to view preferences");

    const url = new URL(req.url);
    const requestedClientId = (url.searchParams.get("clientId") || "").trim();
    // Security: always use the authenticated user's ID as the clientId,
    // ignoring any client-supplied value. This prevents cross-user access.
    const clientId = user.id;

    const rows = await db.userPreference.findMany({
      where: { clientId },
      select: { key: true, value: true },
    });

    const prefs: Record<string, string> = {};
    for (const row of rows) prefs[row.key] = row.value;

    return NextResponse.json({ prefs, clientId });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch preferences");
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to save preferences");

    let body: { key?: string; value?: string };
    try {
      body = await req.json();
    } catch {
      return badRequestResponse("Invalid JSON body");
    }

    // Security: always use the authenticated user's ID as the clientId.
    const clientId = user.id;
    const key = (body.key || "").trim();
    const value = (body.value ?? "").toString();

    if (!key) return badRequestResponse("key is required");
    if (key.length > 128) return badRequestResponse("key too long");
    if (value.length > 4000) return badRequestResponse("value too long (max 4000)");

    const existing = await db.userPreference.findUnique({
      where: { clientId_key: { clientId, key } },
    });

    if (existing) {
      await db.userPreference.update({
        where: { id: existing.id },
        data: { value, updatedAt: new Date() },
      });
    } else {
      await db.userPreference.create({
        data: {
          id: crypto.randomUUID(),
          clientId,
          key,
          value,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return safeErrorResponse(e, "Failed to save preference");
  }
}
