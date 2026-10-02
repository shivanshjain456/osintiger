// POST /api/qa — Evidence-grounded question answering over collected intelligence.
//
// Accepts a question and optional context (investigation ID, conversation history,
// KB toggle) and returns a structured answer with citations, reasoning chain,
// contradictions, and limitations.
//
// Body:
//   question: string (required, max 1000 chars)
//   investigationId?: string
//   investigationKind?: "standard" | "agent" | "discovery" | "plan" | "monitor"
//   conversationHistory?: { question: string; answer: string; timestamp: string }[]
//   useKnowledgeBase?: boolean (default: true)

import { NextResponse } from "next/server";
import { answerQuestion, type QAContext, type ConversationTurn } from "@/lib/osint/qa-engine";
import { getRecord } from "@/lib/osint/store";
import { db } from "@/lib/db";
import type { ReportData, SourceResult } from "@/lib/osint/types";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: {
    question?: string;
    investigationId?: string;
    investigationKind?: "standard" | "agent" | "discovery" | "plan" | "monitor";
    conversationHistory?: ConversationTurn[];
    useKnowledgeBase?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const question = (body.question || "").trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > 1000) {
    return NextResponse.json({ error: "question too long (max 1000 chars)" }, { status: 400 });
  }

  const investigationId = body.investigationId;
  const investigationKind = body.investigationKind || "standard";
  const useKnowledgeBase = body.useKnowledgeBase !== false; // default true
  const conversationHistory = body.conversationHistory || [];

  // Build context
  let report: ReportData | null = null;
  let sourceResults: SourceResult[] = [];
  let target: string | undefined;
  let inputType: string | undefined;

  if (investigationId) {
    if (investigationKind === "standard") {
      const rec = await getRecord(investigationId);
      if (rec) {
        report = rec.report;
        sourceResults = rec.source_results;
        target = rec.target;
        inputType = rec.input_type;
      }
    } else if (investigationKind === "agent") {
      try {
        const row = await db.autonomousInvestigation.findUnique({ where: { id: investigationId } });
        if (row) {
          target = row.target;
          inputType = row.inputType;
          if (row.reportJson) {
            report = JSON.parse(row.reportJson);
          }
          const state = JSON.parse(row.stateJson || "{}");
          sourceResults = state.evidence || [];
        }
      } catch (e) {
        console.error("[qa] agent investigation fetch failed", e);
      }
    } else if (investigationKind === "plan") {
      try {
        const row = await db.planSession.findUnique({ where: { id: investigationId } });
        if (row) {
          target = row.target;
          inputType = row.inputType;
          if (row.reportJson) {
            report = JSON.parse(row.reportJson);
          }
        }
      } catch (e) {
        console.error("[qa] plan session fetch failed", e);
      }
    }
  }

  const context: QAContext = {
    investigationId,
    investigationKind,
    report,
    sourceResults,
    target,
    inputType,
    conversationHistory,
    useKnowledgeBase,
  };

  try {
    const answer = await answerQuestion(question, context);
    return NextResponse.json({
      investigation_id: investigationId,
      question,
      answer,
    });
  } catch (e) {
    return safeErrorResponse(e, "QA failed");
  }
}

// GET — simple health/info endpoint
export async function GET() {
  return NextResponse.json({
    status: "online",
    description: "Evidence-grounded question answering over collected intelligence",
    rules: [
      "Never hallucinate — answers come ONLY from collected evidence",
      "Mandatory citations — every claim cites its source evidence",
      "Contradiction-aware — both sides preserved when sources disagree",
      "Refusal when insufficient — clear 'I cannot answer' when evidence is thin",
      "Traceable reasoning — every answer shows the evidence chain",
    ],
  });
}
