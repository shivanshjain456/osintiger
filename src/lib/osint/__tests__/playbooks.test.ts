// Tests for the playbooks module — domain-aware investigation templates.
// Bugs here would cause investigations to use wrong sources, scoring,
// or reporting configurations for specific use cases (M&A, fraud, IR, etc.).

import { describe, it, expect } from "vitest";
import {
  getPlaybook,
  getRecommendedPlaybook,
  PLAYBOOKS,
  type PlaybookType,
} from "../playbooks";

describe("Playbooks", () => {
  describe("PLAYBOOKS", () => {
    it("should have at least 10 playbooks", () => {
      expect(Object.keys(PLAYBOOKS).length).toBeGreaterThanOrEqual(10);
    });

    it("should have unique types", () => {
      const types = Object.keys(PLAYBOOKS);
      expect(new Set(types).size).toBe(types.length);
    });

    it("should have all playbooks with required fields", () => {
      for (const [type, pb] of Object.entries(PLAYBOOKS)) {
        expect(type).toBeTruthy();
        expect(pb.type).toBe(type);
        expect(pb.name).toBeTruthy();
        expect(pb.description).toBeTruthy();
      }
    });
  });

  describe("getPlaybook", () => {
    it("should return a playbook for a valid type", () => {
      const types = Object.keys(PLAYBOOKS) as PlaybookType[];
      const firstType = types[0];
      const pb = getPlaybook(firstType);
      expect(pb).toBeDefined();
      expect(pb?.type).toBe(firstType);
      expect(pb?.name).toBeTruthy();
    });

    it("should return undefined for an invalid type", () => {
      const pb = getPlaybook("nonexistent" as PlaybookType);
      expect(pb).toBeUndefined();
    });
  });

  describe("getRecommendedPlaybook", () => {
    it("should return a recommendation for domain input", () => {
      const result = getRecommendedPlaybook("domain");
      expect(result).toBeTruthy();
      expect(typeof result).toBe("string");
    });

    it("should return a recommendation for organization input", () => {
      const result = getRecommendedPlaybook("organization");
      expect(result).toBeTruthy();
    });

    it("should return a recommendation for person input", () => {
      const result = getRecommendedPlaybook("person");
      expect(result).toBeTruthy();
    });

    it("should return a recommendation for ip input", () => {
      const result = getRecommendedPlaybook("ip");
      expect(result).toBeTruthy();
    });

    it("should return a recommendation for unknown input types", () => {
      const result = getRecommendedPlaybook("unknown_type");
      expect(result).toBeTruthy();
    });
  });
});
