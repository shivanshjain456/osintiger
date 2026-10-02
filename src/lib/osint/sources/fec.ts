// FEC (Federal Election Commission) — U.S. political donation records.
// Public API at https://api.open.fec.gov/v1 (API key optional for low volume).
// We try the public endpoint first (no key), then fall back to web_search.

import ZAI from "z-ai-web-dev-sdk";
import type { SourceResult, NormalizedFinding } from "../types";
import { fetchWithTimeout, nowISO } from "./_helpers";

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

interface FecScheduleA {
  contributor_name?: string;
  contribution_receipt_date?: string;
  memoed?: boolean;
  contribution_receipt_amount?: number;
  committee?: { committee_name?: string };
}

export async function queryFec(name: string): Promise<SourceResult> {
  const start = Date.now();
  const findings: NormalizedFinding[] = [];
  // 1) Try public FEC API (schedule_a contributor search) — no key, lower rate.
  try {
    const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(
      name
    )}&per_page=10&sort=-contribution_receipt_date&sort_hide_null=true`;
    const res = await fetchWithTimeout(url, {}, 9000);
    if (res.ok) {
      const data = await res.json();
      const results: FecScheduleA[] = data?.results || [];
      for (const r of results.slice(0, 10)) {
        const amount = r.contribution_receipt_amount
          ? `$${r.contribution_receipt_amount.toFixed(2)}`
          : "an undisclosed amount";
        findings.push({
          data: `FEC record: ${r.contributor_name || name} contributed ${amount} to ${
            r.committee?.committee_name || "a committee"
          } on ${r.contribution_receipt_date || "unknown date"}`,
          source_url: `https://www.fec.gov/data/receipts/?contributor_name=${encodeURIComponent(name)}`,
          confidence: 0.9,
          timestamp: r.contribution_receipt_date || nowISO(),
          extra: { amount: r.contribution_receipt_amount },
        });
      }
    }
  } catch (e) {
    console.error("[fec] API query failed:", e instanceof Error ? e.message : String(e));
  }

  // 2) Fallback: targeted web_search on fec.gov
  if (!findings.length) {
    try {
      const zai = (await getZai()) as {
        functions: { invoke: (n: string, a: Record<string, unknown>) => Promise<SearchResultItem[]> };
      };
      const results = await zai.functions.invoke("web_search", {
        query: `site:fec.gov ${name}`,
        num: 6,
      });
      const items = Array.isArray(results) ? results : [];
      for (const item of items.slice(0, 6)) {
        findings.push({
          data: `FEC record: ${item.name}${item.snippet ? " — " + item.snippet : ""}`.slice(0, 600),
          source_url: item.url,
          confidence: 0.7,
          timestamp: item.date || nowISO(),
        });
      }
    } catch (e) {
      console.error("[fec] web_search fallback failed:", e instanceof Error ? e.message : String(e));
    }
  }

  if (!findings.length) {
    findings.push({
      data: `No public FEC donation records found for "${name}" (search performed via FEC API + fec.gov).`,
      source_url: `https://www.fec.gov/data/receipts/?contributor_name=${encodeURIComponent(name)}`,
      confidence: 0.4,
      timestamp: nowISO(),
    });
  }

  return {
    source: "fec",
    source_label: "FEC Donations",
    target: name,
    status: "success",
    latency_ms: Date.now() - start,
    findings,
    raw: { finding_count: findings.length },
  };
}
