// crt.sh — Certificate Transparency. No auth, returns JSON array.
// Endpoint: https://crt.sh/?q={domain}&output=json

import type { SourceResult, NormalizedFinding } from "../types";
import { fetchWithTimeout, nowISO } from "./_helpers";

interface CrtShEntry {
  issuer_ca_id?: number;
  issuer_name?: string;
  common_name?: string;
  name_value?: string;
  id?: number;
  entry_timestamp?: string;
  not_before?: string;
  not_after?: string;
  serial_number?: string;
}

export async function queryCrtSh(domain: string): Promise<SourceResult> {
  const start = Date.now();
  try {
    const url = `https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`;
    const res = await fetchWithTimeout(url, {}, 12000);
    if (!res.ok) {
      throw new Error(`crt.sh HTTP ${res.status}`);
    }
    const text = await res.text();
    let data: CrtShEntry[] = [];
    try {
      data = JSON.parse(text);
    } catch {
      // crt.sh sometimes returns concat JSON; fall back
      data = [];
    }
    const seen = new Set<string>();
    const findings: NormalizedFinding[] = [];
    for (const entry of data.slice(0, 25)) {
      const names = (entry.name_value || entry.common_name || "")
        .split("\n")
        .filter(Boolean);
      for (const name of names) {
        const key = name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({
          data: `Certificate transparency record for: ${name.trim()}`,
          source_url: `https://crt.sh/?q=${encodeURIComponent(name.trim())}`,
          confidence: 0.9,
          timestamp: entry.entry_timestamp || entry.not_before || nowISO(),
          extra: {
            issuer: entry.issuer_name,
            not_after: entry.not_after,
          },
        });
      }
    }
    return {
      source: "crtsh",
      source_label: "crt.sh (Certificate Transparency)",
      target: domain,
      status: "success",
      latency_ms: Date.now() - start,
      findings,
      raw: { total_records: data.length, unique_names: findings.length },
    };
  } catch (e) {
    return {
      source: "crtsh",
      source_label: "crt.sh (Certificate Transparency)",
      target: domain,
      status: "error",
      error: e instanceof Error ? e.message : "crt.sh failed",
      latency_ms: Date.now() - start,
      findings: [],
    };
  }
}
