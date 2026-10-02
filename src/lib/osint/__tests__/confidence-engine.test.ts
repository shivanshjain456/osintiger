import { describe, it, expect } from "vitest";
import {
  getReliabilityTier,
  getTierLabel,
  computeConfidence,
  SOURCE_RELIABILITY,
} from "../confidence-engine";
import type { SourceResult, SourceConsulted } from "../types";

describe("Confidence Engine & Admiralty Methodology", () => {
  describe("Source Reliability Tiers", () => {
    it("should classify authoritative government and standard bodies as Tier 5", () => {
      expect(getReliabilityTier("edgar")).toBe(5);
      expect(getReliabilityTier("ofac")).toBe(5);
      expect(getReliabilityTier("cisa_kev")).toBe(5);
      expect(getReliabilityTier("nvd")).toBe(5);
      expect(getTierLabel(5)).toBe("Authoritative (government/standards)");
    });

    it("should classify commercial threat intelligence as Tier 4", () => {
      expect(getReliabilityTier("virustotal")).toBe(4);
      expect(getReliabilityTier("abuseipdb")).toBe(4);
      expect(getReliabilityTier("otx")).toBe(4);
      expect(getTierLabel(4)).toBe("Major threat intelligence platform");
    });

    it("should classify public registries and DNS resolvers as Tier 3", () => {
      expect(getReliabilityTier("crtsh")).toBe(3);
      expect(getReliabilityTier("dns_google")).toBe(3);
      expect(getReliabilityTier("opencorporates")).toBe(3);
      expect(getTierLabel(3)).toBe("Established data provider");
    });

    it("should classify community aggregators as Tier 2", () => {
      expect(getReliabilityTier("hackernews")).toBe(2);
      expect(getReliabilityTier("reddit")).toBe(2);
      expect(getTierLabel(2)).toBe("Community/aggregate source");
    });

    it("should classify unverified raw web search as Tier 1", () => {
      expect(getReliabilityTier("web_search")).toBe(1);
      expect(getTierLabel(1)).toBe("Unverified/user-generated");
    });

    it("should default unknown sources to Tier 2 gracefully", () => {
      expect(getReliabilityTier("unknown_telemetry_source")).toBe(2);
    });
  });

  describe("Multi-Dimensional Confidence Scoring", () => {
    const mockResults: SourceResult[] = [
      {
        source: "edgar",
        source_label: "SEC EDGAR",
        status: "success",
        records_count: 5,
        raw_data: [],
        findings: [
          { data: "Incorporated in Delaware", source: "edgar", timestamp: new Date().toISOString() },
        ],
        queried_at: new Date().toISOString(),
      },
      {
        source: "crtsh",
        source_label: "crt.sh Certificate Search",
        status: "success",
        records_count: 3,
        raw_data: [],
        findings: [
          { data: "Wildcard TLS certificate issued", source: "crtsh", timestamp: new Date().toISOString() },
        ],
        queried_at: new Date().toISOString(),
      },
    ];

    const mockConsulted: SourceConsulted[] = [
      { source: "edgar", source_label: "SEC EDGAR", url: "https://sec.gov", tier: 5 },
      { source: "crtsh", source_label: "crt.sh", url: "https://crt.sh", tier: 3 },
    ];

    const mockFindings = [
      {
        claim: "Incorporated in Delaware [SOURCE: SEC EDGAR, URL: https://sec.gov]",
        source: "edgar",
        source_url: "https://sec.gov",
        confidence: 0.95,
      },
    ];

    it("should compute multi-dimensional confidence breakdown with all 5 dimensions", () => {
      const breakdown = computeConfidence(mockResults, mockConsulted, mockFindings);
      expect(breakdown).toBeDefined();
      expect(breakdown.overall).toBeGreaterThanOrEqual(0);
      expect(breakdown.overall).toBeLessThanOrEqual(100);

      expect(breakdown.dimensions.sourceConfidence).toBeDefined();
      expect(breakdown.dimensions.sourceConfidence.score).toBeGreaterThanOrEqual(0);

      expect(breakdown.dimensions.crossSourceConfidence).toBeDefined();
      expect(breakdown.dimensions.freshness).toBeDefined();
      expect(breakdown.dimensions.verification).toBeDefined();
      expect(breakdown.dimensions.trustScore).toBeDefined();

      expect(breakdown.overallExplanation).toContain("Overall confidence is");
      expect(breakdown.sourceDetails.length).toBe(2);
    });
  });
});
