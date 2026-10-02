// GET /api/playbooks — list all available investigation playbooks.
// Returns playbook definitions grouped by category.

import { NextResponse } from "next/server";
import { getAllPlaybooks, getPlaybooksByCategory, getRecommendedPlaybook } from "@/lib/osint/playbooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const inputType = url.searchParams.get("input_type");

  const playbooks = getAllPlaybooks();
  const byCategory = getPlaybooksByCategory();
  const recommended = inputType ? getRecommendedPlaybook(inputType) : null;

  return NextResponse.json({
    playbooks: playbooks.map((p) => ({
      type: p.type,
      name: p.name,
      shortName: p.shortName,
      description: p.description,
      icon: p.icon,
      color: p.color,
      category: p.category,
      applicableInputTypes: p.applicableInputTypes,
      expectedCertainty: p.expectedCertainty,
      typicalQuestions: p.typicalQuestions,
      collectionRationale: p.collection.rationale,
      scoringRationale: p.scoring.rationale,
      reportingRationale: p.reporting.rationale,
      workflowRationale: p.workflow.rationale,
    })),
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([cat, pbs]) => [
        cat,
        pbs.map((p) => ({ type: p.type, name: p.name, shortName: p.shortName, color: p.color, icon: p.icon })),
      ])
    ),
    recommended: recommended,
    total: playbooks.length,
  });
}
