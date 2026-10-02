// Live Monitoring Engine — domain models, store, and change detection service.
// Continuously monitors 7 source categories and generates alerts on material changes:
// 1. News — GDELT, Google News, Wikinews
// 2. DNS — DoH, Google DNS
// 3. WHOIS — OpenRDAP
// 4. Certificates — crt.sh
// 5. GitHub — GitHub API
// 6. Leaks — Threat intel sources
// 7. Security advisories — NVD, CISA KEV
//
// The system takes snapshots, compares them, and generates alerts for:
// additions, removals, modifications, and new discoveries.

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { MonitorSession } from "@prisma/client";
import type { DetectionResult, SourceResult, NormalizedFinding } from "./types";
import { safeJsonParse } from "./safe-json";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";
import { detectInput } from "./detector";
import { routeSources, type SourceKey, SOURCE_LABELS } from "./router";
import { runSource } from "./source-runner";

// =====================
// Types
// =====================

export type MonitorCategory = "news" | "dns" | "whois" | "certificates" | "github" | "leaks" | "security_advisories";

export type ChangeType = "addition" | "removal" | "modification" | "new_discovery";

export type AlertSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface MonitorConfig {
  categories: MonitorCategory[];
  intervalSeconds: number;
  maxSnapshots: number;
  alertThreshold: AlertSeverity;
}

export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  categories: ["news", "dns", "whois", "certificates", "github", "leaks", "security_advisories"],
  intervalSeconds: 300,
  maxSnapshots: 10,
  alertThreshold: "low",
};

export interface SnapshotEntry {
  data: string;
  source: string;
  sourceLabel: string;
  confidence: number;
  timestamp: string;
}

export interface MonitorSnapshot {
  id: string;
  timestamp: string;
  category: MonitorCategory;
  entries: SnapshotEntry[];
  entryCount: number;
}

export interface ChangeAlert {
  id: string;
  timestamp: string;
  category: MonitorCategory;
  changeType: ChangeType;
  severity: AlertSeverity;
  entity: string;
  source: string;
  sourceLabel: string;
  previousState: string;
  currentState: string;
  confidence: number;
  significance: string;
  relatedEntities: string[];
}

export interface MonitorState {
  id?: string;
  target: string;
  inputType: string;
  config: MonitorConfig;
  status: "active" | "paused" | "stopped";
  snapshots: MonitorSnapshot[];
  alerts: ChangeAlert[];
  baselineSnapshotIds: string[];
  lastScanAt: string | null;
  startedAt: string;
  error?: string;
}

export interface MonitorStartResponse {
  monitor_id: string;
  status: string;
  target: string;
  config: MonitorConfig;
}

export interface MonitorPollResponse {
  monitor_id: string;
  status: string;
  target: string;
  config: MonitorConfig;
  snapshots: MonitorSnapshot[];
  alerts: ChangeAlert[];
  last_scan_at: string | null;
  started_at: string;
  error?: string;
  stats: {
    total_snapshots: number;
    total_alerts: number;
    alerts_by_severity: Record<AlertSeverity, number>;
    alerts_by_category: Record<string, number>;
    elapsed_seconds: number;
  };
}

// =====================
// Category to Source Mapping
// =====================

const CATEGORY_SOURCES: Record<MonitorCategory, SourceKey[]> = {
  news: ["gdelt", "googlenews", "wikinews", "hackernews"],
  dns: ["doh", "dns_google", "ipinfo"],
  whois: ["openrdap"],
  certificates: ["crtsh"],
  github: ["github", "gitlab"],
  leaks: ["otx", "threatfox", "urlhaus", "malwarebazaar"],
  security_advisories: ["nvd", "cisa_kev", "shodan_cvedb", "epss"],
};

// =====================
// Store
// =====================

const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, MonitorState>();

function serialize(state: MonitorState) {
  return {
    id: state.id || "",
    target: state.target,
    inputType: state.inputType,
    configJson: JSON.stringify(state.config),
    stateJson: JSON.stringify(state),
    status: state.status,
    snapshotCount: state.snapshots.length,
    alertCount: state.alerts.length,
    lastScanAt: state.lastScanAt ? new Date(state.lastScanAt) : null,
    error: state.error || null,
    createdAt: new Date(state.startedAt),
    cacheExpiresAt: new Date(Date.now() + TTL_MS),
  };
}

function deserialize(row: MonitorSession): MonitorState {
  const parsed = safeJsonParse<Partial<MonitorState>>(row.stateJson || "{}", {});
  const config = safeJsonParse<Partial<MonitorConfig>>(row.configJson || "{}", {});
  return {
    id: row.id,
    target: parsed.target || row.target,
    inputType: parsed.inputType || row.inputType,
    config: { ...DEFAULT_MONITOR_CONFIG, ...config, ...parsed.config },
    status: (parsed.status || row.status) as MonitorState["status"],
    snapshots: parsed.snapshots || [],
    alerts: parsed.alerts || [],
    baselineSnapshotIds: parsed.baselineSnapshotIds || [],
    lastScanAt: parsed.lastScanAt || row.lastScanAt?.toISOString() || null,
    startedAt: parsed.startedAt || row.createdAt.toISOString(),
    error: parsed.error || row.error || undefined,
  };
}

export function createMonitorRecord(id: string, state: MonitorState): void {
  const stateWithId = { ...state, id };
  cache.set(id, stateWithId);
  db.monitorSession.upsert({
    where: { id },
    create: serialize(stateWithId),
    update: serialize(stateWithId),
  }).catch((e) => console.error("[monitor-store] persist create failed", id, e instanceof Error ? e.message : String(e)));
}

export function updateMonitorState(id: string, patch: Partial<MonitorState>): MonitorState | undefined {
  const existing = cache.get(id);
  if (!existing) return undefined;
  const updated: MonitorState = { ...existing, ...patch, id };
  cache.set(id, updated);
  db.monitorSession.upsert({
    where: { id },
    create: serialize(updated),
    update: serialize(updated),
  }).catch((e) => console.error("[monitor-store] persist update failed", id, e instanceof Error ? e.message : String(e)));
  return updated;
}

export async function getMonitorState(id: string): Promise<MonitorState | undefined> {
  const cached = cache.get(id);
  if (cached) {
    if (cached.status === "active" && cached.lastScanAt && Date.now() - new Date(cached.lastScanAt).getTime() > 2000) {
      try {
        const row = await db.monitorSession.findUnique({ where: { id } });
        if (row && row.alertCount > cached.alerts.length) {
          const rec = deserialize(row);
          cache.set(id, rec);
          return rec;
        }
      } catch { /* ignore */ }
    }
    return cached;
  }
  try {
    const row = await db.monitorSession.findUnique({ where: { id } });
    if (row) {
      const rec = deserialize(row);
      cache.set(id, rec);
      return rec;
    }
  } catch { /* ignore */ }
  return undefined;
}

// =====================
// Monitor Initialization
// =====================

export interface MonitorInitOptions {
  target: string;
  input_type?: string;
  config?: Partial<MonitorConfig>;
}

export function initMonitor(opts: MonitorInitOptions): { id: string; state: MonitorState; detection: DetectionResult } {
  const id = randomUUID();
  const detection = detectInput(opts.target, (opts.input_type as never) || "auto");
  const config: MonitorConfig = { ...DEFAULT_MONITOR_CONFIG, ...opts.config };
  const now = new Date().toISOString();

  const state: MonitorState = {
    id,
    target: detection.sanitized,
    inputType: detection.inputType,
    config,
    status: "active",
    snapshots: [],
    alerts: [],
    baselineSnapshotIds: [],
    lastScanAt: null,
    startedAt: now,
  };

  createMonitorRecord(id, state);
  return { id, state, detection };
}

// =====================
// Monitor Runner (takes snapshots + compares)
// =====================

export async function runMonitorScan(id: string, detection: DetectionResult): Promise<void> {
  let state = await getMonitorState(id);
  if (!state) return;

  try {
    const now = new Date().toISOString();
    const newSnapshots: MonitorSnapshot[] = [];
    const newAlerts: ChangeAlert[] = [];

    // Take a snapshot for each configured category
    for (const category of state.config.categories) {
      const sources = CATEGORY_SOURCES[category] || [];
      if (sources.length === 0) continue;

      // Query sources in parallel
      const results = await Promise.allSettled(
        sources.slice(0, 3).map((source) => // Limit to 3 sources per category per scan
          runSource(source, detection).then((result) => ({ source, result }))
        )
      );

      const entries: SnapshotEntry[] = [];
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        const { source, result } = r.value;
        if (result.status !== "success") continue;
        const sourceLabel = SOURCE_LABELS[source as keyof typeof SOURCE_LABELS] || source;
        for (const f of result.findings.slice(0, 20)) { // Cap entries per source
          entries.push({
            data: f.data,
            source,
            sourceLabel,
            confidence: f.confidence,
            timestamp: f.timestamp,
          });
        }
      }

      const snapshot: MonitorSnapshot = {
        id: `snap_${state.snapshots.length + newSnapshots.length + 1}`,
        timestamp: now,
        category,
        entries,
        entryCount: entries.length,
      };
      newSnapshots.push(snapshot);

      // Compare against previous snapshot for this category (if exists)
      const previousSnapshot = [...state.snapshots].reverse().find((s) => s.category === category);
      if (previousSnapshot) {
        const alerts = compareSnapshots(previousSnapshot, snapshot, state.target);
        newAlerts.push(...alerts);
      }
    }

    // Update state
    const allSnapshots = [...state.snapshots, ...newSnapshots].slice(-state.config.maxSnapshots * state.config.categories.length);
    const allAlerts = [...state.alerts, ...newAlerts].slice(-200); // Cap alerts at 200

    state = updateMonitorState(id, {
      snapshots: allSnapshots,
      alerts: allAlerts,
      lastScanAt: now,
    }) || state;

    console.info(`[monitor] Scan ${id}: ${newSnapshots.length} snapshots, ${newAlerts.length} alerts`);
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : "Monitor scan failed";
    console.error(`[monitor] error for ${id}:`, errorMsg);
    updateMonitorState(id, { error: errorMsg });
  }
}

// =====================
// Snapshot Comparison
// =====================

function compareSnapshots(previous: MonitorSnapshot, current: MonitorSnapshot, target: string): ChangeAlert[] {
  const alerts: ChangeAlert[] = [];
  const now = current.timestamp;

  // Create lookup sets
  const prevData = new Map(previous.entries.map((e) => [e.data.slice(0, 100), e]));
  const currData = new Map(current.entries.map((e) => [e.data.slice(0, 100), e]));

  // Detect additions (in current but not in previous)
  for (const [key, entry] of currData) {
    if (!prevData.has(key)) {
      const severity = determineSeverity("addition", entry, current.category);
      alerts.push({
        id: `alert_${alerts.length + 1}_${Date.now()}`,
        timestamp: now,
        category: current.category,
        changeType: "addition",
        severity,
        entity: target,
        source: entry.source,
        sourceLabel: entry.sourceLabel,
        previousState: "(not present)",
        currentState: entry.data.slice(0, 150),
        confidence: entry.confidence,
        significance: determineSignificance("addition", current.category, entry.data),
        relatedEntities: extractEntities(entry.data),
      });
    }
  }

  // Detect removals (in previous but not in current)
  for (const [key, entry] of prevData) {
    if (!currData.has(key)) {
      const severity = determineSeverity("removal", entry, current.category);
      alerts.push({
        id: `alert_${alerts.length + 1}_${Date.now()}`,
        timestamp: now,
        category: current.category,
        changeType: "removal",
        severity,
        entity: target,
        source: entry.source,
        sourceLabel: entry.sourceLabel,
        previousState: entry.data.slice(0, 150),
        currentState: "(no longer present)",
        confidence: entry.confidence,
        significance: determineSignificance("removal", current.category, entry.data),
        relatedEntities: extractEntities(entry.data),
      });
    }
  }

  return alerts;
}

function determineSeverity(changeType: ChangeType, entry: SnapshotEntry, category: MonitorCategory): AlertSeverity {
  // High severity for security-relevant additions
  if (changeType === "addition") {
    if (category === "leaks" || category === "security_advisories") return "high";
    if (category === "certificates") return "medium";
    if (category === "dns") return "medium";
    if (category === "news") return entry.confidence > 0.8 ? "medium" : "low";
    return "low";
  }
  if (changeType === "removal") {
    if (category === "certificates" || category === "dns") return "medium";
    return "low";
  }
  return "info";
}

function determineSignificance(changeType: ChangeType, category: MonitorCategory, data: string): string {
  const change = changeType === "addition" ? "New" : changeType === "removal" ? "Removed" : "Modified";
  const catLabel = category.replace(/_/g, " ");
  if (changeType === "addition") {
    return `${change} ${catLabel} finding detected. This may indicate new activity, infrastructure changes, or emerging threats.`;
  }
  if (changeType === "removal") {
    return `${change} ${catLabel} finding — previously observed data is no longer present. This may indicate remediation, cleanup, or data expiration.`;
  }
  return `${change} ${catLabel} finding — content has changed from previous observation.`;
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const ipMatches = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
  if (ipMatches) entities.push(...ipMatches.slice(0, 3));
  const domainMatches = text.match(/\b[\w-]+(\.[\w-]+)+\b/g);
  if (domainMatches) entities.push(...domainMatches.slice(0, 3));
  return [...new Set(entities)].slice(0, 5);
}
