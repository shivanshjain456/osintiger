// POST /api/investigate/[id]/ask — Evidence-grounded Q&A about a completed investigation.
// Uses the new QA engine (Feature 21) with KB integration, citation enforcement,
// contradiction detection, and reasoning chain.
//
// Body:
//   question: string (required)
//   conversationHistory?: { question: string; answer: string; timestamp: string }[]
//   useKnowledgeBase?: boolean (default: true)

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import { answerQuestion, type QAContext, type ConversationTurn } from "@/lib/osint/qa-engine";
import { safeErrorResponse } from "@/lib/osint/safe-error";
import { getSessionUser } from "@/lib/auth";
import {
  resolveEntitlement,
  checkAICredits,
  consumeAICredits,
} from "@/lib/saas/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }
  if (!rec.report) {
    return NextResponse.json(
      { error: "report not yet available — investigation may still be in progress" },
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
  if (question.length > 1000) {
    return NextResponse.json({ error: "question too long (max 1000 chars)" }, { status: 400 });
  }

  // ─── Entitlement gate ────────────────────────────────────────────────────
  // Q&A costs 2 AI credits per question. Anonymous users get the anonymous
  // free-tier balance (typically 3 credits).
  let ent: Awaited<ReturnType<typeof resolveEntitlement>> | null = null;
  let user: Awaited<ReturnType<typeof getSessionUser>> = null;
  try {
    user = await getSessionUser();
    ent = await resolveEntitlement(user?.id || null);

    const creditCheck = await checkAICredits(ent, "ai_qa");
    if (!creditCheck.allowed) {
      return NextResponse.json(
        {
          error: creditCheck.reason || "Insufficient AI credits for Q&A",
          code: "insufficient_credits",
          upgradeTier: creditCheck.upgradeTier,
          usage: creditCheck.usage,
        },
        { status: 402 }
      );
    }
  } catch (entErr) {
    console.error("[ask] entitlement check failed", entErr);
  }

  const context: QAContext = {
    investigationId: id,
    investigationKind: "standard",
    report: rec.report,
    sourceResults: rec.source_results,
    target: rec.target,
    inputType: rec.input_type,
    conversationHistory: body.conversationHistory || [],
    useKnowledgeBase: body.useKnowledgeBase !== false,
  };

  try {
    const qaAnswer = await answerQuestion(question, context);

    // ─── AI credit consumption (best-effort) ────────────────────────────────
    // Debit the Q&A cost (2 credits) after a successful answer.
    try {
      if (user?.id) {
        await consumeAICredits(
          user.id,
          "ai_qa",
          ent?.subscription?.id || null,
          id
        );
      }
    } catch (creditErr) {
      console.error("[ask] credit consumption failed", creditErr);
    }

    // Backward-compatible response shape (old AskAIPanel expects these fields)
    // plus the new structured answer for the enhanced panel
    return NextResponse.json({
      investigation_id: id,
      question,
      // Legacy fields (for backward compat with old client)
      answer: qaAnswer.answer,
      evidence_based: !qaAnswer.answerMode.includes("refusal") && qaAnswer.citations.length > 0,
      sources_cited: qaAnswer.citations.map((c) => c.sourceLabel),
      answered_at: qaAnswer.answeredAt,
      // New structured answer (Feature 21)
      structured_answer: qaAnswer,
    });
  } catch (e) {
    return safeErrorResponse(e, "QA failed");
  }
}
