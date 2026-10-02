// ICIJ Offshore Leaks — public database of offshore financial structures.
// No clean public JSON API; we use targeted web_search ("site:offshoreleaks.icij.org")
// to surface leaked records, then attribute findings to ICIJ.

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

export async function queryIcij(target: string): Promise<SourceResult> {
  const start = Date.now();
  try {
    const zai = (await getZai()) as {
      functions: { invoke: (n: string, a: Record<string, unknown>) => Promise<SearchResultItem[]> };
    };
    const results = await zai.functions.invoke("web_search", {
      query: `site:offshoreleaks.icij.org ${target}`,
      num: 8,
    });
    const items = Array.isArray(results) ? results : [];
    const findings: NormalizedFinding[] = [];
    for (const item of items.slice(0, 8)) {
      findings.push({
        data: `ICIJ Offshore Leaks record: ${item.name}${item.snippet ? " — " + item.snippet : ""}`.slice(0, 600),
        source_url: item.url,
        confidence: 0.75,
        timestamp: item.date || nowISO(),
      });
    }
    // Also include a direct database link as a reference finding
    findings.push({
      data: `Offshore Leaks database search page for target (manual verification recommended)`,
      source_url: `https://offshoreleaks.icij.org/search?cat=1,2,3,4&q=${encodeURIComponent(target)}`,
      confidence: 0.5,
      timestamp: nowISO(),
    });
    return {
      source: "icij",
      source_label: "ICIJ Offshore Leaks",
      target,
      status: "success",
      latency_ms: Date.now() - start,
      findings,
      raw: { hits: items.length },
    };
  } catch (e) {
    return {
      source: "icij",
      source_label: "ICIJ Offshore Leaks",
      target,
      status: "error",
      error: e instanceof Error ? e.message : "ICIJ query failed",
      latency_ms: Date.now() - start,
      findings: [],
    };
  }
}
