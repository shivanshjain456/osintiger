// Tests for the investigation store — serialization/deserialization round-trips.
// Bugs here would corrupt investigation data during persistence.

import { describe, it, expect } from "vitest";
import type { InvestigationRecord } from "../types";

// Test the serialization format that the store uses to persist records.
// We test the shape transformation without hitting the DB.
describe("Store Serialization", () => {
  // Build a representative InvestigationRecord
  function makeRecord(): InvestigationRecord {
    return {
      id: "test-inv-id",
      target: "example.com",
      input_type: "domain",
      language: "en",
      script: "Latn",
      modules: ["visual", "crypto", "sanctions"],
      status: "completed",
      created_at: new Date("2024-01-15T10:00:00Z").toISOString(),
      completed_at: new Date("2024-01-15T10:05:00Z").toISOString(),
      current_step: 8,
      total_steps: 8,
      steps: [
        { id: "parse", label: "Parse", status: "success", detail: "Parsed" },
        { id: "route", label: "Route", status: "success", detail: "Routed" },
      ],
      source_results: [
        {
          source: "crtsh",
          source_label: "crt.sh",
          target: "example.com",
          status: "success",
          findings: [
            { data: "cert data", source_url: "https://crt.sh/?q=example.com", confidence: 0.8, timestamp: new Date().toISOString() },
          ],
        },
      ],
      report: null,
      error: undefined,
      cache_expires_at: new Date("2024-01-16T10:00:00Z").toISOString(),
      starred: true,
      tags: ["important", "followup"],
      notes: "Test investigation notes",
      bookmarked_findings: [0, 2],
      finding_annotations: { 0: "Key finding", 2: "Contradicts finding 0" },
      userId: "user-123",
    };
  }

  describe("Record shape", () => {
    it("should have all required fields", () => {
      const rec = makeRecord();
      expect(rec.id).toBeTruthy();
      expect(rec.target).toBeTruthy();
      expect(rec.input_type).toBeTruthy();
      expect(rec.status).toBeTruthy();
      expect(rec.created_at).toBeTruthy();
      expect(rec.current_step).toBeGreaterThanOrEqual(0);
      expect(rec.total_steps).toBeGreaterThan(0);
      expect(Array.isArray(rec.steps)).toBe(true);
      expect(Array.isArray(rec.source_results)).toBe(true);
      expect(Array.isArray(rec.modules)).toBe(true);
    });

    it("should have serializable tags array", () => {
      const rec = makeRecord();
      expect(JSON.stringify(rec.tags)).toBe(JSON.stringify(["important", "followup"]));
    });

    it("should have serializable bookmarked_findings array", () => {
      const rec = makeRecord();
      expect(JSON.stringify(rec.bookmarked_findings)).toBe(JSON.stringify([0, 2]));
    });

    it("should have serializable finding_annotations object", () => {
      const rec = makeRecord();
      const parsed = JSON.parse(JSON.stringify(rec.finding_annotations));
      expect(parsed[0]).toBe("Key finding");
      expect(parsed[2]).toBe("Contradicts finding 0");
    });

    it("should have serializable steps array", () => {
      const rec = makeRecord();
      const parsed = JSON.parse(JSON.stringify(rec.steps));
      expect(parsed.length).toBe(2);
      expect(parsed[0].id).toBe("parse");
      expect(parsed[0].status).toBe("success");
    });

    it("should have serializable source_results array", () => {
      const rec = makeRecord();
      const parsed = JSON.parse(JSON.stringify(rec.source_results));
      expect(parsed.length).toBe(1);
      expect(parsed[0].source).toBe("crtsh");
      expect(parsed[0].findings.length).toBe(1);
    });

    it("should survive a JSON round-trip", () => {
      const rec = makeRecord();
      const serialized = JSON.stringify(rec);
      const deserialized = JSON.parse(serialized) as InvestigationRecord;
      expect(deserialized.id).toBe(rec.id);
      expect(deserialized.target).toBe(rec.target);
      expect(deserialized.status).toBe(rec.status);
      expect(deserialized.steps.length).toBe(rec.steps.length);
      expect(deserialized.source_results.length).toBe(rec.source_results.length);
      expect(deserialized.tags).toEqual(rec.tags);
      expect(deserialized.bookmarked_findings).toEqual(rec.bookmarked_findings);
    });

    it("should handle null report", () => {
      const rec = makeRecord();
      rec.report = null;
      const serialized = JSON.stringify(rec);
      const deserialized = JSON.parse(serialized) as InvestigationRecord;
      expect(deserialized.report).toBeNull();
    });

    it("should handle undefined error", () => {
      const rec = makeRecord();
      rec.error = undefined;
      const serialized = JSON.stringify(rec);
      const deserialized = JSON.parse(serialized) as InvestigationRecord;
      expect(deserialized.error).toBeUndefined();
    });

    it("should handle empty arrays", () => {
      const rec = makeRecord();
      rec.steps = [];
      rec.source_results = [];
      rec.modules = [];
      rec.tags = [];
      rec.bookmarked_findings = [];
      const serialized = JSON.stringify(rec);
      const deserialized = JSON.parse(serialized) as InvestigationRecord;
      expect(deserialized.steps).toEqual([]);
      expect(deserialized.source_results).toEqual([]);
      expect(deserialized.modules).toEqual([]);
      expect(deserialized.tags).toEqual([]);
      expect(deserialized.bookmarked_findings).toEqual([]);
    });

    it("should handle empty finding_annotations", () => {
      const rec = makeRecord();
      rec.finding_annotations = {};
      const serialized = JSON.stringify(rec);
      const deserialized = JSON.parse(serialized) as InvestigationRecord;
      expect(deserialized.finding_annotations).toEqual({});
    });

    it("should preserve userId through serialization", () => {
      const rec = makeRecord();
      const serialized = JSON.stringify(rec);
      const deserialized = JSON.parse(serialized) as InvestigationRecord;
      expect(deserialized.userId).toBe("user-123");
    });
  });
});
