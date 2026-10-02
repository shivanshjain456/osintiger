import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_INVESTIGATE = 30;
const RATE_LIMIT_MAX_GENERAL = 120;
const CLEANUP_INTERVAL_MS = 5 * 60_000;
const MAX_BODY_SIZE = 10 * 1024 * 1024;

const ipRequestMap = new Map<string, { count: number; resetTime: number }>();
let lastCleanup = Date.now();

function isRateLimited(ip: string, maxRequests: number): boolean {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    for (const [key, entry] of ipRequestMap.entries()) {
      if (now > entry.resetTime) ipRequestMap.delete(key);
    }
    lastCleanup = now;
  }
  const entry = ipRequestMap.get(ip);
  if (!entry || now > entry.resetTime) {
    ipRequestMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > maxRequests;
}

function getClientIP(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const ip = getClientIP(req);
    const isInvest = req.nextUrl.pathname.startsWith("/api/investigate") && req.method === "POST";
    const max = isInvest ? RATE_LIMIT_MAX_INVESTIGATE : RATE_LIMIT_MAX_GENERAL;

    if (isRateLimited(ip, max)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Limit": String(max) } }
      );
    }

    const cl = parseInt(req.headers.get("content-length") || "0", 10);
    if (cl > MAX_BODY_SIZE) {
      return NextResponse.json({ error: "Request body too large (max 10MB)" }, { status: 413 });
    }
  }

  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-XSS-Protection", "1; mode=block");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-ancestors 'none';");
  if (process.env.NODE_ENV === "production") {
    res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|logo.svg).*)"],
};
