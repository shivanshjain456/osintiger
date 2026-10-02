// GET /api/system/diagnostics — runtime + environment diagnostics (no secrets).
// Uses the config validation module to provide a structured configuration status.

import { NextResponse } from "next/server";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { getConfigSummary } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Allowlist of safe, non-secret environment variables to expose.
const SAFE_ENV_KEYS = [
  "NODE_ENV",
  "NEXT_RUNTIME",
  "NEXT_PHASE",
  "VERCEL_ENV",
  "TZ",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
] as const;

export async function GET() {
  try {
    const mem = process.memoryUsage();

    // Build a filtered env object — never expose raw secrets.
    const safeEnv: Record<string, string> = {};
    for (const key of SAFE_ENV_KEYS) {
      const val = process.env[key];
      if (val !== undefined) safeEnv[key] = val;
    }

    // Use the config validation module for structured status
    const configSummary = getConfigSummary();

    return NextResponse.json({
      runtime: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        memoryRssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        memoryHeapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        memoryHeapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        memoryExternalMB: Math.round((mem.external / 1024 / 1024) * 100) / 100,
      },
      env: safeEnv,
      config: configSummary,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch diagnostics");
  }
}
