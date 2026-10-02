// POST /api/import — best-effort import of an exported archive.
// Currently supports importing Investigation records (skip on conflict).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/osint/audit";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImportInvestigation {
  id?: string;
  target?: string;
  input_type?: string;
  inputType?: string;
  language?: string;
  script?: string;
  modules?: unknown;
  status?: string;
  createdAt?: string;
  completedAt?: string | null;
  cacheExpiresAt?: string;
  reportJson?: unknown;
  sourceResults?: unknown;
  stepsJson?: unknown;
  error?: string;
  starred?: boolean;
  tags?: unknown;
  notes?: string;
  bookmarkedFindings?: unknown;
  findingAnnotations?: unknown;
}

export async function POST(req: Request) {
  let body: { investigations?: ImportInvestigation[] };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || !Array.isArray(body.investigations)) {
    return NextResponse.json(
      { error: "Expected { investigations: [...] }" },
      { status: 400 }
    );
  }

  let imported = 0;
  let skipped = 0;

  for (const inv of body.investigations) {
    try {
      // Minimal validation
      const target = (inv.target || "").toString().trim();
      if (!target) {
        skipped++;
        continue;
      }

      const id = (inv.id || crypto.randomUUID()).toString();
      const inputType = (inv.input_type || inv.inputType || "domain")
        .toString()
        .slice(0, 64);
      const language = (inv.language || "en").toString().slice(0, 16);
      const script = (inv.script || "Latn").toString().slice(0, 16);
      const status = (inv.status || "completed").toString().slice(0, 32);

      const createdAt = inv.createdAt ? new Date(inv.createdAt) : new Date();
      const completedAt = inv.completedAt ? new Date(inv.completedAt) : null;
      const cacheExpiresAt = inv.cacheExpiresAt
        ? new Date(inv.cacheExpiresAt)
        : new Date(Date.now() + 24 * 60 * 60 * 1000);

      const modules = typeof inv.modules === "string" ? inv.modules : JSON.stringify(inv.modules ?? []);
      const reportJson = typeof inv.reportJson === "string" ? inv.reportJson : JSON.stringify(inv.reportJson ?? null);
      const sourceResults = typeof inv.sourceResults === "string" ? inv.sourceResults : JSON.stringify(inv.sourceResults ?? []);
      const stepsJson = typeof inv.stepsJson === "string" ? inv.stepsJson : JSON.stringify(inv.stepsJson ?? []);
      const tags = typeof inv.tags === "string" ? inv.tags : JSON.stringify(inv.tags ?? []);
      const bookmarkedFindings =
        typeof inv.bookmarkedFindings === "string"
          ? inv.bookmarkedFindings
          : JSON.stringify(inv.bookmarkedFindings ?? []);
      const findingAnnotations =
        typeof inv.findingAnnotations === "string"
          ? inv.findingAnnotations
          : JSON.stringify(inv.findingAnnotations ?? {});

      // Skip on conflict — check by id first
      const existing = await db.investigation.findUnique({ where: { id } });
      if (existing) {
        skipped++;
        continue;
      }

      await db.investigation.create({
        data: {
          id,
          target,
          inputType,
          language,
          script,
          modules,
          status,
          createdAt,
          completedAt,
          cacheExpiresAt,
          reportJson,
          sourceResults,
          stepsJson,
          error: (inv.error || "").toString().slice(0, 1000),
          starred: Boolean(inv.starred),
          tags,
          notes: (inv.notes || "").toString(),
          bookmarkedFindings,
          findingAnnotations,
        },
      });
      imported++;
    } catch {
      // Per-item defensive: skip on any error (e.g. constraint, bad shape)
      skipped++;
    }
  }

  await recordAudit({
    action: "import.run",
    category: "data",
    resourceType: "investigation",
    detail: `Imported ${imported} investigation(s), skipped ${skipped}`,
    actorType: "user",
    metadata: { imported, skipped },
  });

  return NextResponse.json({ success: true, imported, skipped });
}
