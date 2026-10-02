// GET  /api/collections — list all collections (pinned first, then by updatedAt desc).
// POST /api/collections — create a new collection.
//
// Security: All operations require authentication.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/osint/audit";
import { safeErrorResponse, unauthorizedResponse, badRequestResponse } from "@/lib/osint/safe-error";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to view collections");
    const collections = await db.collection.findMany({
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        icon: true,
        type: true,
        itemCount: true,
        isPinned: true,
        isShared: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ collections });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch collections");
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorizedResponse("Sign in to create collections");

    let body: {
      name?: string;
      description?: string;
      color?: string;
      icon?: string;
      type?: string;
    };
    try {
      body = await req.json();
    } catch {
      return badRequestResponse("Invalid JSON body");
    }

    const name = (body.name || "").trim();
    if (!name) return badRequestResponse("name is required");
    if (name.length > 200) return badRequestResponse("name too long (max 200)");

    const description = (body.description || "").trim().slice(0, 2000);
    const color = (body.color || "").trim().slice(0, 32);
    const icon = (body.icon || "Folder").trim().slice(0, 64);
    const type = (body.type || "manual").trim().slice(0, 32);

    const id = crypto.randomUUID();
    const collection = await db.collection.create({
      data: { id, name, description, color, icon, type },
    });

    await recordAudit({
      action: "collection.create",
      category: "data",
      resourceType: "collection",
      resourceId: id,
      detail: `Created collection "${name}"`,
      actorType: "user",
      actorId: user.id,
      metadata: { name, type },
    });

    return NextResponse.json({ collection }, { status: 201 });
  } catch (e) {
    return safeErrorResponse(e, "Failed to create collection");
  }
}
