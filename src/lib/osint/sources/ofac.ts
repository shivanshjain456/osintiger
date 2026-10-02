// OFAC SDN source wrapper for the investigation pipeline.
// Runs the fuzzy matcher and converts results into NormalizedFindings.

import type { SourceResult, NormalizedFinding } from "../types";
import { screenSanctions } from "../ofac";
import { nowISO } from "./_helpers";

export async function queryOfac(target: string): Promise<SourceResult> {
  const start = Date.now();
  try {
    const result = screenSanctions(target, 0.6);
    const findings: NormalizedFinding[] = [];
    for (const m of result.matches) {
      findings.push({
        data: `OFAC SDN ${
          result.match_status === "likely_match" ? "LIKELY MATCH" : "possible match"
        }: "${m.sdn_name}" (similarity ${(m.similarity * 100).toFixed(1)}%, program ${m.program}${
          m.remarks ? ", " + m.remarks : ""
        })`,
        source_url: m.details_url,
        confidence: m.similarity,
        timestamp: nowISO(),
        extra: { program: m.program, entity_type: m.entity_type },
      });
    }
    if (!findings.length) {
      findings.push({
        data: `OFAC SDN screening: no match above 60% similarity for "${target}" (checked ${result.list_size} entries).`,
        source_url: "https://sanctionssearch.ofac.treas.gov/",
        confidence: 0.85,
        timestamp: nowISO(),
        extra: { match_status: "no_match" },
      });
    }
    return {
      source: "ofac",
      source_label: "OFAC SDN Screening",
      target,
      status: "success",
      latency_ms: Date.now() - start,
      findings,
      raw: result,
    };
  } catch (e) {
    return {
      source: "ofac",
      source_label: "OFAC SDN Screening",
      target,
      status: "error",
      error: e instanceof Error ? e.message : "OFAC screening failed",
      latency_ms: Date.now() - start,
      findings: [],
    };
  }
}
