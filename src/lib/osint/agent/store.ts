// Agent Store — persistence layer for autonomous investigations.
// Dual-layer: in-memory cache (fast polling) + Prisma/SQLite (survives restarts).
// Mirrors the pattern of the existing investigation store but for AgentState.
//
// Design:
// - Cache-first reads for sub-ms polling.
// - Async DB persistence (fire-and-forget) so polling stays fast.
// - State is serialized to JSON for DB storage (SQLite has no native JSON type).
// - 2s stale threshold: if a cached record is "running" and older than 2s, check DB.

import { db } from "@/lib/db";
import type { AutonomousInvestigation } from "@prisma/client";
import type { AgentState, AgentConfig } from "./types";
import { DEFAULT_AGENT_CONFIG } from "./types";
import { safeJsonParse } from "../safe-json";

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, AgentState>();

// =====================
// Serialization
// =====================

function serializeState(state: AgentState): {
  id: string;
  objective: string;
  target: string;
  inputType: string;
  configJson: string;
  stateJson: string;
  status: string;
  iterations: number;
  entitiesCount: number;
  evidenceCount: number;
  actionsCount: number;
  reportJson: string | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
  cacheExpiresAt: Date;
} {
  // Count actions from trace (entries with phase "executing")
  const actionsCount = state.trace.filter((t) => t.phase === "executing").length;
  return {
    id: state.id || "",
    objective: state.objective,
    target: state.target,
    inputType: state.inputType,
    configJson: JSON.stringify(state.config),
    stateJson: JSON.stringify(state),
    status: state.status,
    iterations: state.iteration,
    entitiesCount: state.discoveredEntities.length,
    evidenceCount: state.evidence.length,
    actionsCount,
    reportJson: state.report ? JSON.stringify(state.report) : null,
    error: state.error || null,
    createdAt: new Date(state.startedAt),
    completedAt: state.completedAt ? new Date(state.completedAt) : null,
    cacheExpiresAt: new Date(Date.now() + TTL_MS),
  };
}

function deserializeState(row: AutonomousInvestigation): AgentState {
  // The stateJson column contains the full AgentState.
  // But the id is the row id, so we override it.
  const parsed = safeJsonParse<Partial<AgentState>>(row.stateJson || "{}", {});
  const config = safeJsonParse<Partial<AgentConfig>>(row.configJson || "{}", {});
  const report = row.reportJson ? safeJsonParse(row.reportJson, null) : null;
  return {
    id: row.id,
    objective: parsed.objective || row.objective,
    target: parsed.target || row.target,
    inputType: (parsed.inputType || row.inputType) as AgentState["inputType"],
    config: { ...DEFAULT_AGENT_CONFIG, ...config, ...parsed.config },
    status: (parsed.status || row.status) as AgentState["status"],
    iteration: parsed.iteration ?? row.iterations ?? 0,
    discoveredEntities: parsed.discoveredEntities || [],
    evidence: parsed.evidence || [],
    frontier: parsed.frontier || [],
    visited: parsed.visited || [],
    trace: parsed.trace || [],
    startedAt: parsed.startedAt || row.createdAt.toISOString(),
    completedAt: parsed.completedAt || row.completedAt?.toISOString(),
    error: parsed.error || row.error || undefined,
    report: parsed.report ?? report,
    currentPhase: parsed.currentPhase || "idle",
    currentStrategy: parsed.currentStrategy,
  };
}

// =====================
// Public API
// =====================

/** Create a new agent investigation record. */
export function createAgentRecord(id: string, state: AgentState): void {
  const stateWithId = { ...state, id };
  cache.set(id, stateWithId);
  // Persist async
  db.autonomousInvestigation
    .upsert({
      where: { id },
      create: serializeState(stateWithId),
      update: serializeState(stateWithId),
    })
    .catch((e) => console.error("[agent-store] persist create failed", id, e instanceof Error ? e.message : String(e)));
}

/** Update the agent state (cache + async DB persist). Returns the updated state. */
export function updateAgentState(id: string, patch: Partial<AgentState>): AgentState | undefined {
  const existing = cache.get(id);
  if (!existing) {
    console.warn(`[agent-store] updateAgentState: no cached record for ${id}`);
    return undefined;
  }
  const updated: AgentState = { ...existing, ...patch, id };
  cache.set(id, updated);
  // Persist async
  db.autonomousInvestigation
    .upsert({
      where: { id },
      create: serializeState(updated),
      update: serializeState(updated),
    })
    .catch((e) => console.error("[agent-store] persist update failed", id, e instanceof Error ? e.message : String(e)));
  return updated;
}

/** Get the agent state. Cache-first, falls back to DB. */
export async function getAgentState(id: string): Promise<AgentState | undefined> {
  // 1. Check cache first
  const cached = cache.get(id);
  if (cached) {
    // If running and older than 2s, check DB for updates (handles dev-mode hot reloads)
    if (
      (cached.status === "running" || cached.status === "queued") &&
      Date.now() - new Date(cached.startedAt).getTime() > 2000
    ) {
      try {
        const row = await db.autonomousInvestigation.findUnique({ where: { id } });
        if (row && row.status !== cached.status) {
          const rec = deserializeState(row);
          cache.set(id, rec);
          return rec;
        }
        // Check if iteration has advanced
        if (row && row.iterations > cached.iteration) {
          const rec = deserializeState(row);
          cache.set(id, rec);
          return rec;
        }
      } catch (e) {
        console.error("[agent-store] DB getAgentState failed for", id, e instanceof Error ? e.message : String(e));
      }
    }
    return cached;
  }

  // 2. Fall back to DB
  try {
    const row = await db.autonomousInvestigation.findUnique({ where: { id } });
    if (row) {
      const rec = deserializeState(row);
      cache.set(id, rec);
      return rec;
    }
  } catch (e) {
    console.error("[agent-store] db getAgentState failed", id, e instanceof Error ? e.message : String(e));
  }
  return undefined;
}

/** List recent autonomous investigations (metadata only, no full state). */
export async function listRecentAgentInvestigations(limit = 12): Promise<{
  id: string;
  objective: string;
  target: string;
  inputType: string;
  status: string;
  iterations: number;
  entitiesCount: number;
  evidenceCount: number;
  createdAt: string;
  completedAt: string | null;
}[]> {
  try {
    const rows = await db.autonomousInvestigation.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        objective: true,
        target: true,
        inputType: true,
        status: true,
        iterations: true,
        entitiesCount: true,
        evidenceCount: true,
        createdAt: true,
        completedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      objective: r.objective,
      target: r.target,
      inputType: r.inputType,
      status: r.status,
      iterations: r.iterations,
      entitiesCount: r.entitiesCount,
      evidenceCount: r.evidenceCount,
      createdAt: r.createdAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    }));
  } catch (e) {
    console.error("[agent-store] listRecent failed", e instanceof Error ? e.message : String(e));
    return [];
  }
}

/** Delete an agent investigation. */
export async function deleteAgentInvestigation(id: string): Promise<boolean> {
  cache.delete(id);
  try {
    await db.autonomousInvestigation.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

// Periodic cache cleanup (removes expired entries)
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
  }, 5 * 60 * 1000); // Every 5 minutes
  // Allow the process to exit even if the interval is running
  if (interval.unref) interval.unref();
}
scheduleCleanup();
