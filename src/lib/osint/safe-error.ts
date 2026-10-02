// Safe error response utility — prevents information disclosure in production.
// In production, returns generic error messages to clients while logging full details.
// In development, returns the full error message for debugging.
//
// Standardized error response shape (all errors across the API):
//   {
//     error: string,       // human-readable message
//     code?: string,       // machine-readable error code (e.g. "not_found", "limit_exceeded")
//     upgradeTier?: string // for entitlement errors, the recommended plan to upgrade to
//   }

import { NextResponse } from "next/server";

/**
 * Create a safe error response that doesn't leak internal details in production.
 *
 * @param error - The caught error (for 500 responses) OR the error message string (for client errors)
 * @param defaultMessage - Generic message to show in production
 * @param status - HTTP status code (default: 500)
 * @param code - Optional machine-readable error code
 * @returns NextResponse with standardized error body
 */
export function safeErrorResponse(
  error: unknown,
  defaultMessage: string,
  status: number = 500,
  code?: string
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  const errorDetails = error instanceof Error ? error.message : String(error);

  // Always log the full error for debugging
  console.error(`[api-error] ${defaultMessage}:`, errorDetails);

  // In production, return generic message to prevent information disclosure
  // In development, return full error for faster debugging
  const message = isProduction
    ? defaultMessage
    : (error instanceof Error ? `${defaultMessage}: ${errorDetails}` : defaultMessage);

  const body: { error: string; code?: string } = { error: message };
  if (code) body.code = code;
  return NextResponse.json(body, { status });
}

/**
 * Standard 404 response for a missing resource.
 * @param resourceType - e.g. "investigation", "entity", "monitor"
 */
export function notFoundResponse(resourceType: string): NextResponse {
  return NextResponse.json(
    { error: `${resourceType} not found`, code: "not_found" },
    { status: 404 }
  );
}

/**
 * Standard 401 response for unauthenticated requests.
 */
export function unauthorizedResponse(message = "Authentication required"): NextResponse {
  return NextResponse.json(
    { error: message, code: "unauthorized" },
    { status: 401 }
  );
}

/**
 * Standard 402 response for entitlement/subscription failures.
 */
export function paymentRequiredResponse(
  message: string,
  upgradeTier?: string,
  code = "plan_required"
): NextResponse {
  const body: { error: string; code: string; upgradeTier?: string } = { error: message, code };
  if (upgradeTier) body.upgradeTier = upgradeTier;
  return NextResponse.json(body, { status: 402 });
}

/**
 * Standard 400 response for validation failures.
 */
export function badRequestResponse(message: string, code = "invalid_request"): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status: 400 }
  );
}
