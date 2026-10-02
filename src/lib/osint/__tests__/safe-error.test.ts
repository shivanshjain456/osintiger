// Tests for the safe-error module — the standardized API error response contract.
// These tests verify that error responses follow the correct shape, status codes,
// and don't leak internal details in production.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  safeErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
  paymentRequiredResponse,
  badRequestResponse,
} from "../safe-error";

describe("safe-error", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.stubEnv("NODE_ENV", originalEnv);
    vi.restoreAllMocks();
  });

  describe("safeErrorResponse", () => {
    it("should return a 500 with the default message in production", () => {
      vi.stubEnv("NODE_ENV", "production");
      const error = new Error("Database connection failed at postgres://user:pass@host:5432");
      const response = safeErrorResponse(error, "Internal server error");

      expect(response.status).toBe(500);
      // In production, the internal error details should NOT be exposed
      return response.json().then((body) => {
        expect(body.error).toBe("Internal server error");
        expect(body.error).not.toContain("postgres://");
        expect(body.error).not.toContain("user:pass");
      });
    });

    it("should include error details in development for debugging", () => {
      vi.stubEnv("NODE_ENV", "development");
      const error = new Error("Database connection failed");
      const response = safeErrorResponse(error, "Internal server error");

      expect(response.status).toBe(500);
      return response.json().then((body) => {
        expect(body.error).toContain("Database connection failed");
      });
    });

    it("should accept a custom status code", () => {
      vi.stubEnv("NODE_ENV", "production");
      const response = safeErrorResponse(new Error("test"), "Bad request", 400);
      expect(response.status).toBe(400);
    });

    it("should include error code when provided", () => {
      vi.stubEnv("NODE_ENV", "production");
      const response = safeErrorResponse(new Error("test"), "Failed", 500, "internal_error");
      return response.json().then((body) => {
        expect(body.code).toBe("internal_error");
      });
    });

    it("should not include code when not provided", () => {
      vi.stubEnv("NODE_ENV", "production");
      const response = safeErrorResponse(new Error("test"), "Failed");
      return response.json().then((body) => {
        expect(body.code).toBeUndefined();
      });
    });

    it("should handle non-Error thrown values", () => {
      vi.stubEnv("NODE_ENV", "production");
      const response = safeErrorResponse("string error", "Failed");
      expect(response.status).toBe(500);
      return response.json().then((body) => {
        expect(body.error).toBe("Failed");
      });
    });

    it("should log the error to console", () => {
      vi.stubEnv("NODE_ENV", "production");
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      safeErrorResponse(new Error("test error"), "Failed");
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Failed"), "test error");
    });
  });

  describe("notFoundResponse", () => {
    it("should return 404 with not_found code", () => {
      const response = notFoundResponse("investigation");
      expect(response.status).toBe(404);
      return response.json().then((body) => {
        expect(body.error).toBe("investigation not found");
        expect(body.code).toBe("not_found");
      });
    });

    it("should use the provided resource type in the message", () => {
      const response = notFoundResponse("monitor session");
      return response.json().then((body) => {
        expect(body.error).toBe("monitor session not found");
      });
    });
  });

  describe("unauthorizedResponse", () => {
    it("should return 401 with unauthorized code", () => {
      const response = unauthorizedResponse();
      expect(response.status).toBe(401);
      return response.json().then((body) => {
        expect(body.error).toBe("Authentication required");
        expect(body.code).toBe("unauthorized");
      });
    });

    it("should accept a custom message", () => {
      const response = unauthorizedResponse("Sign in to view collections");
      return response.json().then((body) => {
        expect(body.error).toBe("Sign in to view collections");
      });
    });
  });

  describe("paymentRequiredResponse", () => {
    it("should return 402 with plan_required code by default", () => {
      const response = paymentRequiredResponse("Upgrade required");
      expect(response.status).toBe(402);
      return response.json().then((body) => {
        expect(body.error).toBe("Upgrade required");
        expect(body.code).toBe("plan_required");
      });
    });

    it("should include upgradeTier when provided", () => {
      const response = paymentRequiredResponse("Limit reached", "investigator");
      return response.json().then((body) => {
        expect(body.upgradeTier).toBe("investigator");
      });
    });

    it("should not include upgradeTier when not provided", () => {
      const response = paymentRequiredResponse("Limit reached");
      return response.json().then((body) => {
        expect(body.upgradeTier).toBeUndefined();
      });
    });

    it("should accept a custom code", () => {
      const response = paymentRequiredResponse("Insufficient credits", undefined, "insufficient_credits");
      return response.json().then((body) => {
        expect(body.code).toBe("insufficient_credits");
      });
    });
  });

  describe("badRequestResponse", () => {
    it("should return 400 with invalid_request code by default", () => {
      const response = badRequestResponse("Invalid input");
      expect(response.status).toBe(400);
      return response.json().then((body) => {
        expect(body.error).toBe("Invalid input");
        expect(body.code).toBe("invalid_request");
      });
    });

    it("should accept a custom code", () => {
      const response = badRequestResponse("Too long", "validation_error");
      return response.json().then((body) => {
        expect(body.code).toBe("validation_error");
      });
    });
  });
});
