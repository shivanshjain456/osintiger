// GET /api/health — Health check endpoint for monitoring/load balancers.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {
    server: "ok",
  };

  try {
    await db.investigation.count();
    checks.database = "ok";
  } catch {
    checks.database = "fail";
  }

  const allOk = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: allOk ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? `${Math.round(process.uptime())}s` : "unknown",
    },
    { status: allOk ? 200 : 503 }
  );
}
