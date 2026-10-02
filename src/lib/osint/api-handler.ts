// API route handler wrapper — standardizes error handling across all routes.
//
// Usage:
//   export const GET = apiHandler(async (req, { params }) => {
//     const rec = await getRecord(params.id);
//     if (!rec) return notFoundResponse("investigation");
//     return NextResponse.json({ ... });
//   });
//
// The wrapper catches all errors and returns a safeErrorResponse, so route
// handlers never need their own try/catch for the happy path. Only wrap
// handlers in try/catch when you need custom error logic (e.g., entitlement
// checks that should return 402).

import { NextResponse } from "next/server";
import { safeErrorResponse } from "./safe-error";

// Re-export error response helpers so routes can import everything from one place.
export { notFoundResponse, unauthorizedResponse, paymentRequiredResponse, badRequestResponse } from "./safe-error";

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * Wrap an API route handler with standardized error handling.
 * Any uncaught error becomes a 500 with a safe error message.
 */
export function apiHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse | Response>
): (...args: TArgs) => Promise<NextResponse | Response> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (e) {
      return safeErrorResponse(e, "Internal server error", 500);
    }
  };
}

/**
 * Wrap a GET handler that takes (req, { params }).
 */
export function apiGet(
  handler: (req: Request, ctx: RouteContext) => Promise<NextResponse | Response>
) {
  return apiHandler(handler);
}

/**
 * Wrap a POST handler that takes (req, { params }).
 */
export function apiPost(
  handler: (req: Request, ctx: RouteContext) => Promise<NextResponse | Response>
) {
  return apiHandler(handler);
}

/**
 * Wrap a DELETE handler that takes (req, { params }).
 */
export function apiDelete(
  handler: (req: Request, ctx: RouteContext) => Promise<NextResponse | Response>
) {
  return apiHandler(handler);
}

/**
 * Wrap a PATCH handler that takes (req, { params }).
 */
export function apiPatch(
  handler: (req: Request, ctx: RouteContext) => Promise<NextResponse | Response>
) {
  return apiHandler(handler);
}
