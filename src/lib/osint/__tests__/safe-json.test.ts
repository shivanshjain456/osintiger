// Tests for the safe-json module — safe JSON parsing utilities.
// These tests verify that safeJsonParse and related utilities handle
// malformed input, type mismatches, and edge cases without throwing.

import { describe, it, expect } from "vitest";
import { safeJsonParse, safeJsonStringArray, safeJsonObject } from "../safe-json";

describe("safe-json", () => {
  describe("safeJsonParse", () => {
    it("should parse valid JSON", () => {
      const result = safeJsonParse('{"key":"value"}', { fallback: true });
      expect(result).toEqual({ key: "value" });
    });

    it("should return fallback for invalid JSON", () => {
      const result = safeJsonParse('{"key":', { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it("should return fallback for null input", () => {
      const result = safeJsonParse(null as never, { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it("should return fallback for empty string", () => {
      const result = safeJsonParse("", { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it("should return fallback for undefined input", () => {
      const result = safeJsonParse(undefined as never, { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it("should parse arrays", () => {
      const result = safeJsonParse('[1,2,3]', []);
      expect(result).toEqual([1, 2, 3]);
    });

    it("should parse nested objects", () => {
      const result = safeJsonParse('{"a":{"b":{"c":1}}}', {});
      expect(result).toEqual({ a: { b: { c: 1 } } });
    });

    it("should parse null values", () => {
      const result = safeJsonParse('null', { fallback: true });
      expect(result).toBeNull();
    });

    it("should parse primitive values", () => {
      expect(safeJsonParse('42', 0)).toBe(42);
      expect(safeJsonParse('"hello"', "")).toBe("hello");
      expect(safeJsonParse('true', false)).toBe(true);
    });

    it("should use fallback for non-JSON strings", () => {
      const result = safeJsonParse("not json at all", { default: true });
      expect(result).toEqual({ default: true });
    });
  });

  describe("safeJsonStringArray", () => {
    it("should parse a valid JSON string array", () => {
      const result = safeJsonStringArray('["a","b","c"]');
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should return empty array for invalid JSON", () => {
      const result = safeJsonStringArray('{"key":');
      expect(result).toEqual([]);
    });

    it("should return empty array for empty string", () => {
      const result = safeJsonStringArray("");
      expect(result).toEqual([]);
    });

    it("should return empty array for non-array JSON", () => {
      const result = safeJsonStringArray('{"key":"value"}');
      expect(result).toEqual([]);
    });

    it("should return empty array for null input", () => {
      const result = safeJsonStringArray(null as never);
      expect(result).toEqual([]);
    });

    it("should handle arrays with non-string elements by filtering them", () => {
      const result = safeJsonStringArray('["a", 1, "b", null, "c"]');
      expect(result).toEqual(["a", "b", "c"]);
    });

    it("should handle empty arrays", () => {
      const result = safeJsonStringArray("[]");
      expect(result).toEqual([]);
    });
  });

  describe("safeJsonObject", () => {
    it("should parse a valid JSON object", () => {
      const result = safeJsonObject('{"key":"value"}');
      expect(result).toEqual({ key: "value" });
    });

    it("should return empty object for invalid JSON", () => {
      const result = safeJsonObject('{"key":');
      expect(result).toEqual({});
    });

    it("should return empty object for empty string", () => {
      const result = safeJsonObject("");
      expect(result).toEqual({});
    });

    it("should return empty object for non-object JSON", () => {
      const result = safeJsonObject('[1,2,3]');
      expect(result).toEqual({});
    });

    it("should return empty object for null input", () => {
      const result = safeJsonObject(null as never);
      expect(result).toEqual({});
    });

    it("should handle nested objects", () => {
      const result = safeJsonObject('{"a":{"b":1}}');
      expect(result).toEqual({ a: { b: 1 } });
    });
  });
});
