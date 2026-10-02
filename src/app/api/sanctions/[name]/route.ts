// GET /api/sanctions/[name] — OFAC SDN fuzzy screening.

import { NextResponse } from "next/server";
import { screenSanctions } from "@/lib/osint/ofac";
import { apiGet, badRequestResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { name } = await params;
  const decoded = decodeURIComponent(name).trim();
  if (!decoded) return badRequestResponse("name is required");
  const result = screenSanctions(decoded, 0.6);
  return NextResponse.json(result);
});
