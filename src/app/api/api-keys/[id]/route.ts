// DELETE /api/api-keys/[id] — revoke an API key.
//
// Deletes the key row if it belongs to the signed-in user. Returns 404 if
// the key does not exist or belongs to another user. The hashed key is
// never returned; we just confirm the deletion.
//
// Auth: required. 401 if not signed in.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { recordAudit } from "@/lib/osint/audit";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to manage API keys" },
      { status: 401 }
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "key id is required" }, { status: 400 });
  }

  try {
    // Find the key scoped to the current user — never allow deleting another
    // user's key (scoped lookup returns null if userId doesn't match).
    const existing = await db.apiKey.findFirst({
      where: { id, userId: user.id },
      select: { id: true, name: true, keyPrefix: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "API key not found" },
        { status: 404 }
      );
    }

    await db.apiKey.delete({ where: { id: existing.id } });

    // Fire-and-forget audit entry.
    recordAudit({
      action: "api_key.delete",
      category: "config",
      actorType: "user",
      actorId: user.id,
      resourceType: "api_key",
      resourceId: existing.id,
      detail: `Revoked API key "${existing.name}" (${existing.keyPrefix}…)`,
      metadata: { name: existing.name },
      severity: "warning",
      outcome: "success",
    }).catch(() => { /* audit never throws */ });

    return NextResponse.json({ success: true, id: existing.id }, { status: 200 });
  } catch (e) {
    return safeErrorResponse(e, "Failed to revoke API key", 500);
  }
}
