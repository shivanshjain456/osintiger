// Discovery Session Store — persistence layer for recursive discovery sessions.
// Dual-layer: in-memory cache (fast polling) + Prisma/SQLite (survives restarts).
// Mirrors the pattern of the agent store but for DiscoveryState.

import { db } from "@/lib/db";
import type { DiscoverySession } from "@prisma/client";
import type { DiscoveryState, DiscoveryConfig } from "./discovery-types";
import { DEFAULT_DISCOVERY_CONFIG } from "./discovery-types";
import { safeJsonParse } from "../safe-json";

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, DiscoveryState>();

// =====================
// Serialization
// =====================

function serializeState(state: DiscoveryState): {
  id: string;
  rootTarget: string;
  rootType: string;
  configJson: string;
  stateJson: string;
  status: string;
  entitiesCount: number;
  expandedCount: number;
  maxDepthReached: number;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
  cacheExpiresAt: Date;
} {
  const maxDepthReached = state.allEntities.reduce((max, e) => Math.max(max, e.depth), 0);
  return {
    id: state.id || "",
    rootTarget: state.rootTarget,
    rootType: state.rootType,
    configJson: JSON.stringify(state.config),
    stateJson: JSON.stringify(state),
    status: state.status,
    entitiesCount: state.allEntities.length,
    expandedCount: state.expandedEntityIds.length,
    maxDepthReached,
    error: state.error || null,
    createdAt: new Date(state.startedAt),
    completedAt: state.completedAt ? new Date(state.completedAt) : null,
    cacheExpiresAt: new Date(Date.now() + TTL_MS),
  };
}

function deserializeState(row: DiscoverySession): DiscoveryState {
  const parsed = safeJsonParse<Partial<DiscoveryState>>(row.stateJson || "{}", {});
  const config = safeJsonParse<Partial<DiscoveryConfig>>(row.configJson || "{}", {});
  return {
    id: row.id,
    rootTarget: parsed.rootTarget || row.rootTarget,
    rootType: (parsed.rootType || row.rootType) as DiscoveryState["rootType"],
    config: { ...DEFAULT_DISCOVERY_CONFIG, ...config, ...parsed.config },
    status: (parsed.status || row.status) as DiscoveryState["status"],
    tree: parsed.tree || null,
    allEntities: parsed.allEntities || [],
    expandedEntityIds: parsed.expandedEntityIds || [],
    trace: parsed.trace || [],
    startedAt: parsed.startedAt || row.createdAt.toISOString(),
    completedAt: parsed.completedAt || row.completedAt?.toISOString(),
    error: parsed.error || row.error || undefined,
    currentPhase: parsed.currentPhase || "idle",
    currentlyExpanding: parsed.currentlyExpanding,
  };
}

// =====================
// Public API
// =====================

export function createDiscoveryRecord(id: string, state: DiscoveryState): void {
  const stateWithId = { ...state, id };
  cache.set(id, stateWithId);
  db.discoverySession
    .upsert({
      where: { id },
      create: serializeState(stateWithId),
      update: serializeState(stateWithId),
    })
    .catch((e) => console.error("[discovery-store] persist create failed", id, e instanceof Error ? e.message : String(e)));
}

export function updateDiscoveryState(id: string, patch: Partial<DiscoveryState>): DiscoveryState | undefined {
  const existing = cache.get(id);
  if (!existing) {
    console.warn(`[discovery-store] updateDiscoveryState: no cached record for ${id}`);
    return undefined;
  }
  const updated: DiscoveryState = { ...existing, ...patch, id };
  cache.set(id, updated);
  db.discoverySession
    .upsert({
      where: { id },
      create: serializeState(updated),
      update: serializeState(updated),
    })
    .catch((e) => console.error("[discovery-store] persist update failed", id, e instanceof Error ? e.message : String(e)));
  return updated;
}

export async function getDiscoveryState(id: string): Promise<DiscoveryState | undefined> {
  const cached = cache.get(id);
  if (cached) {
    if (
      (cached.status === "running" || cached.status === "queued") &&
      Date.now() - new Date(cached.startedAt).getTime() > 2000
    ) {
      try {
        const row = await db.discoverySession.findUnique({ where: { id } });
        if (row && row.status !== cached.status) {
          const rec = deserializeState(row);
          cache.set(id, rec);
          return rec;
        }
        if (row && row.expandedCount > cached.expandedEntityIds.length) {
          const rec = deserializeState(row);
          cache.set(id, rec);
          return rec;
        }
      } catch (e) {
        console.error("[discovery-store] DB getDiscoveryState failed for", id, e instanceof Error ? e.message : String(e));
      }
    }
    return cached;
  }

  try {
    const row = await db.discoverySession.findUnique({ where: { id } });
    if (row) {
      const rec = deserializeState(row);
      cache.set(id, rec);
      return rec;
    }
  } catch (e) {
    console.error("[discovery-store] db getDiscoveryState failed", id, e instanceof Error ? e.message : String(e));
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
