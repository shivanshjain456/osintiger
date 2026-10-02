// SEC EDGAR — U.S. corporate filings. Public, no auth.
// Uses the full-text search API: https://efts.sec.gov/LATEST/search-index?q=...
// Docs: https://www.sec.gov/cgi-bin/browse-edgar (legacy) + https://efts.sec.gov/LATEST/search-index?q=

import type { SourceResult, NormalizedFinding } from "../types";
import { fetchWithTimeout, nowISO } from "./_helpers";

interface EdgarHit {
  _source?: {
    display_names?: string[];
    adsh?: string;
    form?: string;
    file_date?: string;
    entity_name?: string;
    cik?: string;
    film_num?: string;
  };
  _id?: string;
}

interface EdgarResponse {
  hits?: {
    total?: { value?: number };
    hits?: EdgarHit[];
  };
}

export async function queryEdgar(orgName: string): Promise<SourceResult> {
  const start = Date.now();
  try {
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(
      orgName
    )}&dateRange=custom&startdt=2015-01-01&forms=10-K,10-Q,8-K,20-F,S-1,D`;
    const res = await fetchWithTimeout(
      url,
      { headers: { accept: "application/json" } },
      12000
    );
    let hits: EdgarHit[] = [];
    let total = 0;
    if (res.ok) {
      try {
        const data: EdgarResponse = await res.json();
        hits = data.hits?.hits || [];
        total = data.hits?.total?.value || hits.length;
      } catch (e) {
        console.error("[edgar] JSON parse failed:", e instanceof Error ? e.message : String(e));
      }
    }

    // Fallback to legacy browse-edgar by CIK/company name
    if (!hits.length) {
      const legacy = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(
        orgName
      )}&type=&dateb=&owner=include&count=10&search_text=&action=getcompany&output=atom`;
      const lr = await fetchWithTimeout(legacy, {}, 10000);
      if (lr.ok) {
        const atom = await lr.text();
        // crude entry extraction from atom feed
        const entries = atom.split(/<entry>/i).slice(1, 11);
        for (const entry of entries) {
          const title = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
          const updated = entry.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]?.trim();
          const id = entry.match(/<id[^>]*>([\s\S]*?)<\/id>/i)?.[1]?.trim();
          if (title && id) {
            hits.push({
              _id: id,
              _source: {
                display_names: [title],
                file_date: updated,
                form: "EDGAR filing",
                adsh: id,
              },
            });
          }
        }
        total = hits.length;
      }
    }

    const findings: NormalizedFinding[] = [];
    for (const hit of hits.slice(0, 12)) {
      const s = hit._source;
      if (!s) continue;
      const title = s.display_names?.[0] || s.entity_name || s.form || "EDGAR filing";
      const adsh = s.adsh || hit._id || "";
      const link = adsh
        ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(
            orgName
          )}`
        : "https://www.sec.gov/cgi-bin/browse-edgar";
      findings.push({
        data: `SEC EDGAR filing: ${title}${s.form ? ` [${s.form}]` : ""}`,
        source_url: link,
        confidence: 0.88,
        timestamp: s.file_date || nowISO(),
        extra: { form: s.form, cik: s.cik, adsh },
      });
    }

    return {
      source: "edgar",
      source_label: "SEC EDGAR",
      target: orgName,
      status: findings.length ? "success" : total > 0 ? "success" : "success",
      latency_ms: Date.now() - start,
      findings,
      raw: { total_filings: total },
    };
  } catch (e) {
    return {
      source: "edgar",
      source_label: "SEC EDGAR",
      target: orgName,
      status: "error",
      error: e instanceof Error ? e.message : "EDGAR query failed",
      latency_ms: Date.now() - start,
      findings: [],
    };
  }
}
