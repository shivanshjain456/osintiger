// GET /api/provenance/[investigationId] — Get provenance report for an investigation.
// Supports query params: eventType, collectorName, toolName, minConfidence, maxConfidence, limit, offset

import { NextResponse } from "next/server";
import { getProvenanceReport, queryProvenanceEvents, type ProvenanceQuery } from "@/lib/osint/provenance";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30; // provenance queries can be slow with many events

export async function GET(
  req: Request,
  { params }: { params: Promise<{ investigationId: string }> }
) {
  const { investigationId } = await params;
  const url = new URL(req.url);

  // Check if this is a filtered query or a full report
  const hasFilters = url.searchParams.has("eventType") ||
    url.searchParams.has("collectorName") ||
    url.searchParams.has("toolName") ||
    url.searchParams.has("minConfidence") ||
    url.searchParams.has("maxConfidence") ||
    url.searchParams.has("limit") ||
    url.searchParams.has("offset");

  try {
    if (hasFilters) {
      // Filtered event query
      const query: ProvenanceQuery = {
        investigationId,
        eventType: url.searchParams.get("eventType") as ProvenanceQuery["eventType"] || undefined,
        collectorName: url.searchParams.get("collectorName") || undefined,
        toolName: url.searchParams.get("toolName") || undefined,
        minConfidence: url.searchParams.get("minConfidence") ? parseFloat(url.searchParams.get("minConfidence")!) : undefined,
        maxConfidence: url.searchParams.get("maxConfidence") ? parseFloat(url.searchParams.get("maxConfidence")!) : undefined,
        startTime: url.searchParams.get("startTime") || undefined,
        endTime: url.searchParams.get("endTime") || undefined,
        limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 100,
        offset: url.searchParams.get("offset") ? parseInt(url.searchParams.get("offset")!, 10) : 0,
      };
      const events = await queryProvenanceEvents(query);
      return NextResponse.json({ investigationId, events, count: events.length });
    } else {
      // Full provenance report
      const report = await getProvenanceReport(investigationId);
      return NextResponse.json(report);
    }
  } catch (e) {
    return safeErrorResponse(e, "Provenance query failed");
  }
}
