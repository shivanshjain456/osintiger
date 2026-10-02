// GET /api/investigate/[id]/playbook — returns the playbook configuration used for this investigation.
// Shows the full playbook definition with collection/prioritization/scoring/reporting/workflow config.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { getPlaybook, getRecommendedPlaybook, type PlaybookType } from "@/lib/osint/playbooks";
import { apiGet, notFoundResponse } from "@/lib/osint/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = apiGet(async (_req, { params }) => {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) return notFoundResponse("investigation");

  // Use the investigation's playbook, or fall back to recommended
  const playbookType = (rec.playbook as PlaybookType) || getRecommendedPlaybook(rec.input_type);
  const playbook = getPlaybook(playbookType);

  return NextResponse.json({
    investigation_id: id,
    target: rec.target,
    input_type: rec.input_type,
    playbook_type: playbookType,
    playbook,
    is_default: !rec.playbook, // true if we fell back to recommended
  });
});
