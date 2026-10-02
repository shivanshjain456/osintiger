// Tests for the SPA hash router — URL parsing, serialization, and navigation.
// These tests verify that routes are correctly parsed from the URL hash and
// serialized back to canonical hash strings, including edge cases like
// legacy deep links, missing params, and query parameters.

import { describe, it, expect, beforeEach } from "vitest";
import { serializeRoute, ROUTE_PATTERNS, ROUTE_GROUPS } from "../index";

describe("SPA Router", () => {
  describe("ROUTE_PATTERNS", () => {
    it("should have all routes with unique names", () => {
      const names = ROUTE_PATTERNS.map((r) => r.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it("should have all routes with unique paths", () => {
      const paths = ROUTE_PATTERNS.map((r) => r.path);
      expect(new Set(paths).size).toBe(paths.length);
    });

    it("should have all routes with required fields", () => {
      for (const route of ROUTE_PATTERNS) {
        expect(route.name).toBeTruthy();
        expect(route.path).toBeTruthy();
        expect(route.path.startsWith("/")).toBe(true);
        expect(route.title).toBeTruthy();
        expect(route.group).toBeTruthy();
        expect(route.icon).toBeTruthy();
      }
    });

    it("should have more specific routes before less specific ones", () => {
      // investigation-report must come before investigation
      const reportIdx = ROUTE_PATTERNS.findIndex((r) => r.name === "investigation-report");
      const investigationIdx = ROUTE_PATTERNS.findIndex((r) => r.name === "investigation");
      expect(reportIdx).toBeLessThan(investigationIdx);

      // monitor-alerts must come before monitor
      const alertsIdx = ROUTE_PATTERNS.findIndex((r) => r.name === "monitor-alerts");
      const monitorIdx = ROUTE_PATTERNS.findIndex((r) => r.name === "monitor");
      expect(alertsIdx).toBeLessThan(monitorIdx);

      // kb-entity must come before kb-entities
      const entityIdx = ROUTE_PATTERNS.findIndex((r) => r.name === "kb-entity");
      const entitiesIdx = ROUTE_PATTERNS.findIndex((r) => r.name === "kb-entities");
      expect(entityIdx).toBeLessThan(entitiesIdx);
    });
  });

  describe("ROUTE_GROUPS", () => {
    it("should have all groups from the patterns represented", () => {
      const patternGroups = new Set(ROUTE_PATTERNS.map((r) => r.group));
      const groupGroups = new Set(ROUTE_GROUPS.map((g) => g.group));
      for (const pg of patternGroups) {
        if (pg !== "error") {
          expect(groupGroups.has(pg)).toBe(true);
        }
      }
    });

    it("should have all groups with required fields", () => {
      for (const group of ROUTE_GROUPS) {
        expect(group.group).toBeTruthy();
        expect(group.label).toBeTruthy();
        expect(group.icon).toBeTruthy();
      }
    });
  });

  describe("serializeRoute", () => {
    it("should serialize home route", () => {
      expect(serializeRoute({ name: "home" })).toBe("#/");
    });

    it("should serialize new route", () => {
      expect(serializeRoute({ name: "new" })).toBe("#/new");
    });

    it("should serialize investigations list", () => {
      expect(serializeRoute({ name: "investigations" })).toBe("#/investigations");
    });

    it("should serialize investigation detail with id", () => {
      const result = serializeRoute({ name: "investigation", params: { id: "abc-123" } });
      expect(result).toBe("#/investigations/abc-123");
    });

    it("should serialize investigation report with id", () => {
      const result = serializeRoute({ name: "investigation-report", params: { id: "abc-123" } });
      expect(result).toBe("#/investigations/abc-123/report");
    });

    it("should serialize agent detail with id", () => {
      const result = serializeRoute({ name: "agent", params: { id: "xyz" } });
      expect(result).toBe("#/agent/xyz");
    });

    it("should serialize KB entity detail with id", () => {
      const result = serializeRoute({ name: "kb-entity", params: { id: "ent-1" } });
      expect(result).toBe("#/kb/entities/ent-1");
    });

    it("should serialize pricing with cycle query param", () => {
      const result = serializeRoute({ name: "pricing", query: { cycle: "annual" } });
      expect(result).toBe("#/pricing?cycle=annual");
    });

    it("should serialize pricing without query param", () => {
      const result = serializeRoute({ name: "pricing" });
      expect(result).toBe("#/pricing");
    });

    it("should serialize billing route", () => {
      expect(serializeRoute({ name: "billing" })).toBe("#/billing");
    });

    it("should serialize billing sub-routes", () => {
      expect(serializeRoute({ name: "billing-invoices" })).toBe("#/billing/invoices");
      expect(serializeRoute({ name: "billing-credits" })).toBe("#/billing/credits");
      expect(serializeRoute({ name: "billing-api-keys" })).toBe("#/billing/api-keys");
    });

    it("should serialize auth routes", () => {
      expect(serializeRoute({ name: "login" })).toBe("#/login");
      expect(serializeRoute({ name: "signup" })).toBe("#/signup");
      expect(serializeRoute({ name: "forgot-password" })).toBe("#/forgot-password");
      expect(serializeRoute({ name: "reset-password" })).toBe("#/reset-password");
      expect(serializeRoute({ name: "verify-email" })).toBe("#/verify-email");
      expect(serializeRoute({ name: "account" })).toBe("#/account");
    });

    it("should serialize 404 route", () => {
      expect(serializeRoute({ name: "not-found" })).toBe("#/404");
    });

    it("should serialize error route with query params", () => {
      const result = serializeRoute({ name: "error", query: { code: "500", message: "Failed" } });
      expect(result).toBe("#/error?code=500&message=Failed");
    });

    it("should serialize monitor sub-routes", () => {
      expect(serializeRoute({ name: "monitor-snapshots", params: { id: "mon-1" } })).toBe("#/monitor/mon-1/snapshots");
      expect(serializeRoute({ name: "monitor-alerts", params: { id: "mon-1" } })).toBe("#/monitor/mon-1/alerts");
    });

    it("should URL-encode special characters in ids", () => {
      const result = serializeRoute({ name: "investigation", params: { id: "test/with/slashes" } });
      expect(result).toBe("#/investigations/test%2Fwith%2Fslashes");
    });

    it("should serialize new route with mode and target params", () => {
      const result = serializeRoute({
        name: "new",
        params: { mode: "agent", target: "google.com" },
      });
      expect(result).toBe("#/new?mode=agent&target=google.com");
    });

    it("should serialize tags route with tag query param", () => {
      const result = serializeRoute({ name: "tags", query: { tag: "cybersecurity" } });
      expect(result).toBe("#/tags?tag=cybersecurity");
    });

    it("should serialize collection detail with id", () => {
      const result = serializeRoute({ name: "collection", params: { id: "col-1" } });
      expect(result).toBe("#/collections/col-1");
    });

    it("should serialize provenance trace with evidenceId", () => {
      const result = serializeRoute({ name: "provenance-trace", params: { evidenceId: "ev-1" } });
      expect(result).toBe("#/provenance/trace/ev-1");
    });
  });
});
