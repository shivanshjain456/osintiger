// Tests for the router registry — route pattern definitions and lookups.
// Bugs here would cause navigation failures and broken deep links.

import { describe, it, expect } from "vitest";
import { ROUTE_PATTERNS, ROUTE_BY_NAME, ROUTE_GROUPS } from "../registry";

describe("Router Registry", () => {
  describe("ROUTE_BY_NAME", () => {
    it("should have an entry for every route pattern", () => {
      for (const pattern of ROUTE_PATTERNS) {
        expect(ROUTE_BY_NAME[pattern.name]).toBeDefined();
        expect(ROUTE_BY_NAME[pattern.name]).toBe(pattern);
      }
    });

    it("should return undefined for unknown route names", () => {
      expect(ROUTE_BY_NAME["nonexistent_route"]).toBeUndefined();
    });

    it("should include key routes", () => {
      expect(ROUTE_BY_NAME["home"]).toBeDefined();
      expect(ROUTE_BY_NAME["investigations"]).toBeDefined();
      expect(ROUTE_BY_NAME["pricing"]).toBeDefined();
      expect(ROUTE_BY_NAME["billing"]).toBeDefined();
      expect(ROUTE_BY_NAME["login"]).toBeDefined();
      expect(ROUTE_BY_NAME["signup"]).toBeDefined();
      expect(ROUTE_BY_NAME["not-found"]).toBeDefined();
      expect(ROUTE_BY_NAME["error"]).toBeDefined();
    });
  });

  describe("ROUTE_PATTERNS path validation", () => {
    it("should have all paths starting with /", () => {
      for (const route of ROUTE_PATTERNS) {
        expect(route.path.startsWith("/")).toBe(true);
      }
    });

    it("should have param routes with : prefix in path segments", () => {
      const paramRoutes = ROUTE_PATTERNS.filter((r) => r.requiresParam);
      for (const route of paramRoutes) {
        const segments = route.path.split("/").filter(Boolean);
        const hasParam = segments.some((s) => s.startsWith(":"));
        expect(hasParam).toBe(true);
      }
    });

    it("should have the home route at path /", () => {
      const home = ROUTE_BY_NAME["home"];
      expect(home?.path).toBe("/");
    });

    it("should have billing sub-routes with correct paths", () => {
      expect(ROUTE_BY_NAME["billing-invoices"]?.path).toBe("/billing/invoices");
      expect(ROUTE_BY_NAME["billing-credits"]?.path).toBe("/billing/credits");
      expect(ROUTE_BY_NAME["billing-api-keys"]?.path).toBe("/billing/api-keys");
    });

    it("should have auth routes with correct paths", () => {
      expect(ROUTE_BY_NAME["login"]?.path).toBe("/login");
      expect(ROUTE_BY_NAME["signup"]?.path).toBe("/signup");
      expect(ROUTE_BY_NAME["forgot-password"]?.path).toBe("/forgot-password");
      expect(ROUTE_BY_NAME["reset-password"]?.path).toBe("/reset-password");
      expect(ROUTE_BY_NAME["verify-email"]?.path).toBe("/verify-email");
      expect(ROUTE_BY_NAME["account"]?.path).toBe("/account");
    });
  });

  describe("ROUTE_GROUPS", () => {
    it("should have the billing group", () => {
      const billingGroup = ROUTE_GROUPS.find((g) => g.group === "billing");
      expect(billingGroup).toBeDefined();
      expect(billingGroup?.label).toBeTruthy();
    });

    it("should have all groups with unique labels", () => {
      const labels = ROUTE_GROUPS.map((g) => g.label);
      expect(new Set(labels).size).toBe(labels.length);
    });

    it("should have all groups with icons", () => {
      for (const group of ROUTE_GROUPS) {
        expect(group.icon).toBeTruthy();
      }
    });
  });
});
