// Tests for the API handler wrapper — ensures all routes have standardized
// error handling. Bugs here would cause unhandled 500s with stack traces
// exposed to clients (CWE-209).

import { describe, it, expect, vi } from "vitest";
import { apiHandler, apiGet, apiPost, apiDelete, apiPatch } from "../api-handler";
import { notFoundResponse } from "../safe-error";
import { NextResponse } from "next/server";

describe("API Handler", () => {
  describe("apiHandler", () => {
    it("should return the handler's response on success", async () => {
      const handler = vi.fn(async () => NextResponse.json({ ok: true }));
      const wrapped = apiHandler(handler);
      const response = await wrapped();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.ok).toBe(true);
    });

    it("should catch errors and return a safe 500 response", async () => { vi.stubEnv("NODE_ENV", "production");
      const handler = vi.fn(async () => {
        throw new Error("Database exploded at postgres://secret:pass@host");
      });
      const wrapped = apiHandler(handler);
      const response = await wrapped();
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("Internal server error");
      expect(body.error).not.toContain("postgres://");
      expect(body.error).not.toContain("secret:pass");
    });

    it("should catch non-Error thrown values", async () => {
      const handler = vi.fn(async () => {
        throw "string error";
      });
      const wrapped = apiHandler(handler);
      const response = await wrapped();
      expect(response.status).toBe(500);
    });

    it("should pass through NextResponse objects unchanged", async () => {
      const handler = vi.fn(async () => notFoundResponse("test"));
      const wrapped = apiHandler(handler);
      const response = await wrapped();
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.code).toBe("not_found");
    });

    it("should pass arguments to the handler", async () => {
      const handler = vi.fn(async (req: Request) => {
        const body = await req.json();
        return NextResponse.json({ received: body });
      });
      const wrapped = apiHandler(handler);
      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ test: true }),
        headers: { "Content-Type": "application/json" },
      });
      const response = await wrapped(req);
      const body = await response.json();
      expect(body.received.test).toBe(true);
    });
  });

  describe("apiGet", () => {
    it("should wrap a GET handler with error handling", async () => {
      const handler = vi.fn(async () => NextResponse.json({ data: "test" }));
      const wrapped = apiGet(handler);
      const response = await wrapped(new Request("http://localhost"), { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
    });

    it("should catch errors in GET handlers", async () => {
      const handler = vi.fn(async () => {
        throw new Error("fail");
      });
      const wrapped = apiGet(handler);
      const response = await wrapped(new Request("http://localhost"), { params: Promise.resolve({}) });
      expect(response.status).toBe(500);
    });
  });

  describe("apiPost", () => {
    it("should wrap a POST handler with error handling", async () => {
      const handler = vi.fn(async () => NextResponse.json({ created: true }, { status: 201 }));
      const wrapped = apiPost(handler);
      const response = await wrapped(new Request("http://localhost", { method: "POST" }), { params: Promise.resolve({}) });
      expect(response.status).toBe(201);
    });
  });

  describe("apiDelete", () => {
    it("should wrap a DELETE handler with error handling", async () => {
      const handler = vi.fn(async () => NextResponse.json({ success: true }));
      const wrapped = apiDelete(handler);
      const response = await wrapped(new Request("http://localhost", { method: "DELETE" }), { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
    });
  });

  describe("apiPatch", () => {
    it("should wrap a PATCH handler with error handling", async () => {
      const handler = vi.fn(async () => NextResponse.json({ updated: true }));
      const wrapped = apiPatch(handler);
      const response = await wrapped(new Request("http://localhost", { method: "PATCH" }), { params: Promise.resolve({}) });
      expect(response.status).toBe(200);
    });
  });

  describe("Re-exported helpers", () => {
    it("should re-export notFoundResponse", async () => {
      const { notFoundResponse: reExported } = await import("../api-handler");
      const response = reExported("test");
      expect(response.status).toBe(404);
    });

    it("should re-export unauthorizedResponse", async () => {
      const { unauthorizedResponse: reExported } = await import("../api-handler");
      const response = reExported();
      expect(response.status).toBe(401);
    });

    it("should re-export paymentRequiredResponse", async () => {
      const { paymentRequiredResponse: reExported } = await import("../api-handler");
      const response = reExported("test");
      expect(response.status).toBe(402);
    });

    it("should re-export badRequestResponse", async () => {
      const { badRequestResponse: reExported } = await import("../api-handler");
      const response = reExported("test");
      expect(response.status).toBe(400);
    });
  });
});
