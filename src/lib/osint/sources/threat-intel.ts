// Threat intel enrichment for IP targets — Shodan-style open-port / service surface.
// Without a Shodan API key, we use targeted web_search ("shodan <ip>", "censys <ip>")
// to surface publicly-reported port/service data and security flags.

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

export async function queryThreatIntel(ip: string): Promise<SourceResult> {
  const start = Date.now();
  const findings: NormalizedFinding[] = [];
  try {
    const zai = (await getZai()) as {
      functions: { invoke: (n: string, a: Record<string, unknown>) => Promise<SearchResultItem[]> };
    };
    const results = await zai.functions.invoke("web_search", {
      query: `shodan ${ip} open ports services`,
      num: 6,
    });
    const items = Array.isArray(results) ? results : [];
    for (const item of items.slice(0, 6)) {
      findings.push({
        data: `Threat intel: ${item.name}${item.snippet ? " — " + item.snippet : ""}`.slice(0, 600),
        source_url: item.url,
        confidence: 0.6,
        timestamp: item.date || nowISO(),
        extra: { host: item.host_name },
      });
    }
    // Add a direct Shodan lookup reference
    findings.push({
      data: `Shodan public lookup page for ${ip} (manual verification of open ports/services recommended)`,
      source_url: `https://www.shodan.io/host/${encodeURIComponent(ip)}`,
      confidence: 0.5,
      timestamp: nowISO(),
    });
    // Add Censys reference
    findings.push({
      data: `Censys public host report for ${ip} (TLS/service scanning)`,
      source_url: `https://search.censys.io/hosts/${encodeURIComponent(ip)}`,
      confidence: 0.5,
      timestamp: nowISO(),
    });
    return {
      source: "threat_intel",
      source_label: "IP Threat Intel (Shodan/Censys)",
      target: ip,
      status: "success",
      latency_ms: Date.now() - start,
      findings,
      raw: { hits: items.length },
    };
  } catch (e) {
    return {
      source: "threat_intel",
      source_label: "IP Threat Intel (Shodan/Censys)",
      target: ip,
      status: "error",
      error: e instanceof Error ? e.message : "Threat intel query failed",
      latency_ms: Date.now() - start,
      findings: [],
    };
  }
}
