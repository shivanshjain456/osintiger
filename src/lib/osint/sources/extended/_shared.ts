// Shared helpers for extended OSINT API sources.
// Provides rate limiting, timeout, and normalization utilities.

import type { SourceResult, NormalizedFinding } from "../../types";
import { nowISO } from "../_helpers";

// Rate limiter — tracks last request time per source key.
const lastRequestTime = new Map<string, number>();
const minIntervals = new Map<string, number>();

export function setRateLimit(source: string, intervalMs: number) {
  minIntervals.set(source, intervalMs);
}

export async function rateLimitedFetch(
  source: string,
  url: string,
  opts: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const interval = minIntervals.get(source) || 1000;
  const last = lastRequestTime.get(source) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < interval) {
    await new Promise((r) => setTimeout(r, interval - elapsed));
  }
  lastRequestTime.set(source, Date.now());

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        "User-Agent": "OSINTiger/1.0 (OSINT research tool)",
        Accept: "application/json",
        ...(opts.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Build a standard SourceResult for a successful query.
export function buildSuccess(
  source: string,
  sourceLabel: string,
  target: string,
  findings: NormalizedFinding[],
  latencyMs: number,
  raw?: unknown
): SourceResult {
  return {
    source,
    source_label: sourceLabel,
    target,
    status: "success",
    latency_ms: latencyMs,
    findings,
    raw,
  };
}

// Build a standard SourceResult for a skipped source (no API key).
export function buildSkipped(
  source: string,
  sourceLabel: string,
  target: string,
  reason: string
): SourceResult {
  return {
    source,
    source_label: sourceLabel,
    target,
    status: "skipped",
    error: reason,
    findings: [],
  };
}

// Build a standard SourceResult for an error.
export function buildError(
  source: string,
  sourceLabel: string,
  target: string,
  error: string,
  latencyMs?: number
): SourceResult {
  return {
    source,
    source_label: sourceLabel,
    target,
    status: "error",
    error,
    latency_ms: latencyMs,
    findings: [],
  };
}

// Create a single finding.
export function finding(
  data: string,
  sourceUrl: string,
  confidence: number,
  timestamp?: string
): NormalizedFinding {
  return {
    data,
    source_url: sourceUrl,
    confidence,
    timestamp: timestamp || nowISO(),
  };
}
