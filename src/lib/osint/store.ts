// Investigation job store with 24h TTL.
// Dual-layer: in-memory cache (fast polling) + Prisma/SQLite persistence (survives restarts).
// Used by the polling pattern: POST /api/investigate creates a job and fires the
// pipeline in the background; GET /api/investigate/[id] polls status.

import type { InvestigationRecord } from "./types";
import { db } from "@/lib/db";
import { safeJsonStringArray, safeJsonObject, safeJsonParse } from "./safe-json";

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, InvestigationRecord>();

// Serialize/deserialize helpers for Prisma JSON-string columns
function serialize(rec: InvestigationRecord) {
  return {
    id: rec.id,
    target: rec.target,
    inputType: rec.input_type,
    language: rec.language,
    script: rec.script,
    modules: JSON.stringify(rec.modules),
    status: rec.status,
    createdAt: new Date(rec.created_at),
    completedAt: rec.completed_at ? new Date(rec.completed_at) : null,
    currentStep: rec.current_step,
    totalSteps: rec.total_steps,
    stepsJson: JSON.stringify(rec.steps),
    sourceResults: JSON.stringify(rec.source_results),
    reportJson: rec.report ? JSON.stringify(rec.report) : null,
    error: rec.error || null,
    cacheExpiresAt: new Date(rec.cache_expires_at),
    starred: rec.starred ?? false,
    tags: JSON.stringify(rec.tags || []),
    notes: rec.notes || "",
    bookmarkedFindings: JSON.stringify(rec.bookmarked_findings || []),
    findingAnnotations: JSON.stringify(rec.finding_annotations || {}),
  };
}

function deserialize(row: NonNullable<Awaited<ReturnType<typeof db.investigation.findUnique>>>): InvestigationRecord {
  return {
    id: row.id,
    target: row.target,
    input_type: row.inputType,
    language: row.language,
    script: row.script,
    modules: safeJsonStringArray(row.modules),
    status: row.status as InvestigationRecord["status"],
    created_at: row.createdAt.toISOString(),
    completed_at: row.completedAt?.toISOString(),
    current_step: row.currentStep,
    total_steps: row.totalSteps,
    steps: safeJsonParse(row.stepsJson || "[]", []),
    source_results: safeJsonParse(row.sourceResults || "[]", []),
    report: row.reportJson ? safeJsonParse(row.reportJson, null) : null,
    error: row.error || undefined,
    cache_expires_at: row.cacheExpiresAt.toISOString(),
    starred: row.starred,
    tags: safeJsonStringArray(row.tags),
    notes: row.notes || "",
    bookmarked_findings: safeJsonParse<unknown[]>(row.bookmarkedFindings || "[]", []).filter((v): v is number => typeof v === "number"),
    finding_annotations: safeJsonObject(row.findingAnnotations) as Record<number, string>,
  };
}

export function createRecord(record: InvestigationRecord): void {
  cache.set(record.id, record);
  // Persist async (fire-and-forget) so polling stays fast
  db.investigation
    .upsert({
      where: { id: record.id },
      create: serialize(record),
      update: serialize(record),
    })
    .catch((e) => console.error("[store] persist create failed", e));
  scheduleCleanup();
}

export function updateRecord(
  id: string,
  patch: Partial<InvestigationRecord>
): InvestigationRecord | undefined {
  const existing = cache.get(id);
  if (!existing) return undefined;
  const updated: InvestigationRecord = { ...existing, ...patch };
  cache.set(id, updated);
  // Persist async
  db.investigation
    .upsert({
      where: { id },
      create: serialize(updated),
      update: serialize(updated),
    })
    .catch((e) => console.error("[store] persist update failed", e));
  return updated;
}

export async function getRecord(id: string): Promise<InvestigationRecord | undefined> {
  // 1. Check memory cache first
  const cached = cache.get(id);
  if (cached) {
    // If the cached record is still queued/in_progress, check the DB for updates.
    // The pipeline runs in a fire-and-forget async context which may update the DB
    // before the cache is updated (especially across request boundaries in dev mode).
    // Use a short 2s threshold to catch quick transitions without excessive DB queries.
    if (
      (cached.status === "in_progress" || cached.status === "queued") &&
      Date.now() - new Date(cached.created_at).getTime() > 2000
    ) {
      try {
        const row = await db.investigation.findUnique({ where: { id } });
        if (row && row.status !== cached.status) {
          const rec = deserialize(row);
          cache.set(id, rec);
          return rec;
        }
        // Also check if current_step has advanced (pipeline is making progress)
        if (row && row.currentStep > cached.current_step) {
          const rec = deserialize(row);
          cache.set(id, rec);
          return rec;
        }
      } catch (e) {
        console.error("[store] DB getRecord failed for", id, e instanceof Error ? e.message : String(e));
      }
    }
    return cached;
  }
  // 2. Fall back to DB (handles server restart / cross-request)
  try {
    const row = await db.investigation.findUnique({ where: { id } });
    if (row) {
      const rec = deserialize(row);
      cache.set(id, rec);
      return rec;
    }
  } catch (e) {
    console.error("[store] db getRecord failed", e);
  }
  return undefined;
}

// Synchronous cache-only getter (for pipeline internal use where we already have the rec)
export function getRecordSync(id: string): InvestigationRecord | undefined {
  return cache.get(id);
}

export async function deleteRecord(id: string): Promise<boolean> {
  const existed = cache.has(id);
  cache.delete(id);
  try {
    // Delete provenance events AND the investigation atomically.
    // KB records are intentionally retained (they persist across investigation deletion).
    await db.$transaction([
      db.provenanceEvent.deleteMany({ where: { investigationId: id } }),
      db.investigation.delete({ where: { id } }),
    ]);
    return true;
  } catch (e) {
    // Prisma throws if record doesn't exist
    return existed;
  }
}

// Patch user metadata (starred, tags, notes, bookmarked_findings, finding_annotations) — does NOT touch report/source data.
export async function patchMetadata(
  id: string,
  patch: {
    starred?: boolean;
    tags?: string[];
    notes?: string;
    bookmarked_findings?: number[];
    finding_annotations?: Record<number, string>;
  }
): Promise<InvestigationRecord | undefined> {
  const data: Record<string, unknown> = {};
  if (patch.starred !== undefined) data.starred = patch.starred;
  if (patch.tags !== undefined) data.tags = JSON.stringify(patch.tags);
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.bookmarked_findings !== undefined) data.bookmarkedFindings = JSON.stringify(patch.bookmarked_findings);
  if (patch.finding_annotations !== undefined) data.findingAnnotations = JSON.stringify(patch.finding_annotations);
  if (Object.keys(data).length === 0) return getRecordSync(id);
  try {
    const row = await db.investigation.update({ where: { id }, data });
    const rec = deserialize(row);
    cache.set(id, rec);
    return rec;
  } catch (e) {
    console.error("[store] patchMetadata failed", id, e instanceof Error ? e.message : String(e));
    return undefined;
  }
}

export async function listRecent(limit = 12): Promise<InvestigationRecord[]> {
  const now = Date.now();
  // Merge cache + DB. DB is source of truth for metadata (starred/tags/notes),
  // so DB rows OVERWRITE cached entries to avoid stale metadata.
  const merged = new Map<string, InvestigationRecord>();
  for (const rec of cache.values()) {
    if (now - new Date(rec.created_at).getTime() < TTL_MS) {
      merged.set(rec.id, rec);
    }
  }
  try {
    const rows = await db.investigation.findMany({
      where: { createdAt: { gte: new Date(now - TTL_MS) } },
      orderBy: { createdAt: "desc" },
      take: limit * 2,
    });
    for (const row of rows) {
      const rec = deserialize(row);
      // DB row overwrites cache to ensure fresh metadata
      merged.set(rec.id, rec);
    }
  } catch (e) {
    console.error("[store] db listRecent failed", e);
  }
  const all = [...merged.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return all.slice(0, limit);
}

let cleanupTimer: NodeJS.Timeout | null = null;
function scheduleCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(
    () => {
      const now = Date.now();
      for (const [id, rec] of cache.entries()) {
        if (now - new Date(rec.created_at).getTime() > TTL_MS) {
          cache.delete(id);
        }
      }
    },
    10 * 60 * 1000
  );
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref();
}

// ─── Lightweight metadata list (for /api/recent) ─────────────────────────────
// Avoids fetching + parsing the heavy stepsJson and sourceResults columns.
// Only fetches the columns needed for the investigations list view and
// extracts just 4 fields from reportJson via targeted JSON.parse.

export interface RecentMetadata {
  id: string;
  target: string;
  input_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  confidence: number | null;
  key_findings_count: number;
  sources_count: number;
  needs_review: boolean;
  starred: boolean;
  tags: string[];
  notes: string;
  bookmarked_findings: number[];
  finding_annotations: Record<number, string>;
}

function extractReportMeta(reportJson: string | null): {
  confidence: number | null;
  keyFindingsCount: number;
  sourcesCount: number;
  needsReview: boolean;
} {
  if (!reportJson) return { confidence: null, keyFindingsCount: 0, sourcesCount: 0, needsReview: false };
  try {
    const r = JSON.parse(reportJson) as {
      confidence_score?: number;
      key_findings?: unknown[];
      sources_consulted?: unknown[];
      needs_manual_review?: boolean;
    };
    return {
      confidence: r.confidence_score ?? null,
      keyFindingsCount: r.key_findings?.length ?? 0,
      sourcesCount: r.sources_consulted?.length ?? 0,
      needsReview: r.needs_manual_review ?? false,
    };
  } catch {
    return { confidence: null, keyFindingsCount: 0, sourcesCount: 0, needsReview: false };
  }
}

export async function listRecentMetadata(limit = 50): Promise<RecentMetadata[]> {
  const now = Date.now();
  const rows = await db.investigation.findMany({
    where: { createdAt: { gte: new Date(now - TTL_MS) } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      target: true,
      inputType: true,
      status: true,
      createdAt: true,
      completedAt: true,
      reportJson: true,
      starred: true,
      tags: true,
      notes: true,
      bookmarkedFindings: true,
      findingAnnotations: true,
      // Explicitly EXCLUDE: stepsJson, sourceResults, modules, language, script,
      // currentStep, totalSteps, error, cacheExpiresAt — not needed for the list view.
    },
  });

  return rows.map((row) => {
    const meta = extractReportMeta(row.reportJson);
    return {
      id: row.id,
      target: row.target,
      input_type: row.inputType,
      status: row.status,
      created_at: row.createdAt.toISOString(),
      completed_at: row.completedAt?.toISOString() ?? null,
      confidence: meta.confidence,
      key_findings_count: meta.keyFindingsCount,
      sources_count: meta.sourcesCount,
      needs_review: meta.needsReview,
      starred: row.starred,
      tags: safeJsonStringArray(row.tags),
      notes: row.notes || "",
      bookmarked_findings: safeJsonParse<unknown[]>(row.bookmarkedFindings || "[]", []).filter(
        (v): v is number => typeof v === "number"
      ),
      finding_annotations: safeJsonObject(row.findingAnnotations) as Record<number, string>,
    };
  });
}
