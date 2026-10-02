// Web search source — the "Serper API" equivalent.
// Uses z-ai-web-dev-sdk's functions.invoke('web_search') on the backend.
// Wrapped with a 10-second timeout to prevent hanging and rate-limit cascading.

import ZAI from "z-ai-web-dev-sdk";
import type { SourceResult, NormalizedFinding } from "../types";
import { nowISO } from "./_helpers";

let zaiPromise: Promise<unknown> | null = null;
async function getZai() {
  if (!zaiPromise) zaiPromise = ZAI.create();
  return zaiPromise;
}

interface SearchResultItem {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  date?: string;
}

export async function queryWebSearch(
  target: string,
  contextLabel: string
): Promise<SourceResult> {
  const start = Date.now();
  const findings: NormalizedFinding[] = [];
  try {
    const zai = (await getZai()) as {
      functions: { invoke: (name: string, args: Record<string, unknown>) => Promise<SearchResultItem[]> };
    };
    // Wrap with 10s timeout — web_search should be fast, and we don't want
    // it to consume rate-limit budget that's needed for AI synthesis
    const results = await Promise.race([
      zai.functions.invoke("web_search", { query: target, num: 10 }),
      new Promise<SearchResultItem[]>((_, reject) =>
        setTimeout(() => reject(new Error("web_search timed out after 10s")), 10_000)
      ),
    ]);
    const items = Array.isArray(results) ? results : [];
    for (const item of items.slice(0, 8)) {
      findings.push({
        data: `${item.name}${item.snippet ? " — " + item.snippet : ""}`.slice(0, 600),
        source_url: item.url,
        confidence: 0.6,
        timestamp: item.date || nowISO(),
        extra: { host: item.host_name, rank: (item as unknown as Record<string, unknown>).rank },
      });
    }
    return {
      source: "web_search",
      source_label: contextLabel,
      target,
      status: findings.length ? "success" : "success",
      latency_ms: Date.now() - start,
      findings,
      raw: { count: items.length },
    };
  } catch (e) {
    // Gracefully handle 429 rate limits and timeouts — don't fail the investigation
    return {
      source: "web_search",
      source_label: contextLabel,
      target,
      status: "error",
      error: e instanceof Error ? e.message : "web_search failed",
      latency_ms: Date.now() - start,
      findings: [],
    };
  }
}
