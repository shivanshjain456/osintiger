// Tests for the OSINT source router — determines which sources to query
// for a given input type. Bugs here would cause investigations to query
// the wrong sources (wasting API calls) or miss critical sources.

import { describe, it, expect } from "vitest";
import { routeSources, SOURCE_LABELS } from "../router";
import { detectInput } from "../detector";

describe("Source Router", () => {
  describe("SOURCE_LABELS", () => {
    it("should have labels for all sources", () => {
      expect(Object.keys(SOURCE_LABELS).length).toBeGreaterThan(20);
    });

    it("should have non-empty string labels", () => {
      for (const [key, label] of Object.entries(SOURCE_LABELS)) {
        expect(key).toBeTruthy();
        expect(label).toBeTruthy();
        expect(typeof label).toBe("string");
      }
    });
  });

  describe("routeSources", () => {
    it("should return sources for domain input", () => {
      const detection = detectInput("example.com", "auto");
      const sources = routeSources(detection);
      expect(sources).toBeDefined();
      expect(Array.isArray(sources)).toBe(true);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should return sources for ip input", () => {
      const detection = detectInput("8.8.8.8", "auto");
      const sources = routeSources(detection);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should return sources for person input", () => {
      const detection = detectInput("John Doe", "person");
      const sources = routeSources(detection);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should return sources for organization input", () => {
      const detection = detectInput("Tesla Inc", "organization");
      const sources = routeSources(detection);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should return sources for email input", () => {
      const detection = detectInput("user@example.com", "auto");
      const sources = routeSources(detection);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should return sources for wallet input", () => {
      const detection = detectInput("0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "auto");
      const sources = routeSources(detection);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should return sources for cve input", () => {
      const detection = detectInput("CVE-2021-44228", "auto");
      const sources = routeSources(detection);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should return sources for url input", () => {
      const detection = detectInput("https://example.com", "auto");
      const sources = routeSources(detection);
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should return unique sources (no duplicates)", () => {
      const detection = detectInput("example.com", "auto");
      const sources = routeSources(detection);
      const unique = new Set(sources);
      expect(unique.size).toBe(sources.length);
    });
  });
});
