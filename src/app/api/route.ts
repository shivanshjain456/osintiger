import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    name: "OSINTiger API",
    version: "2.0.0",
    status: "operational",
    docs: "/#/docs/api",
    timestamp: new Date().toISOString(),
  });
}
