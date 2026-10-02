// Multi-Agent Debate Engine — coordinated multi-agent reasoning framework (Feature 22)
//
// 7 specialized agents independently analyze the same investigation, then a
// coordinator synthesizes their outputs into a single defensible conclusion.
//
// Agents:
//   1. Research Agent      — broad context, evidence enrichment, missing angles
//   2. Technical Agent      — infrastructure, tech stack, technical plausibility
//   3. Cybersecurity Agent  — attack surface, exposure, threat indicators
//   4. Business Analyst     — organizational, commercial, strategic implications
//   5. Fact Checker         — claim validation, consistency, source alignment
//   6. Risk Analyst         — likelihood, impact, uncertainty, exposure
//   7. ACH Analyst          — financial/payment/transaction evidence (when applicable)
//
// Workflow: case intake → independent agent analysis → conflict identification
//           → coordinator synthesis → optional debate rounds → final output
//
// Principles enforced:
//   - Independence: each agent reasons from evidence, not other agents' conclusions
//   - Diversity: different analytical lenses preserved
//   - Adversarial validation: contradictions surfaced, not suppressed
//   - Evidence priority: stronger/fresher/more-credible evidence weighted higher
//   - Transparency: synthesis shows how conclusions were reached
//   - Uncertainty awareness: confirmed facts vs probable inferences vs speculation
//   - Traceability: every conclusion linked to contributing agents + evidence

import ZAI from "z-ai-web-dev-sdk";
import type { ReportData, SourceResult, KeyFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export type AgentType =
  | "research"
  | "technical"
  | "cybersecurity"
  | "business"
  | "fact_checker"
  | "risk"
  | "ach";

export interface AgentDefinition {
  type: AgentType;
  name: string;
  role: string;
  lens: string;
  icon: string;          // lucide icon name hint for frontend
  color: string;         // tailwind color class for frontend
  applicable: (context: DebateContext) => boolean;
}

export interface AgentObservation {
  observation: string;
  evidenceRefs: string[];   // evidence IDs or source labels
  confidence: number;       // 0-1
  uncertainty: string;      // what's uncertain about this
}

export interface AgentAnalysis {
  agentType: AgentType;
  agentName: string;
  applicable: boolean;
  keyObservations: AgentObservation[];
  supportingEvidence: { ref: string; relevance: string }[];
  confidenceLevel: "low" | "moderate" | "high" | "very_high";
  confidenceScore: number;  // 0-1
  uncertainties: string[];
  contradictions: { topic: string; description: string }[];
  recommendedNextSteps: string[];
  summary: string;
  reasoningTimeMs: number;
  error?: string;
}

export type ConflictType = "agreement" | "partial_agreement" | "direct_contradiction" | "unsupported_claim" | "missing_evidence";

export interface ConflictItem {
  id: string;
  type: ConflictType;
  topic: string;
  description: string;
  agents: { agentType: AgentType; position: string; confidence: number }[];
  resolution: string;
  strongerSide?: AgentType;
  resolutionRationale: string;
}

export interface CoordinatorSynthesis {
  finalConclusion: string;
  supportingRationale: string;
  areasOfAgreement: { topic: string; agents: AgentType[]; summary: string }[];
  areasOfDisagreement: { topic: string; positions: { agent: AgentType; position: string }[]; resolution: string }[];
  unresolvedUncertainties: string[];
  agentContributions: { agentType: AgentType; contribution: string; weight: number }[];
  evidenceReferences: { ref: string; supportingAgents: AgentType[]; significance: string }[];
  recommendedNextActions: string[];
  overallConfidence: number;
  confidenceLabel: "low" | "moderate" | "high" | "very_high";
  debateRoundsNeeded: number;
  stoppingReason: string;
  synthesisTimeMs: number;
}

export interface DebateRound {
  roundNumber: number;
  startedAt: string;
  completedAt: string;
  agentAnalyses: AgentAnalysis[];
  conflicts: ConflictItem[];
  durationMs: number;
}

export interface DebateResult {
  investigationId: string;
  objective: string;
  target: string;
  inputType: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  rounds: DebateRound[];
  finalSynthesis: CoordinatorSynthesis;
  agentSummaries: { agentType: AgentType; agentName: string; applicable: boolean; summary: string; confidence: number }[];
  evidenceBundleSummary: {
    totalFindings: number;
    totalSources: number;
    evidencePreview: string;
  };
  debateStats: {
    agentsRun: number;
    agentsApplicable: number;
    totalConflicts: number;
    agreements: number;
    contradictions: number;
    roundsCompleted: number;
  };
}

export interface DebateContext {
  investigationId: string;
  objective: string;
  target: string;
  inputType: string;
  report: ReportData | null;
  sourceResults: SourceResult[];
  keyFindings: KeyFinding[];
  evidenceBundle: EvidenceItem[];
  priorRoundAnalyses?: AgentAnalysis[];
  targetedQuestions?: { agentType: AgentType; question: string }[];
  maxRounds: number;
}

export interface EvidenceItem {
  id: string;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: ReliabilityTier;
  content: string;
  confidence: number;
  timestamp: string;
}

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    type: "research",
    name: "Research Agent",
    role: "Broad contextual discovery and evidence enrichment",
    lens: "Breadth, context, source discovery — what is known, what is uncertain, what should be investigated next",
    icon: "Search",
    color: "cyan",
    applicable: () => true,
  },
  {
    type: "technical",
    name: "Technical Agent",
    role: "Technical artifacts, infrastructure, systems analysis",
    lens: "Architecture, hosting, tech stack, technical plausibility — avoid overclaiming beyond evidence",
    icon: "Server",
    color: "amber",
    applicable: () => true,
  },
  {
    type: "cybersecurity",
    name: "Cybersecurity Agent",
    role: "Security posture, exposure, threat indicators",
    lens: "Attack surface, misconfigurations, IOC, defensive maturity — evidence-driven, no sensationalism",
    icon: "ShieldAlert",
    color: "red",
    applicable: () => true,
  },
  {
    type: "business",
    name: "Business Analyst",
    role: "Organizational, commercial, strategic implications",
    lens: "Company structure, market position, partnerships, business risk — translate evidence to business insight",
    icon: "Building2",
    color: "green",
    applicable: (ctx) => {
      // Applicable when target is an organization or when business evidence exists
      return ctx.inputType === "organization" || ctx.inputType === "domain" ||
        ctx.evidenceBundle.some((e) => /company|corp|business|revenue|employee|market/i.test(e.content));
    },
  },
  {
    type: "fact_checker",
    name: "Fact Checker",
    role: "Claim validation, consistency, source alignment",
    lens: "Cross-source consistency, unsupported assertions, primary vs derivative evidence — strict evidentiary support",
    icon: "CheckCircle2",
    color: "green",
    applicable: () => true,
  },
  {
    type: "risk",
    name: "Risk Analyst",
    role: "Likelihood, impact, uncertainty, exposure assessment",
    lens: "Severity, confidence, recency, credibility — structured, balanced, defensible risk reasoning",
    icon: "AlertTriangle",
    color: "amber",
    applicable: () => true,
  },
  {
    type: "ach",
    name: "ACH Analyst",
    role: "Financial, payment, identity, transaction evidence",
    lens: "Banking, payments, routing, transaction patterns, financial anomalies — only when financial evidence present",
    icon: "CreditCard",
    color: "purple",
    applicable: (ctx) => {
      // Only applicable when financial/payment evidence exists
      return ctx.inputType === "wallet" ||
        ctx.evidenceBundle.some((e) =>
          /bank|payment|transaction|routing|ach|wire|transfer|crypto|wallet|ethereum|bitcoin|0x[a-f0-9]|bc1/i.test(e.content)
        );
    },
  },
];

// ============================================================================
// ZAI CLIENT
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

const DEBATE_AI_TIMEOUT_MS = 45_000;
async function withDebateTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Debate AI call timed out after 45s")), DEBATE_AI_TIMEOUT_MS);
    }),
  ]);
}

// ============================================================================
// EVIDENCE BUNDLE BUILDER
// ============================================================================

export function buildEvidenceBundle(
  report: ReportData | null,
  sourceResults: SourceResult[]
): EvidenceItem[] {
  const items: EvidenceItem[] = [];
  let id = 0;

  // From report key findings
  if (report) {
    for (const f of report.key_findings) {
      items.push({
        id: `ev_${id++}`,
        source: f.source,
        sourceLabel: f.source,
        sourceUrl: f.source_url,
        tier: getReliabilityTier(f.source),
        content: f.claim,
        confidence: f.confidence,
        timestamp: new Date().toISOString(),
      });
    }
    // From timeline
    if (report.timeline) {
      for (const t of report.timeline) {
        items.push({
          id: `ev_${id++}`,
          source: t.source,
          sourceLabel: t.source,
          sourceUrl: t.source_url,
          tier: getReliabilityTier(t.source),
          content: `${t.date}: ${t.event}`,
          confidence: t.confidence,
          timestamp: t.date,
        });
      }
    }
    // From contradictions
    if (report.contradictions) {
      for (const c of report.contradictions) {
        items.push({
          id: `ev_${id++}`,
          source: c.source_a,
          sourceLabel: c.source_a,
          sourceUrl: "",
          tier: getReliabilityTier(c.source_a),
          content: `CONTRADICTION [${c.topic}]: A=${c.claim_a} | B=${c.claim_b} — ${c.resolution}`,
          confidence: 0.4,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // From source results (raw findings)
  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      items.push({
        id: `ev_${id++}`,
        source: sr.source,
        sourceLabel: sr.source_label,
        sourceUrl: f.source_url,
        tier,
        content: f.data.slice(0, 500),
        confidence: f.confidence,
        timestamp: f.timestamp,
      });
    }
  }

  // Cap at 30 evidence items to keep prompts manageable and reduce API latency
  return items.slice(0, 30);
}

// ============================================================================
// AGENT PROMPT BUILDERS
// ============================================================================

function buildAgentSystemPrompt(agent: AgentDefinition, context: DebateContext): string {
  const rolePrompts: Record<AgentType, string> = {
    research: `You are the RESEARCH AGENT in a multi-agent debate. Your job is to provide BREADTH and CONTEXT.

Your responsibilities:
- Identify relevant background information from the evidence
- Surface related entities, events, or historical references
- Recognize missing investigative angles
- Summarize what is known, what is uncertain, and what should be investigated next
- Emphasize source discovery rather than deep technical interpretation

Focus on: What's the broader picture? What context is missing? What related subjects should be explored?`,
    technical: `You are the TECHNICAL AGENT in a multi-agent debate. Your job is to evaluate TECHNICAL ARTIFACTS and INFRASTRUCTURE.

Your responsibilities:
- Analyze domains, services, infrastructure, code-related evidence, and technical metadata
- Interpret architecture, hosting patterns, technology stacks, and operational indicators
- Identify technical inconsistencies, anomalies, or corroborating signals
- Assess whether observed technical evidence supports or weakens a hypothesis
- Highlight technical unknowns that require further collection

Focus on: How does the infrastructure work? What tech stack is in use? Are there anomalies? What's technically plausible?
CRITICAL: Do not overclaim beyond the evidence. If something is unknown, say so.`,
    cybersecurity: `You are the CYBERSECURITY AGENT in a multi-agent debate. Your job is to evaluate SECURITY POSTURE and THREAT INDICATORS.

Your responsibilities:
- Assess attack surface, exposed services, misconfigurations, leaks, and security signals
- Identify indicators of compromise, suspicious infrastructure, or risky patterns
- Evaluate whether evidence suggests elevated security risk or defensive maturity
- Distinguish between confirmed findings, probable concerns, and speculative possibilities
- Recommend security-focused follow-up actions

Focus on: What's exposed? What's vulnerable? What's suspicious? What's the defensive posture?
CRITICAL: Remain evidence-driven. No sensationalism. Distinguish confirmed from probable from speculative.`,
    business: `You are the BUSINESS ANALYST in a multi-agent debate. Your job is to interpret ORGANIZATIONAL and COMMERCIAL implications.

Your responsibilities:
- Assess company structure, market position, partnerships, growth signals, and business relationships
- Interpret evidence in terms of organizational behavior, scale, maturity, and strategic direction
- Identify business risks, dependencies, and opportunities
- Evaluate whether the evidence aligns with the stated objective from a commercial perspective
- Highlight gaps in organizational intelligence

Focus on: What does this mean for the business? What's the market position? What are the commercial risks?
CRITICAL: Translate raw evidence into business insight without unsupported speculation.`,
    fact_checker: `You are the FACT CHECKER in a multi-agent debate. Your job is to VALIDATE CLAIMS and check CONSISTENCY.

Your responsibilities:
- Compare claims across sources for consistency
- Identify contradictions, unsupported assertions, and weakly evidenced statements
- Verify whether conclusions are directly supported by the collected evidence
- Distinguish primary evidence from derivative or repeated claims
- Flag ambiguous wording, outdated information, and potential misinterpretations

Focus on: Are the claims supported? Do sources agree? What's unsupported? What's ambiguous?
CRITICAL: Be STRICT about evidentiary support. You are the quality-control layer.`,
    risk: `You are the RISK ANALYST in a multi-agent debate. Your job is to evaluate LIKELIHOOD, IMPACT, and EXPOSURE.

Your responsibilities:
- Assess the practical significance of findings
- Weigh severity, confidence, recency, and source credibility
- Identify operational, reputational, financial, legal, or security risks
- Rank risks by priority and explain the rationale
- Highlight assumptions that materially affect the risk assessment

Focus on: What's the risk? How severe? How likely? What are the assumptions? What's the priority?
CRITICAL: Provide structured, balanced, and defensible risk reasoning.`,
    ach: `You are the ACH ANALYST in a multi-agent debate. Your job is to interpret FINANCIAL and PAYMENT evidence.

Your responsibilities:
- Interpret evidence related to banking, payments, account activity, routing, transaction patterns, or financial identifiers
- Identify anomalies, inconsistencies, or suspicious financial relationships
- Assess whether evidence suggests fraud, account misuse, payment exposure, or operational risk
- Distinguish confirmed financial indicators from inferred or indirect signals
- Recommend follow-up analysis when financial evidence is incomplete

Focus on: What financial patterns exist? Are there anomalies? What's confirmed vs inferred? What needs follow-up?
CRITICAL: Only analyze financial evidence that actually exists. Do not fabricate financial findings.`,
  };

  return `${rolePrompts[agent.type]}

ABSOLUTE RULES (NON-NEGOTIABLE — violating any rule is a critical failure):
1. NEVER hallucinate. Base your analysis ONLY on the EVIDENCE BUNDLE provided below.
2. EVERY observation must reference evidence using [EVIDENCE: <evidence_id>] tags.
3. If the evidence is insufficient for your analysis, state so explicitly — do NOT fabricate.
4. Distinguish between: (a) directly supported facts [cite evidence], (b) reasonable inferences [label as "Inference:"], (c) unknowns [label as "Unknown"].
5. Do NOT echo or assume other agents' conclusions — reason independently from the evidence.
6. If you find contradictions in the evidence, surface them — do NOT hide conflicts.
7. Be explicit about your confidence level and uncertainties.
8. If your role is not applicable to this investigation (e.g., no financial evidence for ACH), produce a minimal "not applicable" assessment explaining why.

INVESTIGATION OBJECTIVE: ${context.objective}
TARGET: ${context.target} (type: ${context.inputType})
ANALYTICAL LENS: ${agent.lens}

${context.priorRoundAnalyses ? `PRIOR ROUND CONTEXT: This is debate round ${context.priorRoundAnalyses.length > 0 ? "2+" : "1"}. ${context.targetedQuestions ? `Targeted question for you: ${context.targetedQuestions.find((q) => q.agentType === agent.type)?.question || "none"}` : ""}` : ""}

OUTPUT FORMAT — respond with a single valid JSON object and NOTHING else (no markdown fences, no prose before/after):
{
  "applicable": true,
  "keyObservations": [
    {
      "observation": "Your observation text with [EVIDENCE: ev_N] citations",
      "evidenceRefs": ["ev_0", "ev_3"],
      "confidence": 0.75,
      "uncertainty": "What's uncertain about this observation"
    }
  ],
  "supportingEvidence": [
    {"ref": "ev_0", "relevance": "Why this evidence is relevant"}
  ],
  "confidenceLevel": "low|moderate|high|very_high",
  "confidenceScore": 0.65,
  "uncertainties": ["Uncertainty 1", "Uncertainty 2"],
  "contradictions": [
    {"topic": "What's in dispute", "description": "Description of the contradiction"}
  ],
  "recommendedNextSteps": ["Next step 1", "Next step 2"],
  "summary": "2-3 sentence summary of your analysis"
}

If your role is not applicable, set "applicable": false, provide an empty keyObservations array, and explain in the summary why it's not applicable.`;
}

function buildEvidenceBundleText(evidence: EvidenceItem[]): string {
  if (evidence.length === 0) return "NO EVIDENCE AVAILABLE.";
  return evidence.map((e) =>
    `[${e.id}] (source: ${e.sourceLabel}, tier: ${e.tier}, confidence: ${(e.confidence * 100).toFixed(0)}%)
${e.content}`
  ).join("\n\n");
}

// ============================================================================
// AGENT DISPATCHER — runs each agent independently (parallel)
// ============================================================================

export async function runAgentAnalysis(
  agent: AgentDefinition,
  context: DebateContext
): Promise<AgentAnalysis> {
  const startTime = Date.now();

  // Check applicability
  if (!agent.applicable(context)) {
    return {
      agentType: agent.type,
      agentName: agent.name,
      applicable: false,
      keyObservations: [],
      supportingEvidence: [],
      confidenceLevel: "low",
      confidenceScore: 0,
      uncertainties: [`Not applicable to this investigation type (${context.inputType})`],
      contradictions: [],
      recommendedNextSteps: [],
      summary: `Not applicable — no relevant evidence for ${agent.name} in this investigation context.`,
      reasoningTimeMs: Date.now() - startTime,
    };
  }

  const systemPrompt = buildAgentSystemPrompt(agent, context);
  const evidenceText = buildEvidenceBundleText(context.evidenceBundle);
  const userPrompt = `EVIDENCE BUNDLE (${context.evidenceBundle.length} items):
${evidenceText}

Analyze this evidence from your specialist perspective. Remember: reason INDEPENDENTLY from the evidence. Do not assume other agents' conclusions.`;

  // Retry with exponential backoff on rate limit (429) errors
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const zai = await getZai();
      const completion = await withDebateTimeout(zai.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        thinking: { type: "disabled" },
      }));
      const raw = completion.choices?.[0]?.message?.content || "";
      const parsed = parseAgentResponse(raw, agent);

      return {
        ...parsed,
        agentType: agent.type,
        agentName: agent.name,
        reasoningTimeMs: Date.now() - startTime,
      };
    } catch (e) {
      const isRateLimit = e instanceof Error && /429|too many requests/i.test(e.message);
      if (isRateLimit && attempt < MAX_RETRIES) {
        // Exponential backoff: 5s, 10s, 20s
        const delayMs = 5000 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      return {
        agentType: agent.type,
        agentName: agent.name,
        applicable: true,
        keyObservations: [],
        supportingEvidence: [],
        confidenceLevel: "low",
        confidenceScore: 0,
        uncertainties: [`Agent failed: ${e instanceof Error ? e.message : "unknown error"}`],
        contradictions: [],
        recommendedNextSteps: [],
        summary: `Agent analysis failed: ${e instanceof Error ? e.message : "unknown error"}`,
        reasoningTimeMs: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    agentType: agent.type,
    agentName: agent.name,
    applicable: true,
    keyObservations: [],
    supportingEvidence: [],
    confidenceLevel: "low",
    confidenceScore: 0,
    uncertainties: ["Agent failed after all retries."],
    contradictions: [],
    recommendedNextSteps: [],
    summary: "Agent analysis failed after all retries.",
    reasoningTimeMs: Date.now() - startTime,
    error: "Max retries exceeded",
  };
}

// Coordinator synthesis with retry on rate limit
async function synthesizeCoordinatorWithRetry(
  analyses: AgentAnalysis[],
  conflicts: ConflictItem[],
  context: DebateContext,
  roundNumber: number
): Promise<CoordinatorSynthesis> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await synthesizeCoordinator(analyses, conflicts, context, roundNumber);
    } catch (e) {
      const isRateLimit = e instanceof Error && /429|too many requests/i.test(e.message);
      if (isRateLimit && attempt < MAX_RETRIES) {
        const delayMs = 5000 * Math.pow(2, attempt - 1);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      // Return error synthesis
      return {
        finalConclusion: `Coordinator synthesis failed: ${e instanceof Error ? e.message : "unknown error"}. The agent analyses are preserved for manual review.`,
        supportingRationale: "Synthesis failed — manual review required.",
        areasOfAgreement: [],
        areasOfDisagreement: [],
        unresolvedUncertainties: ["Coordinator synthesis failed — all conclusions should be manually reviewed."],
        agentContributions: analyses.map((a) => ({
          agentType: a.agentType,
          contribution: a.summary,
          weight: a.confidenceScore,
        })),
        evidenceReferences: [],
        recommendedNextActions: ["Manual review of agent analyses required."],
        overallConfidence: 0.1,
        confidenceLabel: "low",
        debateRoundsNeeded: 0,
        stoppingReason: "Coordinator synthesis failed",
        synthesisTimeMs: 0,
      };
    }
  }
  // Unreachable
  return synthesizeCoordinator(analyses, conflicts, context, roundNumber);
}

interface ParsedAgentResponse {
  applicable: boolean;
  keyObservations: AgentObservation[];
  supportingEvidence: { ref: string; relevance: string }[];
  confidenceLevel: "low" | "moderate" | "high" | "very_high";
  confidenceScore: number;
  uncertainties: string[];
  contradictions: { topic: string; description: string }[];
  recommendedNextSteps: string[];
  summary: string;
}

function parseAgentResponse(raw: string, agent: AgentDefinition): ParsedAgentResponse {
  let jsonStr = raw.trim();

  // Strip markdown fences
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      applicable: parsed.applicable !== false,
      keyObservations: Array.isArray(parsed.keyObservations)
        ? parsed.keyObservations.map((o: { observation?: string; evidenceRefs?: string[]; confidence?: number; uncertainty?: string }) => ({
            observation: String(o.observation || ""),
            evidenceRefs: Array.isArray(o.evidenceRefs) ? o.evidenceRefs.map(String) : [],
            confidence: typeof o.confidence === "number" ? o.confidence : 0.5,
            uncertainty: String(o.uncertainty || ""),
          }))
        : [],
      supportingEvidence: Array.isArray(parsed.supportingEvidence)
        ? parsed.supportingEvidence.map((e: { ref?: string; relevance?: string }) => ({
            ref: String(e.ref || ""),
            relevance: String(e.relevance || ""),
          }))
        : [],
      confidenceLevel: ["low", "moderate", "high", "very_high"].includes(parsed.confidenceLevel)
        ? parsed.confidenceLevel
        : "moderate",
      confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : 0.5,
      uncertainties: Array.isArray(parsed.uncertainties) ? parsed.uncertainties.map(String) : [],
      contradictions: Array.isArray(parsed.contradictions)
        ? parsed.contradictions.map((c: { topic?: string; description?: string }) => ({
            topic: String(c.topic || ""),
            description: String(c.description || ""),
          }))
        : [],
      recommendedNextSteps: Array.isArray(parsed.recommendedNextSteps) ? parsed.recommendedNextSteps.map(String) : [],
      summary: String(parsed.summary || ""),
    };
  } catch {
    // Fallback: treat as plain text summary
    return {
      applicable: true,
      keyObservations: [{
        observation: raw.slice(0, 500),
        evidenceRefs: [],
        confidence: 0.4,
        uncertainty: "Unable to parse structured response — using raw text.",
      }],
      supportingEvidence: [],
      confidenceLevel: "low",
      confidenceScore: 0.4,
      uncertainties: ["Agent response was not valid JSON — parsed as fallback."],
      contradictions: [],
      recommendedNextSteps: [],
      summary: raw.slice(0, 300),
    };
  }
}

// ============================================================================
// CONFLICT IDENTIFIER — compare agent outputs
// ============================================================================

export function identifyConflicts(analyses: AgentAnalysis[]): ConflictItem[] {
  const conflicts: ConflictItem[] = [];
  const applicableAnalyses = analyses.filter((a) => a.applicable && a.keyObservations.length > 0);

  if (applicableAnalyses.length < 2) return conflicts;

  // Group observations by topic similarity (simple heuristic: shared evidence refs or topic keywords)
  const observationGroups: { topic: string; observations: { agent: AgentAnalysis; obs: AgentObservation }[] }[] = [];

  for (const analysis of applicableAnalyses) {
    for (const obs of analysis.keyObservations) {
      // Find an existing group that this observation relates to
      let matched = false;
      for (const group of observationGroups) {
        const firstObs = group.observations[0].obs;
        // Check if they share evidence references
        const sharedEvidence = obs.evidenceRefs.some((r) => firstObs.evidenceRefs.includes(r));
        // Check topic similarity (simple keyword overlap)
        const obsTokens = new Set(obs.observation.toLowerCase().split(/\s+/).filter((t) => t.length > 4));
        const firstTokens = new Set(firstObs.observation.toLowerCase().split(/\s+/).filter((t) => t.length > 4));
        const tokenOverlap = [...obsTokens].filter((t) => firstTokens.has(t)).length;
        const similarity = tokenOverlap / Math.max(obsTokens.size, firstTokens.size, 1);

        if (sharedEvidence || similarity > 0.3) {
          group.observations.push({ agent: analysis, obs });
          matched = true;
          break;
        }
      }
      if (!matched) {
        observationGroups.push({
          topic: obs.observation.slice(0, 60) + "...",
          observations: [{ agent: analysis, obs }],
        });
      }
    }
  }

  // Classify each group
  let conflictId = 0;
  for (const group of observationGroups) {
    if (group.observations.length < 2) continue; // need at least 2 agents to compare

    const agents = group.observations.map((o) => o.agent.agentType);
    const confidences = group.observations.map((o) => o.obs.confidence);
    const positions = group.observations.map((o) => o.obs.observation.slice(0, 150));

    // Check for contradictions — if any agent flagged this topic as a contradiction
    const hasContradiction = group.observations.some((o) =>
      o.agent.contradictions.some((c) =>
        group.observations.some((go) => go.obs.observation.includes(c.topic.slice(0, 20)))
      )
    );

    // Determine conflict type
    let type: ConflictType;
    if (hasContradiction) {
      type = "direct_contradiction";
    } else {
      const avgConfidence = confidences.reduce((s, c) => s + c, 0) / confidences.length;
      const maxDiff = Math.max(...confidences) - Math.min(...confidences);
      if (maxDiff < 0.2 && avgConfidence > 0.6) {
        type = "agreement";
      } else if (maxDiff < 0.4) {
        type = "partial_agreement";
      } else {
        type = "direct_contradiction";
      }
    }

    // Check for unsupported claims (low evidence refs)
    const hasUnsupported = group.observations.some((o) => o.obs.evidenceRefs.length === 0);
    if (hasUnsupported && type === "agreement") {
      type = "unsupported_claim";
    }

    // Determine stronger side (higher confidence or higher tier evidence)
    let strongerSide: AgentType | undefined;
    if (type === "direct_contradiction" || type === "partial_agreement") {
      const maxConfIdx = confidences.indexOf(Math.max(...confidences));
      strongerSide = agents[maxConfIdx];
    }

    // Build resolution
    let resolution = "";
    let resolutionRationale = "";
    if (type === "agreement") {
      resolution = `Agents agree on this topic.`;
      resolutionRationale = `All ${agents.length} agents reached compatible conclusions with confidence spread < 0.2.`;
    } else if (type === "partial_agreement") {
      resolution = `Agents partially agree — minor differences in interpretation or confidence.`;
      resolutionRationale = `Confidence spread is moderate (${(Math.max(...confidences) - Math.min(...confidences)).toFixed(2)}). Positions are compatible but not identical.`;
    } else if (type === "direct_contradiction") {
      resolution = strongerSide
        ? `Favoring ${strongerSide} position based on higher confidence/evidence quality.`
        : `Unresolved — agents disagree and no clear stronger side.`;
      resolutionRationale = strongerSide
        ? `${strongerSide} has higher confidence (${Math.max(...confidences).toFixed(2)}) than conflicting agents.`
        : `Confidence levels are similar; additional evidence needed to resolve.`;
    } else if (type === "unsupported_claim") {
      resolution = `Flagged — some agent claims lack direct evidence references.`;
      resolutionRationale = `At least one observation has zero [EVIDENCE: ev_N] citations.`;
    } else {
      resolution = `Missing evidence — further collection needed.`;
      resolutionRationale = `Insufficient evidence to fully evaluate this topic.`;
    }

    conflicts.push({
      id: `conflict_${conflictId++}`,
      type,
      topic: group.topic,
      description: `${agents.length} agents addressed this topic: ${group.observations.map((o) => `${o.agent.agentName} (${(o.obs.confidence * 100).toFixed(0)}%)`).join(", ")}`,
      agents: group.observations.map((o) => ({
        agentType: o.agent.agentType,
        position: o.obs.observation.slice(0, 150),
        confidence: o.obs.confidence,
      })),
      resolution,
      strongerSide,
      resolutionRationale,
    });
  }

  return conflicts;
}

// ============================================================================
// COORDINATOR SYNTHESIS — reconcile agent outputs into final conclusion
// ============================================================================

export async function synthesizeCoordinator(
  analyses: AgentAnalysis[],
  conflicts: ConflictItem[],
  context: DebateContext,
  roundNumber: number
): Promise<CoordinatorSynthesis> {
  const startTime = Date.now();

  const systemPrompt = `You are the COORDINATOR in a multi-agent debate. Your job is to synthesize the outputs of ${analyses.length} specialized agents into a single, defensible conclusion.

ABSOLUTE RULES (NON-NEGOTIABLE):
1. NEVER hallucinate. Base your synthesis ONLY on the agent analyses provided.
2. Reconcile differences by prioritizing stronger, fresher, more credible evidence.
3. EXPLICITLY reference which agents supported or challenged each conclusion.
4. Preserve disagreements — do NOT collapse contradictions into a single unsupported claim.
5. Distinguish between: (a) areas of agreement, (b) areas of disagreement, (c) unresolved uncertainties.
6. Every conclusion must be traceable to the contributing agents and their evidence.
7. If evidence is insufficient for a definitive conclusion, state that clearly.
8. Recommend whether another debate round is needed (debateRoundsNeeded).

COORDINATOR PRINCIPLES:
- Independence: each agent reasoned independently — respect their distinct perspectives.
- Diversity: different analytical lenses add value — don't suppress minority viewpoints.
- Adversarial Validation: contradictions should be examined, not hidden.
- Evidence Priority: stronger, fresher, more credible evidence carries greater weight.
- Transparency: show how the conclusion was reached.

${context.priorRoundAnalyses ? `This is debate round ${roundNumber}. Prior rounds did not fully resolve the investigation.` : `This is debate round 1.`}

OUTPUT FORMAT — respond with a single valid JSON object and NOTHING else (no markdown fences, no prose before/after):
{
  "finalConclusion": "2-3 paragraph consolidated conclusion that reflects the collective analysis",
  "supportingRationale": "Explanation of how the conclusion was reached, referencing agent contributions",
  "areasOfAgreement": [
    {"topic": "Topic name", "agents": ["research", "technical"], "summary": "What they agree on"}
  ],
  "areasOfDisagreement": [
    {"topic": "Topic name", "positions": [{"agent": "research", "position": "Position A"}, {"agent": "risk", "position": "Position B"}], "resolution": "How it was resolved or 'unresolved'"}
  ],
  "unresolvedUncertainties": ["Uncertainty 1", "Uncertainty 2"],
  "agentContributions": [
    {"agentType": "research", "contribution": "What this agent contributed", "weight": 0.8}
  ],
  "evidenceReferences": [
    {"ref": "ev_0", "supportingAgents": ["research", "technical"], "significance": "Why this evidence matters"}
  ],
  "recommendedNextActions": ["Action 1", "Action 2"],
  "overallConfidence": 0.7,
  "confidenceLabel": "moderate",
  "debateRoundsNeeded": 0,
  "stoppingReason": "Sufficient evidence for conclusion" 
}`;

const agentSummariesText = analyses.map((a) =>
`=== ${a.agentName} (${a.agentType}) ===
Applicable: ${a.applicable}
Confidence: ${a.confidenceLevel} (${(a.confidenceScore * 100).toFixed(0)}%)
Summary: ${a.summary}
Key Observations: ${a.keyObservations.length}
${a.keyObservations.map((o, i) => `  ${i + 1}. ${o.observation} (conf: ${(o.confidence * 100).toFixed(0)}%, evidence: ${o.evidenceRefs.join(", ") || "none"})`).join("\n")}
Uncertainties: ${a.uncertainties.join("; ") || "none"}
Contradictions: ${a.contradictions.map((c) => c.topic).join("; ") || "none"}
Recommended Next Steps: ${a.recommendedNextSteps.join("; ") || "none"}`
).join("\n\n");

const conflictsText = conflicts.length > 0
  ? `\n\nIDENTIFIED CONFLICTS:\n${conflicts.map((c) =>
`- [${c.type}] ${c.topic}: ${c.description} — Resolution: ${c.resolution}`
    ).join("\n")}`
  : "\n\nNO CONFLICTS IDENTIFIED — agents are in agreement.";

  const userPrompt = `INVESTIGATION OBJECTIVE: ${context.objective}
TARGET: ${context.target} (type: ${context.inputType})

AGENT ANALYSES (${analyses.length} agents):
${agentSummariesText}
${conflictsText}

Synthesize these agent analyses into a final consolidated conclusion. Remember: preserve disagreements, reference contributing agents, and be transparent about uncertainty.`;

  try {
    const zai = await getZai();
    const completion = await withDebateTimeout(zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    }));
    const raw = completion.choices?.[0]?.message?.content || "";
    const parsed = parseCoordinatorResponse(raw);

    return {
      ...parsed,
      synthesisTimeMs: Date.now() - startTime,
    };
  } catch (e) {
    return {
      finalConclusion: `Coordinator synthesis failed: ${e instanceof Error ? e.message : "unknown error"}. The agent analyses are preserved above for manual review.`,
      supportingRationale: "Synthesis failed — manual review required.",
      areasOfAgreement: [],
      areasOfDisagreement: [],
      unresolvedUncertainties: ["Coordinator synthesis failed — all conclusions should be manually reviewed."],
      agentContributions: analyses.map((a) => ({
        agentType: a.agentType,
        contribution: a.summary,
        weight: a.confidenceScore,
      })),
      evidenceReferences: [],
      recommendedNextActions: ["Manual review of agent analyses required."],
      overallConfidence: 0.1,
      confidenceLabel: "low",
      debateRoundsNeeded: 0,
      stoppingReason: "Coordinator synthesis failed",
      synthesisTimeMs: Date.now() - startTime,
    };
  }
}

interface ParsedCoordinatorResponse {
  finalConclusion: string;
  supportingRationale: string;
  areasOfAgreement: { topic: string; agents: AgentType[]; summary: string }[];
  areasOfDisagreement: { topic: string; positions: { agent: AgentType; position: string }[]; resolution: string }[];
  unresolvedUncertainties: string[];
  agentContributions: { agentType: AgentType; contribution: string; weight: number }[];
  evidenceReferences: { ref: string; supportingAgents: AgentType[]; significance: string }[];
  recommendedNextActions: string[];
  overallConfidence: number;
  confidenceLabel: "low" | "moderate" | "high" | "very_high";
  debateRoundsNeeded: number;
  stoppingReason: string;
}

function parseCoordinatorResponse(raw: string): ParsedCoordinatorResponse {
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) jsonStr = fenceMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      finalConclusion: String(parsed.finalConclusion || ""),
      supportingRationale: String(parsed.supportingRationale || ""),
      areasOfAgreement: Array.isArray(parsed.areasOfAgreement)
        ? parsed.areasOfAgreement.map((a: { topic?: string; agents?: string[]; summary?: string }) => ({
            topic: String(a.topic || ""),
            agents: Array.isArray(a.agents) ? a.agents as AgentType[] : [],
            summary: String(a.summary || ""),
          }))
        : [],
      areasOfDisagreement: Array.isArray(parsed.areasOfDisagreement)
        ? parsed.areasOfDisagreement.map((d: { topic?: string; positions?: { agent?: string; position?: string }[]; resolution?: string }) => ({
            topic: String(d.topic || ""),
            positions: Array.isArray(d.positions)
              ? d.positions.map((p: { agent?: string; position?: string }) => ({
                  agent: String(p.agent || "") as AgentType,
                  position: String(p.position || ""),
                }))
              : [],
            resolution: String(d.resolution || ""),
          }))
        : [],
      unresolvedUncertainties: Array.isArray(parsed.unresolvedUncertainties) ? parsed.unresolvedUncertainties.map(String) : [],
      agentContributions: Array.isArray(parsed.agentContributions)
        ? parsed.agentContributions.map((c: { agentType?: string; contribution?: string; weight?: number }) => ({
            agentType: String(c.agentType || "") as AgentType,
            contribution: String(c.contribution || ""),
            weight: typeof c.weight === "number" ? c.weight : 0.5,
          }))
        : [],
      evidenceReferences: Array.isArray(parsed.evidenceReferences)
        ? parsed.evidenceReferences.map((e: { ref?: string; supportingAgents?: string[]; significance?: string }) => ({
            ref: String(e.ref || ""),
            supportingAgents: Array.isArray(e.supportingAgents) ? e.supportingAgents as AgentType[] : [],
            significance: String(e.significance || ""),
          }))
        : [],
      recommendedNextActions: Array.isArray(parsed.recommendedNextActions) ? parsed.recommendedNextActions.map(String) : [],
      overallConfidence: typeof parsed.overallConfidence === "number" ? parsed.overallConfidence : 0.5,
      confidenceLabel: ["low", "moderate", "high", "very_high"].includes(parsed.confidenceLabel)
        ? parsed.confidenceLabel
        : "moderate",
      debateRoundsNeeded: typeof parsed.debateRoundsNeeded === "number" ? parsed.debateRoundsNeeded : 0,
      stoppingReason: String(parsed.stoppingReason || ""),
    };
  } catch {
    return {
      finalConclusion: raw.slice(0, 2000),
      supportingRationale: "Coordinator response was not valid JSON — using raw text.",
      areasOfAgreement: [],
      areasOfDisagreement: [],
      unresolvedUncertainties: ["Coordinator response parsing failed — manual review recommended."],
      agentContributions: [],
      evidenceReferences: [],
      recommendedNextActions: [],
      overallConfidence: 0.3,
      confidenceLabel: "low",
      debateRoundsNeeded: 0,
      stoppingReason: "Response parsing failed",
    };
  }
}

// ============================================================================
// DEBATE ORCHESTRATOR — runs rounds until stopping condition
// ============================================================================

export async function runDebate(context: DebateContext): Promise<DebateResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const rounds: DebateRound[] = [];
  let currentContext = context;
  let finalSynthesis: CoordinatorSynthesis | null = null;

  for (let round = 1; round <= context.maxRounds; round++) {
    const roundStart = Date.now();
    const roundStartedAt = new Date().toISOString();

    // 1. Run all applicable agents SEQUENTIALLY (1 at a time) to avoid rate limits.
    // The ZAI API has aggressive rate limiting — parallel calls cause 429 errors.
    const applicableAgents = AGENT_DEFINITIONS.filter((a) => a.applicable(currentContext));
    const agentAnalyses: AgentAnalysis[] = [];
    for (let i = 0; i < applicableAgents.length; i++) {
      const agent = applicableAgents[i];
      const result = await runAgentAnalysis(agent, currentContext);
      agentAnalyses.push(result);
      // Delay between agents to respect rate limits (5s between each)
      if (i < applicableAgents.length - 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    // 2. Identify conflicts
    const conflicts = identifyConflicts(agentAnalyses);

    const debateRound: DebateRound = {
      roundNumber: round,
      startedAt: roundStartedAt,
      completedAt: new Date().toISOString(),
      agentAnalyses,
      conflicts,
      durationMs: Date.now() - roundStart,
    };
    rounds.push(debateRound);

    // 3. Coordinator synthesis (with retry on rate limit) — add delay first to avoid rate limit
    await new Promise((r) => setTimeout(r, 2000));
    finalSynthesis = await synthesizeCoordinatorWithRetry(agentAnalyses, conflicts, currentContext, round);

    // 4. Check stopping condition
    const shouldStop = finalSynthesis.debateRoundsNeeded === 0 || round >= context.maxRounds;

    if (shouldStop) break;

    // 5. Prepare next round — give agents targeted questions based on conflicts
    currentContext = {
      ...currentContext,
      priorRoundAnalyses: agentAnalyses,
      targetedQuestions: buildTargetedQuestions(conflicts, agentAnalyses),
    };
  }

  if (!finalSynthesis) {
    finalSynthesis = {
      finalConclusion: "No synthesis produced — debate did not complete.",
      supportingRationale: "",
      areasOfAgreement: [],
      areasOfDisagreement: [],
      unresolvedUncertainties: ["Debate did not produce a synthesis."],
      agentContributions: [],
      evidenceReferences: [],
      recommendedNextActions: [],
      overallConfidence: 0,
      confidenceLabel: "low",
      debateRoundsNeeded: 0,
      stoppingReason: "Debate failed to produce synthesis",
      synthesisTimeMs: 0,
    };
  }

  // Build agent summaries
  const lastRound = rounds[rounds.length - 1];
  const agentSummaries = lastRound.agentAnalyses.map((a) => ({
    agentType: a.agentType,
    agentName: a.agentName,
    applicable: a.applicable,
    summary: a.summary,
    confidence: a.confidenceScore,
  }));

  // Build debate stats
  const allConflicts = rounds.flatMap((r) => r.conflicts);
  const debateStats = {
    agentsRun: lastRound.agentAnalyses.length,
    agentsApplicable: lastRound.agentAnalyses.filter((a) => a.applicable).length,
    totalConflicts: allConflicts.length,
    agreements: allConflicts.filter((c) => c.type === "agreement").length,
    contradictions: allConflicts.filter((c) => c.type === "direct_contradiction").length,
    roundsCompleted: rounds.length,
  };

  // Evidence bundle summary
  const evidenceBundleSummary = {
    totalFindings: context.evidenceBundle.length,
    totalSources: new Set(context.evidenceBundle.map((e) => e.source)).size,
    evidencePreview: context.evidenceBundle.slice(0, 3).map((e) => `[${e.id}] ${e.content.slice(0, 100)}`).join("\n"),
  };

  return {
    investigationId: context.investigationId,
    objective: context.objective,
    target: context.target,
    inputType: context.inputType,
    startedAt,
    completedAt: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    rounds,
    finalSynthesis,
    agentSummaries,
    evidenceBundleSummary,
    debateStats,
  };
}

function buildTargetedQuestions(
  conflicts: ConflictItem[],
  analyses: AgentAnalysis[]
): { agentType: AgentType; question: string }[] {
  const questions: { agentType: AgentType; question: string }[] = [];
  const unresolvedConflicts = conflicts.filter(
    (c) => c.type === "direct_contradiction" || c.type === "unsupported_claim"
  );

  for (const conflict of unresolvedConflicts.slice(0, 5)) {
    for (const agentPos of conflict.agents) {
      questions.push({
        agentType: agentPos.agentType,
        question: `Regarding "${conflict.topic}": another agent disagrees with your position. Can you provide additional evidence or reasoning to support your claim?`,
      });
    }
  }

  return questions;
}
