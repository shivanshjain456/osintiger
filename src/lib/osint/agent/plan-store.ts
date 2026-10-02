// Plan Session Store — persistence layer for AI-planned investigations.
// Dual-layer: in-memory cache (fast polling) + Prisma/SQLite (survives restarts).

import { db } from "@/lib/db";
import type { PlanSession } from "@prisma/client";
import type { PlanState, PlanConfig } from "./plan-types";
import { DEFAULT_PLAN_CONFIG } from "./plan-types";
import { safeJsonParse } from "../safe-json";

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, PlanState>();

function serializeState(state: PlanState): {
  id: string;
  objective: string;
  target: string;
  inputType: string;
  configJson: string;
  stateJson: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  evidenceCount: number;
  entityCount: number;
  reportJson: string | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
  cacheExpiresAt: Date;
} {
  return {
    id: state.id || "",
    objective: state.objective,
    target: state.target,
    inputType: state.inputType,
    configJson: JSON.stringify(state.config),
    stateJson: JSON.stringify(state),
    status: state.status,
    currentStep: state.currentStep,
    totalSteps: state.plan?.steps.length || 0,
    evidenceCount: state.evidence.length,
    entityCount: state.discoveredEntities.length,
    reportJson: state.report ? JSON.stringify(state.report) : null,
    error: state.error || null,
    createdAt: new Date(state.startedAt),
    completedAt: state.completedAt ? new Date(state.completedAt) : null,
    cacheExpiresAt: new Date(Date.now() + TTL_MS),
  };
}

function deserializeState(row: PlanSession): PlanState {
  const parsed = safeJsonParse<Partial<PlanState>>(row.stateJson || "{}", {});
  const config = safeJsonParse<Partial<PlanConfig>>(row.configJson || "{}", {});
  const report = row.reportJson ? safeJsonParse(row.reportJson, null) : null;
  return {
    id: row.id,
    objective: parsed.objective || row.objective,
    target: parsed.target || row.target,
    inputType: (parsed.inputType || row.inputType) as PlanState["inputType"],
    config: { ...DEFAULT_PLAN_CONFIG, ...config, ...parsed.config },
    status: (parsed.status || row.status) as PlanState["status"],
    plan: parsed.plan || null,
    currentStep: parsed.currentStep ?? row.currentStep ?? 0,
    evidence: parsed.evidence || [],
    discoveredEntities: parsed.discoveredEntities || [],
    findings: parsed.findings || [],
    startedAt: parsed.startedAt || row.createdAt.toISOString(),
    completedAt: parsed.completedAt || row.completedAt?.toISOString(),
    error: parsed.error || row.error || undefined,
    report: parsed.report ?? report,
    planningNotes: parsed.planningNotes || "",
  };
}

export function createPlanRecord(id: string, state: PlanState): void {
  const stateWithId = { ...state, id };
  cache.set(id, stateWithId);
  db.planSession
    .upsert({
      where: { id },
      create: serializeState(stateWithId),
      update: serializeState(stateWithId),
    })
    .catch((e) => console.error("[plan-store] persist create failed", id, e instanceof Error ? e.message : String(e)));
}

export function updatePlanState(id: string, patch: Partial<PlanState>): PlanState | undefined {
  const existing = cache.get(id);
  if (!existing) {
    console.warn(`[plan-store] updatePlanState: no cached record for ${id}`);
    return undefined;
  }
  const updated: PlanState = { ...existing, ...patch, id };
  cache.set(id, updated);
  db.planSession
    .upsert({
      where: { id },
      create: serializeState(updated),
      update: serializeState(updated),
    })
    .catch((e) => console.error("[plan-store] persist update failed", id, e instanceof Error ? e.message : String(e)));
  return updated;
}

export async function getPlanState(id: string): Promise<PlanState | undefined> {
  const cached = cache.get(id);
  if (cached) {
    if (
      (cached.status === "planning" || cached.status === "executing") &&
      Date.now() - new Date(cached.startedAt).getTime() > 2000
    ) {
      try {
        const row = await db.planSession.findUnique({ where: { id } });
        if (row && row.status !== cached.status) {
          const rec = deserializeState(row);
          cache.set(id, rec);
          return rec;
        }
        if (row && row.currentStep > cached.currentStep) {
          const rec = deserializeState(row);
          cache.set(id, rec);
          return rec;
        }
      } catch (e) {
        console.error("[plan-store] DB getPlanState failed for", id, e instanceof Error ? e.message : String(e));
      }
    }
    return cached;
  }

  try {
    const row = await db.planSession.findUnique({ where: { id } });
    if (row) {
      const rec = deserializeState(row);
      cache.set(id, rec);
      return rec;
    }
  } catch (e) {
    console.error("[plan-store] db getPlanState failed", id, e instanceof Error ? e.message : String(e));
  }
  return undefined;
}

// Periodic cache cleanup
let cleanupScheduled = false;
function scheduleCleanup(): void {
  if (cleanupScheduled) return;
  cleanupScheduled = true;
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [id, rec] of cache.entries()) {
      if (now - new Date(rec.startedAt).getTime() > TTL_MS) {
        cache.delete(id);
      }
    }
  }, 5 * 60 * 1000);
  if (interval.unref) interval.unref();
}
scheduleCleanup();
