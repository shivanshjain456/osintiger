// Data normalization layer. Source results are already produced in the common
// NormalizedFinding shape by each source module; this layer additionally:
//  - dedupes findings by (source, source_url, data-prefix)
//  - builds the sources_consulted summary list
//  - extracts geopoints from findings that carry lat/lon
//  - caps findings per source to keep the AI prompt tractable

import type { SourceResult, SourceConsulted, Geopoint } from "./types";
import { SOURCE_LABELS, SOURCE_URLS } from "./router";

export interface NormalizedBundle {
  sources_consulted: SourceConsulted[];
  all_findings: {
    source: string;
    source_label: string;
    source_url: string;
    data: string;
    confidence: number;
    timestamp: string;
    extra?: Record<string, unknown>;
  }[];
  geopoints: Geopoint[];
}

export function normalizeSourceResults(results: SourceResult[]): NormalizedBundle {
  const sources_consulted: SourceConsulted[] = [];
  const all_findings: NormalizedBundle["all_findings"] = [];
  const geopoints: Geopoint[] = [];
  const seenKeys = new Set<string>();

  for (const r of results) {
    const source_label = r.source_label || SOURCE_LABELS[r.source as keyof typeof SOURCE_LABELS] || r.source;
    sources_consulted.push({
      source: r.source,
      source_label,
      status: r.status,
      url: SOURCE_URLS[r.source as keyof typeof SOURCE_URLS],
      finding_count: r.findings.length,
      error: r.error,
    });

    // cap to 6 findings per source
    for (const f of r.findings.slice(0, 8)) {
      const key = `${r.source}|${f.source_url}|${f.data.slice(0, 80)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      all_findings.push({
        source: r.source,
        source_label,
        source_url: f.source_url,
        data: f.data,
        confidence: f.confidence,
        timestamp: f.timestamp,
        extra: f.extra,
      });

      // extract geopoint if extra has lat/lon
      const ex = f.extra as { lat?: number; lon?: number; country?: string } | undefined;
      if (ex && typeof ex.lat === "number" && typeof ex.lon === "number") {
        geopoints.push({
          label: r.target,
          country: ex.country,
          lat: ex.lat,
          lon: ex.lon,
          weight: 1,
          source: source_label,
          note: f.data,
        });
      }
    }
  }

  return { sources_consulted, all_findings, geopoints };
}
