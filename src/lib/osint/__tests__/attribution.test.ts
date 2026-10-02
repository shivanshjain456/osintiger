// Tests for the attribution module — ensures every finding has a [SOURCE] tag.
// Bugs here would violate the "zero-hallucination protocol" — the core
// value proposition of the platform.

import { describe, it, expect } from "vitest";
import { markAttribution } from "../attribution";
import type { ReportData } from "../types";

// Build a minimal ReportData for testing
function makeReport(findings: Array<{ claim: string; source: string; source_url: string; confidence: number }>): ReportData {
  return {
    executive_summary: "Test summary",
    detailed_analysis: "Test analysis",
    key_findings: findings,
    sources_consulted: [{ source: "test", source_label: "Test", url: "http://example.com", tier: 2 }],
    contradictions: [],
    ach_analysis: { hypotheses: [], matrix: [] },
    confidence_score: 0.8,
    needs_manual_review: false,
    attribution_valid: true,
    geopoints: [],
    risk_matrix: { overall_risk: "low", factors: [] },
    monitoring_recommendations: [],
    collection_gaps: [],
    link_graph: { nodes: [], edges: [] },
    timeline: [],
    attack_surface: { exposed_services: [], attack_paths: [] },
    threat_assessment: { threat_level: "low", impact: "low", likelihood: "low" },
    exec_profile: { name: "", title: "", confidence: 0 },
    org_hierarchy: { entities: [], relationships: [] },
    digital_footprint: { surface: {}, deep: {}, dark: {} },
    credibility_ranking: [],
    infrastructure_evolution: [],
    certificates: [],
    tech_fingerprint: { technologies: [], categories: [] },
    temporal_intel: { events: [], patterns: [] },
    social_intelligence: null,
    entity_resolution: { entities: [], duplicates: [] },
    confidence_breakdown: { source_diversity: 0, source_reliability: 0, corroboration: 0, recency: 0, overall: 0 },
    provenance_summary: { total_events: 0, collectors: [], coverage: 0 },
    version_history: [],
  } as never;
}

describe("Attribution Engine", () => {
  describe("markAttribution", () => {
    it("should mark attribution as valid when all findings have [SOURCE] tags", () => {
      const report = makeReport([
        {
          claim: "Finding with source [SOURCE: test, URL: http://example.com]",
          source: "test",
          source_url: "http://example.com",
          confidence: 0.8,
        },
      ]);

      const result = markAttribution(report);
      expect(result.attribution_valid).toBe(true);
      expect(result.needs_manual_review).toBe(false);
    });

    it("should mark attribution as invalid when findings lack [SOURCE] tags", () => {
      const report = makeReport([
        {
          claim: "Finding without source tag",
          source: "test",
          source_url: "http://example.com",
          confidence: 0.8,
        },
      ]);

      const result = markAttribution(report);
      expect(result.attribution_valid).toBe(false);
      expect(result.needs_manual_review).toBe(true);
    });

    it("should handle empty findings", () => {
      const report = makeReport([]);
      const result = markAttribution(report);
      expect(result).toBeDefined();
    });
  });
});
