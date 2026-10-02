// POST /api/agent/investigate/[id]/ask — Evidence-grounded Q&A about a completed
// agent investigation. Uses the new QA engine (Feature 21).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { answerQuestion, type QAContext, type ConversationTurn } from "@/lib/osint/qa-engine";
import type { ReportData, SourceResult } from "@/lib/osint/types";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const row = await db.autonomousInvestigation.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }
  if (!row.reportJson) {
    return NextResponse.json(
      { error: "report not yet available — agent may still be running" },
      { status: 409 }
    );
  }

  let body: { question?: string; conversationHistory?: ConversationTurn[]; useKnowledgeBase?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const question = (body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const report: ReportData = JSON.parse(row.reportJson);
  const state = JSON.parse(row.stateJson || "{}");
  const sourceResults: SourceResult[] = state.evidence || [];

  const context: QAContext = {
    investigationId: id,
    investigationKind: "agent",
    report,
    sourceResults,
    target: row.target,
    inputType: row.inputType,
    conversationHistory: body.conversationHistory || [],
    useKnowledgeBase: body.useKnowledgeBase !== false,
  };

  try {
    const qaAnswer = await answerQuestion(question, context);
    return NextResponse.json({
      investigation_id: id,
      question,
      answer: qaAnswer.answer,
      evidence_based: !qaAnswer.answerMode.includes("refusal") && qaAnswer.citations.length > 0,
      sources_cited: qaAnswer.citations.map((c) => c.sourceLabel),
      answered_at: qaAnswer.answeredAt,
      structured_answer: qaAnswer,
    });
  } catch (e) {
    return safeErrorResponse(e, "QA failed");
  }
}
