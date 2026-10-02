// AI Question Answering Engine — evidence-grounded natural language querying
// over collected intelligence (Feature 21).
//
// Core principles:
//   1. NEVER hallucinate — answers come ONLY from collected evidence
//   2. MANDATORY citations — every claim cites its source evidence
//   3. Contradiction-aware — both sides preserved when sources disagree
//   4. Refusal when insufficient — clear "I cannot answer" when evidence is thin
//   5. Traceable reasoning — every answer shows the evidence chain
//   6. Conversational continuity — follow-ups reuse prior context
//
// Pipeline: question → interpret intent → retrieve evidence → synthesize answer
//           → enforce citations → detect contradictions → format output
//
// Evidence sources (in priority order):
//   1. KB entities + relationships + evidence artifacts (cross-investigation)
//   2. Current investigation report (key findings, timeline, contradictions)
//   3. Current investigation source results (raw findings)
//   4. Conversation history (for follow-up context)

import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import type { ReportData, SourceResult, KeyFinding, TimelineEvent, Contradiction } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";
import { safeJsonStringArray, safeJsonObject } from "./safe-json";

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export type QuestionIntent =
  | "factual_lookup"      // "What is X?"
  | "comparative"         // "Compare X and Y"
  | "timeline"            // "When did X happen?"
  | "relationship"        // "How are X and Y connected?"
  | "risk"                // "What is the risk of X?"
  | "synthesis"           // "Summarize what we know about X"
  | "evidence_request"    // "Show me the evidence for X"
  | "follow_up"           // "Why?" / "How do we know?" / "What changed?"
  | "disambiguation"      // "Which X are you referring to?"
  | "unknown";

export type AnswerMode =
  | "short"               // 1-3 sentences
  | "detailed"            // multi-paragraph analytical
  | "bullet_summary"      // bulleted list
  | "tabular_comparison"  // comparison table
  | "evidence_digest"     // evidence list with sources
  | "refusal"             // cannot answer
  | "clarification";      // needs disambiguation

export interface QuestionInterpretation {
  intent: QuestionIntent;
  targetEntities: string[];      // extracted entity names/aliases
  scope: "current_investigation" | "knowledge_base" | "both";
  timeRange?: { start?: string; end?: string };
  requestedMode: AnswerMode;
  subQuestions: string[];        // multi-part questions split
  isFollowUp: boolean;
  needsClarification: boolean;
  clarificationQuestion?: string;
  reasoning: string;             // why this interpretation
}

export interface RetrievedEvidence {
  id: string;
  source: "investigation_finding" | "investigation_timeline" | "investigation_contradiction"
       | "kb_entity" | "kb_relationship" | "kb_evidence" | "kb_conflict"
       | "source_result";
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: ReliabilityTier;
  content: string;               // the evidence text
  confidence: number;
  observedAt: string;
  // Ranking signals
  relevanceScore: number;        // 0-1, how relevant to the question
  credibilityScore: number;      // 0-1, source reliability
  recencyScore: number;          // 0-1, how recent
  diversityBonus: number;        // bonus for coming from a unique source
  overallRank: number;           // weighted combination
  // Provenance
  entityId?: string;
  relationshipId?: string;
  investigationId?: string;
}

export interface Citation {
  index: number;                 // [1], [2], etc.
  evidenceId: string;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: ReliabilityTier;
  snippet: string;               // the supporting text snippet
  confidence: number;
}

export interface ReasoningStep {
  step: number;
  description: string;           // what was done
  evidenceUsed: string[];        // evidence IDs
  reasoning: string;             // why this step was taken
}

export interface ContradictionSummary {
  topic: string;
  claimA: string;
  sourceA: string;
  claimB: string;
  sourceB: string;
  strongerSide: "a" | "b" | "neither";
  rationale: string;
  additionalEvidenceNeeded: string;
}

export interface QAAnswer {
  question: string;
  interpretation: QuestionInterpretation;
  answerMode: AnswerMode;
  answer: string;                // the main answer text (with inline [1], [2] citations)
  citations: Citation[];         // numbered citations referenced in the answer
  reasoningChain: ReasoningStep[];  // how the answer was reached
  contradictions: ContradictionSummary[];  // any conflicts in the evidence
  evidenceUsed: RetrievedEvidence[];  // all evidence considered
  evidenceRejected: { evidence: RetrievedEvidence; reason: string }[];  // evidence considered but not used
  confidence: number;            // 0-1 overall confidence in the answer
  confidenceLabel: "low" | "moderate" | "high" | "very_high";
  evidenceSufficiency: "sufficient" | "partial" | "insufficient";
  limitations: string[];         // caveats and limitations
  followUpSuggestions: string[]; // suggested follow-up questions
  answeredAt: string;
  durationMs: number;
}

export interface QAContext {
  investigationId?: string;
  investigationKind?: "standard" | "agent" | "discovery" | "plan" | "monitor";
  report?: ReportData | null;
  sourceResults?: SourceResult[];
  target?: string;
  inputType?: string;
  conversationHistory: ConversationTurn[];
  useKnowledgeBase: boolean;
}

export interface ConversationTurn {
  question: string;
  answer: string;
  interpretation?: QuestionInterpretation;
  timestamp: string;
}

export interface QAResponse {
  investigation_id?: string;
  question: string;
  answer: QAAnswer;
}

// ============================================================================
// QUESTION INTERPRETATION
// ============================================================================

/**
 * Interpret a natural language question: detect intent, extract entities,
 * determine scope, identify sub-questions, and check if clarification is needed.
 */
export function interpretQuestion(
  question: string,
  context: QAContext
): QuestionInterpretation {
  const q = question.trim().toLowerCase();
  const reasoning: string[] = [];

  // 1. Detect intent
  const intent = detectIntent(q, context);
  reasoning.push(`Intent classified as "${intent}" based on question structure and keywords.`);

  // 2. Extract target entities
  const targetEntities = extractEntities(question, context);
  reasoning.push(`Extracted ${targetEntities.length} target entit(ies): ${targetEntities.join(", ") || "none"}.`);

  // 3. Detect time range
  const timeRange = detectTimeRange(q);
  if (timeRange) {
    reasoning.push(`Time range detected: ${timeRange.start || "any"} to ${timeRange.end || "now"}.`);
  }

  // 4. Detect requested answer mode
  const requestedMode = detectAnswerMode(q, intent);
  reasoning.push(`Answer mode: ${requestedMode}.`);

  // 5. Split multi-part questions
  const subQuestions = splitSubQuestions(question);
  if (subQuestions.length > 1) {
    reasoning.push(`Question has ${subQuestions.length} parts.`);
  }

  // 6. Detect follow-up
  const isFollowUp = detectFollowUp(q, context.conversationHistory);
  if (isFollowUp) {
    reasoning.push("Detected as follow-up to prior question — will reuse conversational context.");
  }

  // 7. Check for disambiguation needs
  const needsClarification = checkNeedsClarification(targetEntities, context, intent);
  let clarificationQuestion: string | undefined;
  if (needsClarification) {
    clarificationQuestion = buildClarificationQuestion(targetEntities, context);
    reasoning.push("Clarification needed — multiple candidate entities match the question.");
  }

  // 8. Determine scope
  const scope: QuestionInterpretation["scope"] = context.useKnowledgeBase
    ? (context.investigationId ? "both" : "knowledge_base")
    : "current_investigation";
  reasoning.push(`Scope: ${scope}.`);

  return {
    intent,
    targetEntities,
    scope,
    timeRange,
    requestedMode,
    subQuestions,
    isFollowUp,
    needsClarification,
    clarificationQuestion,
    reasoning: reasoning.join(" "),
  };
}

function detectIntent(q: string, context: QAContext): QuestionIntent {
  // Follow-up detection
  if (context.conversationHistory.length > 0) {
    if (/^(why|how do we know|what changed|show (me )?(the |some )?evidence|prove it|source[s]? for|cite)/i.test(q)) {
      return "follow_up";
    }
    if (/^(and|also|what about|how about|then)/i.test(q)) {
      return "follow_up";
    }
  }

  // Comparative
  if (/\b(vs\.?|versus|compare|comparison|difference between|better than|worse than|which is (stronger|weaker|better|worse|more|less))\b/i.test(q)) {
    return "comparative";
  }

  // Timeline
  if (/\b(when|what date|what time|timeline|chronolog|history|evolution|first seen|last seen|how long ago|since when)\b/i.test(q)) {
    return "timeline";
  }

  // Relationship
  if (/\b(relationship|connected|link|associate|relate|how (are|do) .+ (relate|connect|link))\b/i.test(q)) {
    return "relationship";
  }

  // Risk
  if (/\b(risk|threat|danger|vulnerab|expose|attack|malicious|suspicious|sanction|ofac)\b/i.test(q)) {
    return "risk";
  }

  // Evidence request
  if (/\b(show|list|cite|source|evidence|proof|where did|how do you know|what evidence|prove)\b/i.test(q)) {
    return "evidence_request";
  }

  // Synthesis
  if (/\b(summari|overview|synthesi|what do we know|tell me about|give me the (full |complete )?picture|comprehensive)\b/i.test(q)) {
    return "synthesis";
  }

  // Factual lookup (default)
  if (/\b(what|who|where|which|how many|is there|are there|does|do|did|has|have|can)\b/i.test(q)) {
    return "factual_lookup";
  }

  return "unknown";
}

function extractEntities(question: string, context: QAContext): string[] {
  const entities: string[] = [];
  const text = question;

  // Extract domains
  for (const m of text.matchAll(/\b([\w-]+\.){1,}[\w]{2,}\b/gi)) {
    entities.push(m[0].toLowerCase());
  }

  // Extract IPs
  for (const m of text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g)) {
    entities.push(m[1]);
  }

  // Extract emails
  for (const m of text.matchAll(/[\w.-]+@[\w.-]+\.\w+/g)) {
    entities.push(m[0].toLowerCase());
  }

  // Extract wallet addresses
  for (const m of text.matchAll(/\b(0x[a-fA-F0-9]{40}|bc1[a-zA-HJ-NP-Z0-9]{25,62})\b/g)) {
    entities.push(m[1].toLowerCase());
  }

  // Extract CVE IDs
  for (const m of text.matchAll(/\b(CVE-\d{4}-\d{4,7})\b/gi)) {
    entities.push(m[1].toUpperCase());
  }

  // Extract quoted strings
  for (const m of text.matchAll(/["']([^"']{2,60})["']/g)) {
    entities.push(m[1]);
  }

  // Extract capitalized multi-word phrases (likely entity names)
  for (const m of text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g)) {
    const phrase = m[1].trim();
    // Skip common words
    const stopWords = new Set(["What", "Who", "Where", "When", "Why", "How", "The", "This", "That", "These", "Those", "Which", "Is", "Are", "Was", "Were", "Do", "Does", "Did", "Has", "Have", "Can", "Could", "Would", "Should", "Will", "Show", "List", "Summarize", "Compare", "Tell", "Give", "Source", "Evidence"]);
    if (!stopWords.has(phrase) && phrase.length > 2) {
      entities.push(phrase);
    }
  }

  // Add the investigation target if the question references "this", "it", "the target", "the subject"
  if (context.target && /\b(this|it|the target|the subject|them|they|their)\b/i.test(question)) {
    entities.push(context.target);
  }

  // Dedupe and filter
  return [...new Set(entities)].slice(0, 10);
}

function detectTimeRange(q: string): { start?: string; end?: string } | undefined {
  // "in 2023", "last year", "recently", "before 2020", "since 2021"
  const yearMatch = q.match(/\b(19|20)\d{2}\b/g);
  if (yearMatch) {
    if (q.includes("before") || q.includes("prior to") || q.includes("earlier than")) {
      return { end: yearMatch[0] };
    }
    if (q.includes("after") || q.includes("since") || q.includes("from")) {
      return { start: yearMatch[0] };
    }
    if (yearMatch.length >= 2) {
      return { start: yearMatch[0], end: yearMatch[1] };
    }
    return { start: yearMatch[0], end: yearMatch[0] };
  }

  if (/\b(recently|lately|latest|last)\b/i.test(q)) {
    return { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() };
  }

  return undefined;
}

function detectAnswerMode(q: string, intent: QuestionIntent): AnswerMode {
  if (/\b(short|brief|quick|tldr|tl;dr)\b/i.test(q)) return "short";
  if (/\b(detailed|in-depth|comprehensive|thorough|deep)\b/i.test(q)) return "detailed";
  if (/\b(list|bullet|points?|summary|tldr)\b/i.test(q)) return "bullet_summary";
  if (/\b(table|tabular|compare|comparison)\b/i.test(q) || intent === "comparative") return "tabular_comparison";
  if (/\b(evidence|sources?|citations?|proof)\b/i.test(q) || intent === "evidence_request") return "evidence_digest";
  if (intent === "synthesis") return "detailed";
  if (intent === "follow_up") return "short";
  return "detailed";
}

function splitSubQuestions(question: string): string[] {
  // Split on "? " or " and " or " also " (but keep it simple)
  const parts = question
    .split(/\?\s+|\s+and\s+what\s+|\s+and\s+how\s+|\s+also\s+|\s+additionally\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 5);
  if (parts.length <= 1) return [question];
  return parts.map((p, i) => (i < parts.length - 1 ? p + "?" : p));
}

function detectFollowUp(q: string, history: ConversationTurn[]): boolean {
  if (history.length === 0) return false;
  if (/^(why|how do we know|what changed|show (me )?(the |some )?evidence|prove it|source[s]? for|cite|and|also|what about|how about|then)\b/i.test(q)) {
    return true;
  }
  // Pronoun references to prior context
  if (/\b(it|this|that|they|them|these|those|the above|the previous)\b/i.test(q) && history.length > 0) {
    return true;
  }
  return false;
}

function checkNeedsClarification(entities: string[], context: QAContext, intent: QuestionIntent): boolean {
  if (entities.length === 0 && intent !== "synthesis" && intent !== "follow_up") {
    return false;
  }
  // If the question mentions an entity that doesn't match any known entity, flag for clarification
  // (This is a heuristic — the actual disambiguation happens after retrieval)
  return false;
}

function buildClarificationQuestion(entities: string[], context: QAContext): string {
  return `Could you clarify which specific entity you're referring to? I found multiple candidates matching "${entities.join(", ")}".`;
}

// ============================================================================
// EVIDENCE RETRIEVAL
// ============================================================================

/**
 * Retrieve relevant evidence from the investigation report, source results,
 * and the Knowledge Base. Rank by relevance, credibility, recency, and diversity.
 */
export async function retrieveEvidence(
  interpretation: QuestionInterpretation,
  context: QAContext
): Promise<{ used: RetrievedEvidence[]; rejected: { evidence: RetrievedEvidence; reason: string }[] }> {
  const allEvidence: RetrievedEvidence[] = [];
  const now = Date.now();

  // 1. Retrieve from investigation report
  if (context.report && context.investigationId) {
    allEvidence.push(...retrieveFromReport(context.report, context.investigationId, interpretation));
  }

  // 2. Retrieve from source results (raw findings)
  if (context.sourceResults && context.sourceResults.length > 0) {
    allEvidence.push(...retrieveFromSourceResults(context.sourceResults, context.investigationId || "", interpretation));
  }

  // 3. Retrieve from Knowledge Base
  if (context.useKnowledgeBase && interpretation.targetEntities.length > 0) {
    allEvidence.push(...await retrieveFromKB(interpretation));
  } else if (context.useKnowledgeBase && (interpretation.intent === "synthesis" || interpretation.intent === "risk")) {
    // For synthesis/risk questions, pull recent KB evidence even without specific entities
    allEvidence.push(...await retrieveRecentKBEvidence(20));
  }

  // 4. Rank evidence
  const ranked = rankEvidence(allEvidence, interpretation, now);

  // 5. Select top evidence (cap at 25 to keep prompt manageable)
  const selected = ranked.slice(0, 25);
  const rejected = ranked.slice(25).map((e) => ({
    evidence: e,
    reason: "Exceeded evidence cap (25 items) — lower relevance score.",
  }));

  // Also reject zero-relevance evidence
  const zeroRelevance = selected.filter((e) => e.relevanceScore < 0.05);
  const kept = selected.filter((e) => e.relevanceScore >= 0.05);
  const rejectedZero = zeroRelevance.map((e) => ({
    evidence: e,
    reason: "Relevance score below threshold (0.05).",
  }));

  return { used: kept, rejected: [...rejected, ...rejectedZero] };
}

function retrieveFromReport(
  report: ReportData,
  investigationId: string,
  interp: QuestionInterpretation
): RetrievedEvidence[] {
  const evidence: RetrievedEvidence[] = [];
  const now = Date.now();

  // Key findings
  for (let i = 0; i < report.key_findings.length; i++) {
    const f = report.key_findings[i];
    const relevance = scoreRelevance(f.claim, interp);
    evidence.push({
      id: `finding_${i}`,
      source: "investigation_finding",
      sourceKey: f.source,
      sourceLabel: f.source,
      sourceUrl: f.source_url,
      tier: getReliabilityTier(f.source),
      content: f.claim,
      confidence: f.confidence,
      observedAt: now.toString(),
      relevanceScore: relevance,
      credibilityScore: tierToScore(getReliabilityTier(f.source)),
      recencyScore: 0.8, // report is recent
      diversityBonus: 0,
      overallRank: 0,
      investigationId,
    });
  }

  // Timeline events
  if (report.timeline) {
    for (let i = 0; i < report.timeline.length; i++) {
      const t = report.timeline[i];
      const relevance = scoreRelevance(t.event, interp);
      const observedAt = t.date ? new Date(t.date).getTime() : now;
      evidence.push({
        id: `timeline_${i}`,
        source: "investigation_timeline",
        sourceKey: t.source,
        sourceLabel: t.source,
        sourceUrl: t.source_url,
        tier: getReliabilityTier(t.source),
        content: `${t.date}: ${t.event}`,
        confidence: t.confidence,
        observedAt: observedAt.toString(),
        relevanceScore: relevance,
        credibilityScore: tierToScore(getReliabilityTier(t.source)),
        recencyScore: scoreRecency(observedAt, now),
        diversityBonus: 0,
        overallRank: 0,
        investigationId,
      });
    }
  }

  // Contradictions
  if (report.contradictions) {
    for (let i = 0; i < report.contradictions.length; i++) {
      const c = report.contradictions[i];
      const relevance = Math.max(
        scoreRelevance(c.claim_a, interp),
        scoreRelevance(c.claim_b, interp),
        scoreRelevance(c.topic, interp)
      );
      evidence.push({
        id: `contradiction_${i}`,
        source: "investigation_contradiction",
        sourceKey: c.source_a,
        sourceLabel: c.source_a,
        sourceUrl: "",
        tier: getReliabilityTier(c.source_a),
        content: `CONTRADICTION on "${c.topic}": Source A (${c.source_a}): ${c.claim_a} | Source B (${c.source_b}): ${c.claim_b} | Resolution: ${c.resolution}`,
        confidence: 0.5,
        observedAt: now.toString(),
        relevanceScore: relevance,
        credibilityScore: 0.5, // mixed
        recencyScore: 0.8,
        diversityBonus: 0,
        overallRank: 0,
        investigationId,
      });
    }
  }

  // Executive summary + detailed analysis (as a single evidence chunk)
  if (report.executive_summary) {
    const relevance = scoreRelevance(report.executive_summary, interp);
    evidence.push({
      id: "exec_summary",
      source: "investigation_finding",
      sourceKey: "synthesis",
      sourceLabel: "AI Synthesis",
      sourceUrl: "",
      tier: 3,
      content: `Executive Summary: ${report.executive_summary}`,
      confidence: report.confidence_score,
      observedAt: now.toString(),
      relevanceScore: relevance,
      credibilityScore: 0.7,
      recencyScore: 0.9,
      diversityBonus: 0,
      overallRank: 0,
      investigationId,
    });
  }

  if (report.detailed_analysis) {
    const relevance = scoreRelevance(report.detailed_analysis, interp);
    evidence.push({
      id: "detailed_analysis",
      source: "investigation_finding",
      sourceKey: "synthesis",
      sourceLabel: "AI Synthesis",
      sourceUrl: "",
      tier: 3,
      content: `Detailed Analysis: ${report.detailed_analysis.slice(0, 2000)}`,
      confidence: report.confidence_score,
      observedAt: now.toString(),
      relevanceScore: relevance,
      credibilityScore: 0.7,
      recencyScore: 0.9,
      diversityBonus: 0,
      overallRank: 0,
      investigationId,
    });
  }

  return evidence;
}

function retrieveFromSourceResults(
  sourceResults: SourceResult[],
  investigationId: string,
  interp: QuestionInterpretation
): RetrievedEvidence[] {
  const evidence: RetrievedEvidence[] = [];
  const now = Date.now();

  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    const tier = getReliabilityTier(sr.source);
    for (let i = 0; i < sr.findings.length; i++) {
      const f = sr.findings[i];
      const relevance = scoreRelevance(f.data, interp);
      // Only include if relevance is non-trivial
      if (relevance < 0.1) continue;
      const observedAt = new Date(f.timestamp).getTime();
      evidence.push({
        id: `sr_${sr.source}_${i}`,
        source: "source_result",
        sourceKey: sr.source,
        sourceLabel: sr.source_label,
        sourceUrl: f.source_url,
        tier,
        content: f.data.slice(0, 500),
        confidence: f.confidence,
        observedAt: observedAt.toString(),
        relevanceScore: relevance,
        credibilityScore: tierToScore(tier),
        recencyScore: scoreRecency(observedAt, now),
        diversityBonus: 0,
        overallRank: 0,
        investigationId,
      });
    }
  }

  return evidence;
}

async function retrieveFromKB(interp: QuestionInterpretation): Promise<RetrievedEvidence[]> {
  const evidence: RetrievedEvidence[] = [];
  const now = Date.now();

  for (const entityQuery of interp.targetEntities) {
    try {
      const result = await searchKBInKB(entityQuery, 10);
      // Add matching entities
      for (const ent of result.entities) {
        const relevance = scoreRelevance(ent.primaryName + " " + ent.aliases.join(" "), interp);
        evidence.push({
          id: `kb_entity_${ent.id}`,
          source: "kb_entity",
          sourceKey: ent.primaryName,
          sourceLabel: `KB Entity (${ent.type})`,
          sourceUrl: "",
          tier: ent.tier,
          content: `Entity: ${ent.primaryName} (type: ${ent.type}, confidence: ${ent.confidence}, observations: ${ent.observationCount}, investigations: ${ent.investigationCount}). Aliases: ${ent.aliases.join(", ") || "none"}. Attributes: ${JSON.stringify(ent.attributes)}`,
          confidence: ent.confidence,
          observedAt: new Date(ent.lastSeenAt).getTime().toString(),
          relevanceScore: Math.max(relevance, 0.6), // KB entities are inherently relevant if they match
          credibilityScore: tierToScore(ent.tier),
          recencyScore: scoreRecency(new Date(ent.lastSeenAt).getTime(), now),
          diversityBonus: 0,
          overallRank: 0,
          entityId: ent.id,
        });
      }
      // Add matching evidence
      for (const ev of result.evidence.slice(0, 5)) {
        const relevance = scoreRelevance(ev.rawText, interp);
        if (relevance < 0.1) continue;
        evidence.push({
          id: `kb_evidence_${ev.id}`,
          source: "kb_evidence",
          sourceKey: ev.sourceKey,
          sourceLabel: ev.sourceLabel,
          sourceUrl: ev.sourceUrl,
          tier: ev.tier,
          content: ev.rawText.slice(0, 500),
          confidence: ev.confidence,
          observedAt: new Date(ev.observedAt).getTime().toString(),
          relevanceScore: relevance,
          credibilityScore: tierToScore(ev.tier),
          recencyScore: scoreRecency(new Date(ev.observedAt).getTime(), now),
          diversityBonus: 0,
          overallRank: 0,
          entityId: ev.entityId,
          investigationId: ev.investigationId,
        });
      }
      // Add matching relationships
      for (const rel of result.relationships.slice(0, 5)) {
        const relevance = scoreRelevance(rel.label, interp);
        evidence.push({
          id: `kb_rel_${rel.id}`,
          source: "kb_relationship",
          sourceKey: rel.sourceKey,
          sourceLabel: rel.sourceLabel,
          sourceUrl: rel.sourceUrl,
          tier: rel.tier,
          content: `Relationship: ${rel.fromName} → ${rel.relationType.replace(/_/g, " ")} → ${rel.toName}. ${rel.label}. Confidence: ${rel.confidence}`,
          confidence: rel.confidence,
          observedAt: new Date(rel.lastSeenAt).getTime().toString(),
          relevanceScore: Math.max(relevance, 0.5),
          credibilityScore: tierToScore(rel.tier),
          recencyScore: scoreRecency(new Date(rel.lastSeenAt).getTime(), now),
          diversityBonus: 0,
          overallRank: 0,
          relationshipId: rel.id,
        });
      }
    } catch (e) {
      // KB search might fail silently
      console.error("[qa-engine] KB retrieval error for", entityQuery, e);
    }
  }

  return evidence;
}

async function retrieveRecentKBEvidence(limit: number): Promise<RetrievedEvidence[]> {
  const evidence: RetrievedEvidence[] = [];
  const now = Date.now();
  try {
    const recentEv = await db.kBEvidence.findMany({
      orderBy: { observedAt: "desc" },
      take: limit,
    });
    for (const ev of recentEv) {
      evidence.push({
        id: `kb_evidence_${ev.id}`,
        source: "kb_evidence",
        sourceKey: ev.sourceKey,
        sourceLabel: ev.sourceLabel,
        sourceUrl: ev.sourceUrl,
        tier: ev.tier as ReliabilityTier,
        content: ev.rawText.slice(0, 500),
        confidence: ev.confidence,
        observedAt: ev.observedAt instanceof Date ? ev.observedAt.getTime().toString() : String(ev.observedAt),
        relevanceScore: 0.3, // baseline for synthesis questions
        credibilityScore: tierToScore(ev.tier as ReliabilityTier),
        recencyScore: scoreRecency(
          ev.observedAt instanceof Date ? ev.observedAt.getTime() : now,
          now
        ),
        diversityBonus: 0,
        overallRank: 0,
        entityId: ev.entityId ?? undefined,
        investigationId: ev.investigationId,
      });
    }
  } catch (e) {
    console.error("[qa-engine] recent KB evidence error", e);
  }
  return evidence;
}

// Local KB search wrapper (avoids circular import with knowledge-base.ts)
async function searchKBInKB(query: string, limit: number): Promise<{
  entities: { id: string; type: string; primaryName: string; aliases: string[]; attributes: Record<string, string>; confidence: number; tier: ReliabilityTier; lastSeenAt: string; observationCount: number; investigationCount: number }[];
  relationships: { id: string; fromName: string; toName: string; relationType: string; label: string; confidence: number; tier: ReliabilityTier; sourceKey: string; sourceLabel: string; sourceUrl: string; lastSeenAt: string }[];
  evidence: { id: string; rawText: string; sourceKey: string; sourceLabel: string; sourceUrl: string; tier: ReliabilityTier; confidence: number; observedAt: string; entityId?: string; investigationId: string }[];
}> {
  const q = query.trim().toLowerCase();
  if (!q) return { entities: [], relationships: [], evidence: [] };

  const [entities, rels, evidence] = await Promise.all([
    db.kBEntity.findMany({
      where: {
        OR: [
          { primaryName: { contains: q } },
          { normalizedName: { contains: q } },
          { aliasesJson: { contains: q } },
        ],
        status: "active",
      },
      take: limit,
      orderBy: { lastSeenAt: "desc" },
    }),
    db.kBRelationship.findMany({
      where: { label: { contains: q } },
      take: limit,
      orderBy: { lastSeenAt: "desc" },
    }),
    db.kBEvidence.findMany({
      where: {
        OR: [
          { rawText: { contains: q } },
          { normalizedText: { contains: q } },
        ],
      },
      take: limit,
      orderBy: { observedAt: "desc" },
    }),
  ]);

  // Resolve partner names for relationships
  const eIds = new Set<string>();
  for (const r of rels) {
    eIds.add(r.fromEntityId);
    eIds.add(r.toEntityId);
  }
  const eRows = eIds.size > 0 ? await db.kBEntity.findMany({ where: { id: { in: [...eIds] } } }) : [];
  const eMap = new Map(eRows.map((e) => [e.id, e]));

  return {
    entities: entities.map((e) => ({
      id: e.id,
      type: e.type,
      primaryName: e.primaryName,
      aliases: safeJsonStringArray(e.aliasesJson),
      attributes: safeJsonObject(e.attributesJson) as Record<string, string>,
      confidence: e.confidence,
      tier: e.tier as ReliabilityTier,
      lastSeenAt: e.lastSeenAt instanceof Date ? e.lastSeenAt.toISOString() : String(e.lastSeenAt),
      observationCount: e.observationCount,
      investigationCount: e.investigationCount,
    })),
    relationships: rels.map((r) => ({
      id: r.id,
      fromName: eMap.get(r.fromEntityId)?.primaryName || "",
      toName: eMap.get(r.toEntityId)?.primaryName || "",
      relationType: r.relationType,
      label: r.label,
      confidence: r.confidence,
      tier: r.tier as ReliabilityTier,
      sourceKey: r.sourceKey,
      sourceLabel: r.sourceLabel,
      sourceUrl: r.sourceUrl,
      lastSeenAt: r.lastSeenAt instanceof Date ? r.lastSeenAt.toISOString() : String(r.lastSeenAt),
    })),
    evidence: evidence.map((ev) => ({
      id: ev.id,
      rawText: ev.rawText,
      sourceKey: ev.sourceKey,
      sourceLabel: ev.sourceLabel,
      sourceUrl: ev.sourceUrl,
      tier: ev.tier as ReliabilityTier,
      confidence: ev.confidence,
      observedAt: ev.observedAt instanceof Date ? ev.observedAt.toISOString() : String(ev.observedAt),
      entityId: ev.entityId ?? undefined,
      investigationId: ev.investigationId,
    })),
  };
}

// ============================================================================
// Evidence Ranking
// ============================================================================

function rankEvidence(
  evidence: RetrievedEvidence[],
  interp: QuestionInterpretation,
  now: number
): RetrievedEvidence[] {
  // Compute diversity bonus: evidence from unique sources gets a bonus
  const sourceCount = new Map<string, number>();
  for (const e of evidence) {
    sourceCount.set(e.sourceKey, (sourceCount.get(e.sourceKey) || 0) + 1);
  }
  for (const e of evidence) {
    const count = sourceCount.get(e.sourceKey) || 1;
    e.diversityBonus = count === 1 ? 0.15 : 0; // unique source gets bonus
  }

  // Weighted combination
  // Relevance: 50%, Credibility: 25%, Recency: 15%, Diversity: 10%
  for (const e of evidence) {
    e.overallRank =
      e.relevanceScore * 0.50 +
      e.credibilityScore * 0.25 +
      e.recencyScore * 0.15 +
      e.diversityBonus * 0.10;
  }

  // Sort by overall rank descending
  return evidence.sort((a, b) => b.overallRank - a.overallRank);
}

function scoreRelevance(text: string, interp: QuestionInterpretation): number {
  if (!text) return 0;
  const lowerText = text.toLowerCase();
  let score = 0;

  // Exact entity matches boost score significantly
  for (const entity of interp.targetEntities) {
    const lowerEntity = entity.toLowerCase();
    if (lowerText.includes(lowerEntity)) {
      score += 0.4;
    }
    // Partial matches (token overlap)
    const tokens = lowerEntity.split(/[\s.-]+/).filter((t) => t.length > 2);
    for (const token of tokens) {
      if (lowerText.includes(token)) {
        score += 0.1;
      }
    }
  }

  // Intent-specific keywords
  const intentKeywords: Record<QuestionIntent, string[]> = {
    risk: ["risk", "threat", "danger", "vulnerab", "attack", "malicious", "sanction"],
    timeline: ["date", "time", "when", "year", "month", "timeline", "history"],
    relationship: ["relate", "connect", "link", "associate", "own", "resolve"],
    comparative: ["compare", "vs", "versus", "difference", "similar"],
    synthesis: ["summary", "overview", "comprehensive", "analysis"],
    factual_lookup: [],
    evidence_request: ["evidence", "source", "proof", "cite"],
    follow_up: [],
    disambiguation: [],
    unknown: [],
  };

  const keywords = intentKeywords[interp.intent] || [];
  for (const kw of keywords) {
    if (lowerText.includes(kw)) {
      score += 0.1;
    }
  }

  return Math.min(1, score);
}

function tierToScore(tier: ReliabilityTier): number {
  // Tier 5 → 1.0, Tier 1 → 0.2
  return tier / 5;
}

function scoreRecency(observedAtMs: number, nowMs: number): number {
  const ageDays = (nowMs - observedAtMs) / (1000 * 60 * 60 * 24);
  if (ageDays < 1) return 1.0;
  if (ageDays < 7) return 0.9;
  if (ageDays < 30) return 0.7;
  if (ageDays < 90) return 0.5;
  if (ageDays < 365) return 0.3;
  return 0.1;
}

// ============================================================================
// ANSWER SYNTHESIS (LLM with strict evidence grounding)
// ============================================================================

let zaiPromise: Promise<unknown> | null = null;
async function getZai() {
  if (!zaiPromise) zaiPromise = ZAI.create();
  return zaiPromise as Promise<{
    chat: {
      completions: {
        create: (args: {
          messages: { role: string; content: string }[];
          thinking?: { type: string };
        }) => Promise<{ choices: { message: { content: string } }[] }>;
      };
    };
  }>;
}

const QA_AI_TIMEOUT_MS = 45_000;
async function withQaTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("QA AI call timed out after 45s")), QA_AI_TIMEOUT_MS);
    }),
  ]);
}

/**
 * Synthesize an evidence-grounded answer using the LLM.
 * Strict rules: never hallucinate, cite every claim, refuse when insufficient.
 */
export async function synthesizeAnswer(
  question: string,
  interpretation: QuestionInterpretation,
  evidence: RetrievedEvidence[],
  context: QAContext
): Promise<QAAnswer> {
  const startTime = Date.now();

  // Handle clarification needed
  if (interpretation.needsClarification && interpretation.clarificationQuestion) {
    return buildClarificationAnswer(question, interpretation, startTime);
  }

  // Handle insufficient evidence
  if (evidence.length === 0) {
    return buildInsufficientEvidenceAnswer(question, interpretation, startTime);
  }

  // Build the evidence corpus for the LLM
  const evidenceCorpus = buildEvidenceCorpus(evidence);
  const conversationContext = buildConversationContext(context.conversationHistory);

  // Build system prompt with strict evidence-grounding rules
  const systemPrompt = buildSystemPrompt(interpretation, evidenceCorpus, conversationContext, context);

  // Call the LLM
  let llmResponse: string;
  try {
    const zai = await getZai();
    const completion = await withQaTimeout(zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      thinking: { type: "disabled" },
    }));
    llmResponse = completion.choices?.[0]?.message?.content || "";
  } catch (e) {
    return buildErrorResponse(question, interpretation, startTime, e);
  }

  // Parse the structured response
  const parsed = parseStructuredResponse(llmResponse);

  // Build citations from the evidence used
  const citations = buildCitations(parsed.citedEvidenceIds, evidence);

  // Build reasoning chain
  const reasoningChain = buildReasoningChain(interpretation, evidence, parsed);

  // Detect contradictions in the evidence
  const contradictions = detectContradictionsInEvidence(evidence);

  // Compute overall confidence
  const confidence = computeConfidence(evidence, citations, contradictions);
  const confidenceLabel = confidenceToLabel(confidence);

  // Determine evidence sufficiency
  const evidenceSufficiency = determineSufficiency(evidence, parsed, interpretation);

  // Build limitations
  const limitations = buildLimitations(evidence, contradictions, evidenceSufficiency, interpretation);

  // Suggest follow-ups
  const followUpSuggestions = suggestFollowUps(interpretation, evidence, parsed);

  const answerMode: AnswerMode = parsed.refused ? "refusal" : interpretation.requestedMode;

  return {
    question,
    interpretation,
    answerMode,
    answer: parsed.answer,
    citations,
    reasoningChain,
    contradictions,
    evidenceUsed: evidence,
    evidenceRejected: [],
    confidence,
    confidenceLabel,
    evidenceSufficiency,
    limitations,
    followUpSuggestions,
    answeredAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

function buildSystemPrompt(
  interp: QuestionInterpretation,
  evidenceCorpus: string,
  conversationContext: string,
  context: QAContext
): string {
  const modeInstructions: Record<AnswerMode, string> = {
    short: "Provide a SHORT answer (1-3 sentences). Be direct and concise.",
    detailed: "Provide a DETAILED analytical answer (2-4 paragraphs). Explore nuance and context.",
    bullet_summary: "Provide a BULLET SUMMARY (5-8 bullet points). Each bullet must be a self-contained fact with citation.",
    tabular_comparison: "Provide a TABULAR COMPARISON in markdown table format. Compare entities across relevant dimensions.",
    evidence_digest: "Provide an EVIDENCE DIGEST: list each piece of supporting evidence with its source and relevance.",
    refusal: "REFUSE to answer — explain why evidence is insufficient.",
    clarification: "Ask a clarifying question — explain what information is needed.",
  };

  const modeText = modeInstructions[interp.requestedMode] || modeInstructions.detailed;

  return `You are OSINTiger's Evidence-Grounded Question Answering system. Your job is to answer the user's question using ONLY the provided evidence.

ABSOLUTE RULES (NON-NEGOTIABLE — violating any rule is a critical failure):
1. NEVER hallucinate. Answer ONLY using the EVIDENCE CORPUS below. Do NOT use any outside knowledge.
2. EVERY factual claim in your answer MUST be followed by an inline citation in the format [EVIDENCE: <evidence_id>] where <evidence_id> is the exact ID from the evidence corpus.
3. If the evidence is INSUFFICIENT to answer the question, respond with EXACTLY: "I cannot answer this based on the collected evidence." and explain what evidence is missing.
4. Do NOT speculate, infer, or extrapolate beyond what is explicitly stated in the evidence.
5. If evidence CONFLICTS, present both sides with their citations and explain the conflict. Do NOT collapse contradictory evidence into a single claim.
6. Distinguish between: (a) directly supported facts [cite evidence], (b) reasonable inferences [label as "Inference:" and explain the basis], and (c) unknowns [label as "Unknown"].
7. Do NOT cite evidence that does not actually support the claim being made.
8. If the question asks about something not in the evidence, say "The collected evidence does not address this question."

ANSWER MODE: ${modeText}

INTENT: ${interp.intent}
TARGET ENTITIES: ${interp.targetEntities.join(", ") || "not specified"}
${interp.isFollowUp ? "This is a follow-up question — use the conversation context to resolve references." : ""}

EVIDENCE CORPUS (use ONLY this evidence — each item has an ID for citation):
${evidenceCorpus}

${conversationContext}

OUTPUT FORMAT — respond with a single valid JSON object and NOTHING else (no markdown fences, no prose before/after):
{
  "answer": "Your answer text with inline [EVIDENCE: <id>] citations. If refusing, write 'I cannot answer this based on the collected evidence.' here.",
  "citedEvidenceIds": ["ev_0", "ev_3", "ev_7"],
  "refused": false,
  "refusalReason": "",
  "confidence": 0.75,
  "limitations": ["Any caveats or limitations of this answer"],
  "followUpSuggestions": ["Suggested follow-up question 1", "Suggested follow-up question 2"]
}

If you must refuse, set "refused": true and provide a "refusalReason" explaining what evidence is missing.`;
}

function buildEvidenceCorpus(evidence: RetrievedEvidence[]): string {
  return evidence.map((e, i) => {
    const id = `ev_${i}`;
    return `[${id}] (source: ${e.sourceLabel}, tier: ${e.tier}, confidence: ${(e.confidence * 100).toFixed(0)}%, relevance: ${(e.relevanceScore * 100).toFixed(0)}%)
${e.content}`;
  }).join("\n\n");
}

function buildConversationContext(history: ConversationTurn[]): string {
  if (history.length === 0) return "";
  const recent = history.slice(-3); // last 3 turns
  const turns = recent.map((t, i) =>
    `Turn ${i + 1}:\n  Q: ${t.question}\n  A: ${t.answer.slice(0, 300)}`
  ).join("\n\n");
  return `CONVERSATION CONTEXT (for follow-up reference resolution):\n${turns}`;
}

interface ParsedLLMResponse {
  answer: string;
  citedEvidenceIds: string[];
  refused: boolean;
  refusalReason: string;
  confidence: number;
  limitations: string[];
  followUpSuggestions: string[];
}

function parseStructuredResponse(raw: string): ParsedLLMResponse {
  // Try to extract JSON from the response
  let jsonStr = raw.trim();

  // Strip markdown fences if present
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  // Try parsing as JSON
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      answer: String(parsed.answer || ""),
      citedEvidenceIds: Array.isArray(parsed.citedEvidenceIds) ? parsed.citedEvidenceIds.map(String) : [],
      refused: Boolean(parsed.refused),
      refusalReason: String(parsed.refusalReason || ""),
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      limitations: Array.isArray(parsed.limitations) ? parsed.limitations.map(String) : [],
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions) ? parsed.followUpSuggestions.map(String) : [],
    };
  } catch {
    // Fallback: treat as plain text answer
    const refused = raw.includes("I cannot answer this based on the collected evidence");
    // Extract any [EVIDENCE: ev_N] citations
    const citedMatches = [...raw.matchAll(/\[EVIDENCE:\s*(ev_\d+)\s*\]/gi)];
    const citedEvidenceIds = citedMatches.map((m) => m[1]);
    return {
      answer: raw,
      citedEvidenceIds,
      refused,
      refusalReason: refused ? "Insufficient evidence in the collected corpus." : "",
      confidence: refused ? 0.1 : 0.6,
      limitations: refused ? ["Insufficient evidence to answer this question."] : [],
      followUpSuggestions: [],
    };
  }
}

function buildCitations(citedIds: string[], evidence: RetrievedEvidence[]): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<string>();
  let idx = 1;

  for (const id of citedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    // Find the evidence by index (ev_0, ev_1, ...)
    const match = id.match(/^ev_(\d+)$/);
    if (!match) continue;
    const i = parseInt(match[1], 10);
    const ev = evidence[i];
    if (!ev) continue;

    citations.push({
      index: idx++,
      evidenceId: id,
      sourceKey: ev.sourceKey,
      sourceLabel: ev.sourceLabel,
      sourceUrl: ev.sourceUrl,
      tier: ev.tier,
      snippet: ev.content.slice(0, 200),
      confidence: ev.confidence,
    });
  }

  return citations;
}

function buildReasoningChain(
  interp: QuestionInterpretation,
  evidence: RetrievedEvidence[],
  parsed: ParsedLLMResponse
): ReasoningStep[] {
  const steps: ReasoningStep[] = [];
  let stepNum = 1;

  // Step 1: Interpretation
  steps.push({
    step: stepNum++,
    description: "Question interpreted",
    evidenceUsed: [],
    reasoning: interp.reasoning,
  });

  // Step 2: Evidence retrieval
  steps.push({
    step: stepNum++,
    description: `Retrieved ${evidence.length} evidence items`,
    evidenceUsed: evidence.map((_, i) => `ev_${i}`),
    reasoning: `Evidence ranked by relevance (${(evidence[0]?.relevanceScore * 100).toFixed(0) || 0}%-${(evidence[evidence.length - 1]?.relevanceScore * 100).toFixed(0) || 0}%), credibility (tier ${evidence[0]?.tier || 0}-${evidence[evidence.length - 1]?.tier || 0}), and recency.`,
  });

  // Step 3: Citation selection
  if (parsed.citedEvidenceIds.length > 0) {
    steps.push({
      step: stepNum++,
      description: `Selected ${parsed.citedEvidenceIds.length} evidence items for citation`,
      evidenceUsed: parsed.citedEvidenceIds,
      reasoning: "These evidence items directly support the claims in the answer.",
    });
  }

  // Step 4: Answer synthesis
  steps.push({
    step: stepNum++,
    description: parsed.refused ? "Answer refused — insufficient evidence" : "Answer synthesized with citations",
    evidenceUsed: parsed.citedEvidenceIds,
    reasoning: parsed.refused
      ? `Refusal reason: ${parsed.refusalReason}`
      : `Answer generated using ${parsed.citedEvidenceIds.length} cited evidence items. Confidence: ${(parsed.confidence * 100).toFixed(0)}%.`,
  });

  return steps;
}

function detectContradictionsInEvidence(evidence: RetrievedEvidence[]): ContradictionSummary[] {
  const contradictions: ContradictionSummary[] = [];

  // Look for evidence from different sources that make conflicting claims
  // about the same topic. This is a heuristic — group by content similarity.
  for (let i = 0; i < evidence.length; i++) {
    for (let j = i + 1; j < evidence.length; j++) {
      const a = evidence[i];
      const b = evidence[j];
      if (a.sourceKey === b.sourceKey) continue; // same source, skip

      // Check if they mention the same entity but disagree
      // Simple heuristic: if both mention "contradiction" or "conflict" or "disagree"
      const combined = (a.content + " " + b.content).toLowerCase();
      if (combined.includes("contradict") || combined.includes("conflict") || combined.includes("disagree")) {
        contradictions.push({
          topic: `Conflict between ${a.sourceLabel} and ${b.sourceLabel}`,
          claimA: a.content.slice(0, 150),
          sourceA: a.sourceLabel,
          claimB: b.content.slice(0, 150),
          sourceB: b.sourceLabel,
          strongerSide: a.tier > b.tier ? "a" : b.tier > a.tier ? "b" : "neither",
          rationale: `Source ${a.tier > b.tier ? "A" : "B"} has higher reliability tier (${Math.max(a.tier, b.tier)} vs ${Math.min(a.tier, b.tier)}).`,
          additionalEvidenceNeeded: "Additional corroborating sources needed to resolve the discrepancy.",
        });
      }
    }
  }

  return contradictions.slice(0, 5); // cap at 5
}

function computeConfidence(
  evidence: RetrievedEvidence[],
  citations: Citation[],
  contradictions: ContradictionSummary[]
): number {
  if (citations.length === 0) return 0.1;

  // Base confidence: average of cited evidence credibility
  const citedEvidence = citations.map((c) => {
    const match = c.evidenceId.match(/^ev_(\d+)$/);
    if (!match) return null;
    return evidence[parseInt(match[1], 10)];
  }).filter((e): e is RetrievedEvidence => e !== null);

  if (citedEvidence.length === 0) return 0.2;

  const avgCredibility = citedEvidence.reduce((s, e) => s + e.credibilityScore, 0) / citedEvidence.length;
  const avgConfidence = citedEvidence.reduce((s, e) => s + e.confidence, 0) / citedEvidence.length;
  const diversity = new Set(citedEvidence.map((e) => e.sourceKey)).size / citedEvidence.length;

  let confidence = avgCredibility * 0.4 + avgConfidence * 0.4 + diversity * 0.2;

  // Penalty for contradictions
  if (contradictions.length > 0) {
    confidence -= contradictions.length * 0.1;
  }

  // Bonus for corroboration (multiple sources)
  if (citedEvidence.length >= 3) {
    confidence += 0.1;
  }

  return Math.max(0, Math.min(1, confidence));
}

function confidenceToLabel(confidence: number): "low" | "moderate" | "high" | "very_high" {
  if (confidence >= 0.8) return "very_high";
  if (confidence >= 0.6) return "high";
  if (confidence >= 0.4) return "moderate";
  return "low";
}

function determineSufficiency(
  evidence: RetrievedEvidence[],
  parsed: ParsedLLMResponse,
  interp: QuestionInterpretation
): "sufficient" | "partial" | "insufficient" {
  if (parsed.refused) return "insufficient";
  if (evidence.length < 2) return "partial";
  if (parsed.citedEvidenceIds.length < 2) return "partial";

  // For synthesis questions, need more evidence
  if (interp.intent === "synthesis" && evidence.length < 5) return "partial";

  return "sufficient";
}

function buildLimitations(
  evidence: RetrievedEvidence[],
  contradictions: ContradictionSummary[],
  sufficiency: string,
  interp: QuestionInterpretation
): string[] {
  const limitations: string[] = [];

  if (sufficiency === "insufficient") {
    limitations.push("Insufficient evidence to fully answer this question.");
  } else if (sufficiency === "partial") {
    limitations.push("Evidence is partial — additional collection would improve confidence.");
  }

  if (contradictions.length > 0) {
    limitations.push(`${contradictions.length} contradiction(s) detected in the evidence base — conclusions should be treated with caution.`);
  }

  // Check for low-credibility sources
  const lowTier = evidence.filter((e) => e.tier <= 2);
  if (lowTier.length > evidence.length / 2) {
    limitations.push("Majority of evidence comes from low-credibility sources (tier ≤ 2).");
  }

  // Check for stale evidence
  const now = Date.now();
  const stale = evidence.filter((e) => {
    const age = now - parseInt(e.observedAt, 10);
    return age > 90 * 24 * 60 * 60 * 1000; // > 90 days
  });
  if (stale.length > evidence.length / 2) {
    limitations.push("Some evidence is stale (>90 days old) — current state may differ.");
  }

  // Single-source dependency
  const sources = new Set(evidence.map((e) => e.sourceKey));
  if (sources.size === 1 && evidence.length > 1) {
    limitations.push("All evidence comes from a single source — no corroboration.");
  }

  return limitations;
}

function suggestFollowUps(
  interp: QuestionInterpretation,
  evidence: RetrievedEvidence[],
  parsed: ParsedLLMResponse
): string[] {
  const suggestions: string[] = [];

  if (parsed.refused) {
    suggestions.push("What additional evidence would help answer this question?");
    return suggestions;
  }

  // Based on intent
  if (interp.intent === "factual_lookup") {
    suggestions.push("What is the evidence supporting this?");
    suggestions.push("How does this relate to other entities?");
  } else if (interp.intent === "risk") {
    suggestions.push("What mitigations are recommended for this risk?");
    suggestions.push("How has this risk evolved over time?");
  } else if (interp.intent === "relationship") {
    suggestions.push("Show me the evidence chain for this relationship.");
    suggestions.push("What other entities are connected to these?");
  } else if (interp.intent === "timeline") {
    suggestions.push("What caused this event?");
    suggestions.push("What happened next?");
  } else if (interp.intent === "synthesis") {
    suggestions.push("What are the key uncertainties in this analysis?");
    suggestions.push("Which sources are most credible for this topic?");
  }

  // Suggest based on entities found
  const entities = new Set<string>();
  for (const e of evidence) {
    if (e.entityId) {
      entities.add(e.sourceKey);
    }
  }
  if (entities.size > 0) {
    suggestions.push("Compare these entities side by side.");
  }

  return suggestions.slice(0, 4);
}

// ============================================================================
// Special-case answer builders
// ============================================================================

function buildClarificationAnswer(
  question: string,
  interp: QuestionInterpretation,
  startTime: number
): QAAnswer {
  return {
    question,
    interpretation: interp,
    answerMode: "clarification",
    answer: interp.clarificationQuestion || "Could you please clarify your question?",
    citations: [],
    reasoningChain: [{
      step: 1,
      description: "Clarification needed",
      evidenceUsed: [],
      reasoning: "The question is ambiguous — multiple candidate entities match the query.",
    }],
    contradictions: [],
    evidenceUsed: [],
    evidenceRejected: [],
    confidence: 0.3,
    confidenceLabel: "low",
    evidenceSufficiency: "insufficient",
    limitations: ["Question requires disambiguation before evidence retrieval can proceed."],
    followUpSuggestions: [],
    answeredAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

function buildInsufficientEvidenceAnswer(
  question: string,
  interp: QuestionInterpretation,
  startTime: number
): QAAnswer {
  return {
    question,
    interpretation: interp,
    answerMode: "refusal",
    answer: "I cannot answer this based on the collected evidence. No relevant evidence was found in the investigation report, source results, or Knowledge Base for this question. This question requires additional OSINT collection.",
    citations: [],
    reasoningChain: [
      {
        step: 1,
        description: "Question interpreted",
        evidenceUsed: [],
        reasoning: interp.reasoning,
      },
      {
        step: 2,
        description: "Evidence retrieval attempted",
        evidenceUsed: [],
        reasoning: "Searched investigation report, source results, and Knowledge Base — no matching evidence found.",
      },
      {
        step: 3,
        description: "Answer refused — insufficient evidence",
        evidenceUsed: [],
        reasoning: "Zero evidence items retrieved. Cannot answer without speculation.",
      },
    ],
    contradictions: [],
    evidenceUsed: [],
    evidenceRejected: [],
    confidence: 0.1,
    confidenceLabel: "low",
    evidenceSufficiency: "insufficient",
    limitations: [
      "No evidence found in the collected corpus.",
      "Additional OSINT collection is needed to answer this question.",
    ],
    followUpSuggestions: [
      "What additional evidence would help answer this question?",
      "Try rephrasing the question with specific entity names.",
    ],
    answeredAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

function buildErrorResponse(
  question: string,
  interp: QuestionInterpretation,
  startTime: number,
  error: unknown
): QAAnswer {
  return {
    question,
    interpretation: interp,
    answerMode: "refusal",
    answer: `I was unable to generate an answer due to a technical error: ${error instanceof Error ? error.message : "AI call failed"}. Please try again.`,
    citations: [],
    reasoningChain: [{
      step: 1,
      description: "Error during answer synthesis",
      evidenceUsed: [],
      reasoning: `Error: ${error instanceof Error ? error.message : String(error)}`,
    }],
    contradictions: [],
    evidenceUsed: [],
    evidenceRejected: [],
    confidence: 0,
    confidenceLabel: "low",
    evidenceSufficiency: "insufficient",
    limitations: ["Technical error prevented answer generation."],
    followUpSuggestions: [],
    answeredAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// Top-level orchestration
// ============================================================================

/**
 * Answer a question using collected intelligence. This is the main entry point.
 */
export async function answerQuestion(
  question: string,
  context: QAContext
): Promise<QAAnswer> {
  // 1. Interpret the question
  const interpretation = interpretQuestion(question, context);

  // 2. Retrieve evidence
  const { used: evidence } = await retrieveEvidence(interpretation, context);

  // 3. Synthesize the answer
  return synthesizeAnswer(question, interpretation, evidence, context);
}
