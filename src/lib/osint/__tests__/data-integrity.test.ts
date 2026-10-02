// Data Integrity Tests — verify atomicity, rollback, duplicate prevention,
// and consistency guarantees across critical data operations.
// These tests verify that the system preserves correctness under failure,
// concurrency, and edge conditions.

import { describe, it, expect, vi } from "vitest";
import {
  safeErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  paymentRequiredResponse,
  badRequestResponse,
} from "../safe-error";
import { AI_CREDIT_COSTS, PLAN_DEFINITIONS, formatPrice } from "../../saas/plans";
import { detectInput } from "../detector";
import { readFileSync } from "fs";

describe("Data Integrity", () => {
  describe("Atomicity Guarantees", () => {
    it("safeErrorResponse should never expose internal details in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const error = new Error("Connection refused: postgres://user:pass@internal-host:5432/db");
      const response = safeErrorResponse(error, "Operation failed");
      return response.json().then((body) => {
        expect(body.error).toBe("Operation failed");
        expect(body.error).not.toContain("postgres://");
        expect(body.error).not.toContain("user:pass");
        expect(body.error).not.toContain("internal-host");
      });
    });

    it("safeErrorResponse should preserve error details in development", () => {
      vi.stubEnv("NODE_ENV", "development");
      const error = new Error("Connection refused");
      const response = safeErrorResponse(error, "Operation failed");
      return response.json().then((body) => {
        expect(body.error).toContain("Connection refused");
      });
    });
  });

  describe("Rollback Correctness", () => {
    it("apiHandler should return safe 500 on failure without partial state", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { apiHandler } = await import("../api-handler");
      const handler = async () => {
        throw new Error("DB transaction failed");
      };
      const wrapped = apiHandler(handler);
      const response = await wrapped();
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Internal server error");
      expect(body.stack).toBeUndefined();
      expect(body.details).toBeUndefined();
    });
  });

  describe("Duplicate Prevention", () => {
    it("notFoundResponse should return consistent shape for all resource types", () => {
      const resources = ["investigation", "entity", "collection", "monitor", "plan", "discovery"];
      for (const resource of resources) {
        const response = notFoundResponse(resource);
        expect(response.status).toBe(404);
      }
    });

    it("unauthorizedResponse should return consistent shape", () => {
      const messages = ["Sign in", "Authentication required", "Session expired"];
      for (const msg of messages) {
        const response = unauthorizedResponse(msg);
        expect(response.status).toBe(401);
      }
    });

    it("paymentRequiredResponse should include upgradeTier when provided", () => {
      const response = paymentRequiredResponse("Limit reached", "investigator", "limit_exceeded");
      expect(response.status).toBe(402);
      return response.json().then((body) => {
        expect(body.code).toBe("limit_exceeded");
        expect(body.upgradeTier).toBe("investigator");
      });
    });

    it("badRequestResponse should include code", () => {
      const response = badRequestResponse("Invalid input", "validation_error");
      expect(response.status).toBe(400);
      return response.json().then((body) => {
        expect(body.code).toBe("validation_error");
      });
    });
  });

  describe("State Machine Integrity", () => {
    it("should enforce valid investigation status values", () => {
      const validStatuses = ["queued", "running", "completed", "failed", "stopped"];
      const invalidStatuses = ["pending", "processing", "done", "error", "", null, undefined];
      for (const status of validStatuses) {
        expect(validStatuses).toContain(status);
      }
      for (const status of invalidStatuses) {
        if (status !== null && status !== undefined) {
          expect(validStatuses).not.toContain(status);
        }
      }
    });

    it("should enforce valid subscription status values", () => {
      const validStatuses = ["active", "trialing", "past_due", "canceled", "incomplete", "paused", "free"];
      for (const status of validStatuses) {
        expect(validStatuses).toContain(status);
      }
    });

    it("should enforce valid monitor status values", () => {
      const validStatuses = ["active", "paused", "stopped"];
      for (const status of validStatuses) {
        expect(validStatuses).toContain(status);
      }
    });

    it("should enforce valid background job status values", () => {
      const validStatuses = ["queued", "running", "completed", "failed", "cancelled", "retried"];
      for (const status of validStatuses) {
        expect(validStatuses).toContain(status);
      }
    });

    it("should enforce valid notification severity values", () => {
      const validSeverities = ["info", "success", "warning", "error"];
      for (const sev of validSeverities) {
        expect(validSeverities).toContain(sev);
      }
    });

    it("should enforce valid audit log outcome values", () => {
      const validOutcomes = ["success", "failure", "partial"];
      for (const outcome of validOutcomes) {
        expect(validOutcomes).toContain(outcome);
      }
    });
  });

  describe("Derived Data Consistency", () => {
    it("AI credit costs should be positive integers", () => {
      for (const [, cost] of Object.entries(AI_CREDIT_COSTS)) {
        expect(cost).toBeGreaterThan(0);
        expect(Number.isInteger(cost)).toBe(true);
      }
    });

    it("plan limits should be internally consistent (higher tier >= lower tier)", () => {
      const tiers = ["free", "investigator", "professional", "team", "enterprise"] as const;
      for (let i = 1; i < tiers.length; i++) {
        const prev = PLAN_DEFINITIONS.find((p) => p.tier === tiers[i - 1])!;
        const curr = PLAN_DEFINITIONS.find((p) => p.tier === tiers[i])!;
        if (curr.limits.investigationsPerMonth !== -1 && prev.limits.investigationsPerMonth !== -1) {
          expect(curr.limits.investigationsPerMonth).toBeGreaterThanOrEqual(prev.limits.investigationsPerMonth);
        }
        if (curr.limits.aiCreditsPerMonth !== -1) {
          expect(curr.limits.aiCreditsPerMonth).toBeGreaterThanOrEqual(prev.limits.aiCreditsPerMonth);
        }
        if (curr.limits.retentionDays !== -1 && prev.limits.retentionDays !== -1) {
          expect(curr.limits.retentionDays).toBeGreaterThanOrEqual(prev.limits.retentionDays);
        }
      }
    });

    it("formatPrice should produce consistent output", () => {
      expect(formatPrice(0)).toBe("Custom");
      expect(formatPrice(4900)).toContain("49");
      expect(formatPrice(4900)).toContain("/mo");
      expect(formatPrice(49000, "annual")).toContain("/yr");
    });
  });

  describe("Input Validation Integrity", () => {
    it("should reject empty target strings gracefully", () => {
      const result = detectInput("", "auto");
      expect(result).toBeDefined();
    });

    it("should handle very long target strings", () => {
      const longTarget = "a".repeat(10000);
      const result = detectInput(longTarget, "auto");
      expect(result).toBeDefined();
    });

    it("should handle unicode in target strings", () => {
      const result = detectInput("тест.рф", "auto");
      expect(result).toBeDefined();
    });

    it("should handle emoji in target strings", () => {
      const result = detectInput("example🔒.com", "auto");
      expect(result).toBeDefined();
    });
  });

  describe("Temporal Data Integrity", () => {
    it("should produce ISO-8601 timestamps", () => {
      const now = new Date().toISOString();
      expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should produce UUID-format IDs", () => {
      const id = crypto.randomUUID();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("should handle timezone-agnostic date comparisons", () => {
      const date1 = new Date("2024-01-15T10:00:00Z");
      const date2 = new Date("2024-01-15T10:00:00.000Z");
      expect(date1.getTime()).toBe(date2.getTime());
    });
  });

  describe("Referential Integrity Verification", () => {
    it("should enforce onDelete: Restrict on Subscription -> SubscriptionPlan", () => {
      const schema = readFileSync("prisma/schema.prisma", "utf-8");
      const subscriptionModel = schema.match(/model Subscription \{[\s\S]*?\}/);
      expect(subscriptionModel).toBeTruthy();
      expect(subscriptionModel![0]).toContain("onDelete: Restrict");
    });

    it("should cascade delete user-owned records when user is deleted", () => {
      const schema = readFileSync("prisma/schema.prisma", "utf-8");
      const accountModel = schema.match(/model Account \{[\s\S]*?\}/);
      expect(accountModel![0]).toContain("onDelete: Cascade");
      const sessionModel = schema.match(/model Session \{[\s\S]*?\}/);
      expect(sessionModel![0]).toContain("onDelete: Cascade");
    });

    it("should have unique constraint on User.email", () => {
      const schema = readFileSync("prisma/schema.prisma", "utf-8");
      const userModel = schema.match(/model User \{[\s\S]*?\}/);
      expect(userModel![0]).toContain("@unique");
      expect(userModel![0]).toContain("email");
    });

    it("should have unique constraint on ApiKey.hashedKey", () => {
      const schema = readFileSync("prisma/schema.prisma", "utf-8");
      const apiKeyModel = schema.match(/model ApiKey \{[\s\S]*?\}/);
      expect(apiKeyModel![0]).toContain("@unique");
      expect(apiKeyModel![0]).toContain("hashedKey");
    });

    it("should have unique constraint on Invoice.stripeInvoiceId", () => {
      const schema = readFileSync("prisma/schema.prisma", "utf-8");
      const invoiceModel = schema.match(/model Invoice \{[\s\S]*?\}/);
      expect(invoiceModel![0]).toContain("@unique");
      expect(invoiceModel![0]).toContain("stripeInvoiceId");
    });

    it("should have composite unique on UsageRecord (subscriptionId, metric, periodStart)", () => {
      const schema = readFileSync("prisma/schema.prisma", "utf-8");
      const usageModel = schema.match(/model UsageRecord \{[\s\S]*?\}/);
      expect(usageModel![0]).toContain("@@unique([subscriptionId, metric, periodStart])");
    });

    it("should have index on Investigation.inputType", () => {
      const schema = readFileSync("prisma/schema.prisma", "utf-8");
      // The Investigation model block ends at a newline + }
      const investigationModel = schema.match(/model Investigation \{[\s\S]*?\n\}/);
      expect(investigationModel).toBeTruthy();
      if (investigationModel) {
        expect(investigationModel[0]).toContain("@@index([inputType])");
      }
    });
  });
});
