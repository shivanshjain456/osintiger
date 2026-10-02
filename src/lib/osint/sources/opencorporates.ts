// OpenCorporates — global corporate registry. Free tier requires an API key.
// Without a key, we use a targeted web_search to surface OpenCorporates company pages
// and registry filings, attributing them to OpenCorporates.

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

export async function queryOpenCorporates(orgName: string): Promise<SourceResult> {
  const start = Date.now();
  try {
    const zai = (await getZai()) as {
      functions: { invoke: (n: string, a: Record<string, unknown>) => Promise<SearchResultItem[]> };
    };
    const results = await zai.functions.invoke("web_search", {
      query: `site:opencorporates.com ${orgName}`,
      num: 8,
    });
    const items = Array.isArray(results) ? results : [];
    const findings: NormalizedFinding[] = [];
    for (const item of items.slice(0, 8)) {
      findings.push({
        data: `OpenCorporates entry: ${item.name}${item.snippet ? " — " + item.snippet : ""}`.slice(0, 600),
        source_url: item.url,
        confidence: 0.78,
        timestamp: item.date || nowISO(),
      });
    }
    // Direct search link as a reference
    findings.push({
      data: `OpenCorporates company search for "${orgName}" (manual verification recommended)`,
      source_url: `https://opencorporates.com/companies?q=${encodeURIComponent(orgName)}`,
      confidence: 0.5,
      timestamp: nowISO(),
    });
    return {
      source: "opencorporates",
      source_label: "OpenCorporates",
      target: orgName,
      status: "success",
      latency_ms: Date.now() - start,
      findings,
      raw: { hits: items.length },
    };
  } catch (e) {
    return {
      source: "opencorporates",
      source_label: "OpenCorporates",
      target: orgName,
      status: "error",
      error: e instanceof Error ? e.message : "OpenCorporates query failed",
      latency_ms: Date.now() - start,
      findings: [],
    };
  }
}
