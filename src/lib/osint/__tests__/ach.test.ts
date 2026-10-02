// Tests for the ACH (Analysis of Competing Hypotheses) matrix builder.
// Bugs here would produce incorrect intelligence analysis — the core
// analytical methodology of the platform.

import { describe, it, expect } from "vitest";
import { buildAch } from "../ach";
import type { KeyFinding } from "../types";

describe("ACH Matrix Builder", () => {
  const mockKeyFindings: KeyFinding[] = [
    {
      claim: "Finding supports hypothesis A [SOURCE: test, URL: http://example.com/1]",
      source: "test",
      source_url: "http://example.com/1",
      confidence: 0.8,
      
    },
    {
      claim: "Finding contradicts hypothesis B [SOURCE: test, URL: http://example.com/2]",
      source: "test",
      source_url: "http://example.com/2",
      confidence: 0.7,
      
    },
  ];

  const mockHypotheses = [
    { statement: "Hypothesis A is correct", confidence: 0.8, rationale: "Evidence supports A" },
    { statement: "Hypothesis B is correct", confidence: 0.3, rationale: "Evidence contradicts B" },
  ];

  describe("buildAch", () => {
    it("should return an ACH analysis object", () => {
      const result = buildAch(mockKeyFindings, mockHypotheses);
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
    });

    it("should include hypotheses array", () => {
      const result = buildAch(mockKeyFindings, mockHypotheses);
      expect(Array.isArray(result.hypotheses)).toBe(true);
      expect(result.hypotheses.length).toBe(2);
    });

    it("should include matrix array", () => {
      const result = buildAch(mockKeyFindings, mockHypotheses);
      expect(Array.isArray(result.matrix)).toBe(true);
    });

    it("should handle empty key findings", () => {
      const result = buildAch([], mockHypotheses);
      expect(result).toBeDefined();
      expect(result.hypotheses).toBeDefined();
    });

    it("should handle empty hypotheses", () => {
      const result = buildAch(mockKeyFindings, []);
      expect(result).toBeDefined();
      expect(result.hypotheses).toHaveLength(0);
    });

    it("should handle both empty", () => {
      const result = buildAch([], []);
      expect(result).toBeDefined();
    });

    it("should cap evidence at 10 findings", () => {
      const manyFindings: KeyFinding[] = Array.from({ length: 15 }, (_, i) => ({
        claim: `Finding ${i} [SOURCE: test, URL: http://example.com/${i}]`,
        source: "test",
        source_url: `http://example.com/${i}`,
        confidence: 0.5,
        
      }));
      const result = buildAch(manyFindings, mockHypotheses);
      expect(result.matrix.length).toBeLessThanOrEqual(10);
    });

    it("should cap hypotheses at 5", () => {
      const manyHypotheses = Array.from({ length: 7 }, (_, i) => ({
        statement: `Hypothesis ${i}`,
        confidence: 0.5,
        rationale: `Rationale ${i}`,
      }));
      const result = buildAch(mockKeyFindings, manyHypotheses);
      expect(result.hypotheses.length).toBeLessThanOrEqual(5);
    });
  });
});
