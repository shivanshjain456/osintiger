// GET    /api/collections/[id] — get a collection + its items.
// DELETE /api/collections/[id] — delete a collection and its items.
//
// Security: All operations require authentication.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/osint/audit";
import { safeErrorResponse, unauthorizedResponse, notFoundResponse } from "@/lib/osint/safe-error";
import { getSessionUser } from "@/lib/auth";
import { apiGet, apiDelete } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse("Sign in to view collections");
  const { id } = await params;

  const collection = await db.collection.findUnique({ where: { id } });
  if (!collection) return notFoundResponse("collection");

  const items = await db.collectionItem.findMany({
    where: { collectionId: id },
    orderBy: { addedAt: "desc" },
    select: {
      id: true,
      itemType: true,
      itemId: true,
      note: true,
      addedAt: true,
    },
  });

  return NextResponse.json({ collection, items });
});

export const DELETE = apiDelete(async (_req, { params }) => {
  const user = await getSessionUser();
  if (!user) return unauthorizedResponse("Sign in to delete collections");
  const { id } = await params;

  // Delete items AND collection atomically — if either fails, both roll back.
  await db.$transaction([
    db.collectionItem.deleteMany({ where: { collectionId: id } }),
    db.collection.delete({ where: { id } }),
  ]);

  await recordAudit({
    action: "collection.delete",
    category: "data",
    resourceType: "collection",
    resourceId: id,
    detail: "Deleted collection and its items",
    actorType: "user",
    actorId: user.id,
  });

  return NextResponse.json({ success: true });
});
