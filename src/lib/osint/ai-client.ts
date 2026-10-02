// AI client — wraps z-ai-web-dev-sdk chat completions for OSINT synthesis.
// Implements: model fallback (single backend model w/ retries), low temperature,
// JSON-structured output, and strict source-attribution enforcement.
// All AI calls are wrapped with a 60-second timeout to prevent indefinite hanging.
//
// BYO-LLM: If a user-configured LLM provider exists (OpenAI, Anthropic),
// all AI calls are routed through the user's credentials instead of the default ZAI SDK.
// See llm-provider.ts for the provider abstraction.

import ZAI from "z-ai-web-dev-sdk";
import { llmComplete } from "./llm-provider";

const AI_CALL_TIMEOUT_MS = 60_000; // 60 seconds — allows for ZAI SDK internal retries on 429

let zaiPromise: Promise<unknown> | null = null;
async function getZai() {
  if (!zaiPromise) zaiPromise = ZAI.create();
  return zaiPromise as Promise<{
    chat: {
      completions: {
        create: (args: {
          messages: { role: string; content: string }[];
          thinking: { type: string };
        }) => Promise<{ choices: { message: { content: string } }[] }>;
      };
    };
  }>;
}

/**
 * Wrap an AI call with a timeout. If the call doesn't complete within
 * AI_CALL_TIMEOUT_MS, it throws a timeout error that triggers the retry/fallback logic.
 */
async function withAiTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("AI call timed out after 60s")), AI_CALL_TIMEOUT_MS);
    }),
  ]);
}

/**
 * Unified AI completion call that routes to the user-configured provider
 * (OpenAI, Anthropic) if credentials exist, otherwise uses the default ZAI SDK.
 * This is the single entry point for all AI calls in ai-client.ts.
 */
async function unifiedChatComplete(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const response = await withAiTimeout(
    llmComplete({
      messages: [{ role: "user", content: userPrompt }],
      systemPrompt,
    })
  );
  return response.content;
}

export const SYNTH_SYSTEM_PROMPT = `You are OSINTiger, an expert OSINT analyst producing a structured intelligence report.
You will receive normalized findings from multiple public sources about a target.

ABSOLUTE RULES (NON-NEGOTIABLE):
1. EVERY factual claim MUST end with a source attribution tag in the form: [SOURCE: <source_label>, URL: <source_url>]
2. Use ONLY the data provided in the DATA FROM SOURCES block. Do NOT add any outside knowledge.
3. If data is contradictory, explicitly note "Contradiction noted:" and describe it.
4. If you cannot make a claim with the available data, write "Insufficient data."
5. Never invent sources, URLs, dates, or entities.
6. Assign a confidence score (0.0-1.0) to each finding based on source reliability & corroboration.
7. ZERO HALLUCINATION POLICY: If evidence is insufficient for any section, output "No verified evidence found." for that section.

OUTPUT FORMAT: respond with a single valid JSON object and NOTHING else (no markdown fences, no prose before/after):
{
  "executive_summary": "2-3 sentence overview grounded ONLY in provided data",
  "bluf": {
    "text": "Bottom Line Up Front: one paragraph strategic summary",
    "key_judgment": "the single most important judgment an analyst should take away",
    "confidence_level": "low|moderate|high|very_high"
  },
  "five_w1h": {
    "who": "who is the subject [SOURCE: ...]",
    "what": "what is happening/what is the subject [SOURCE: ...]",
    "when": "when did relevant events occur [SOURCE: ...]",
    "where": "where is the subject located/active [SOURCE: ...]",
    "why": "why is this relevant (motivation/context) [SOURCE: ...]",
    "how": "how does the subject operate [SOURCE: ...]"
  },
  "timeline": [
    {"date": "ISO date or 'unknown'", "event": "what happened [SOURCE: ...]", "source": "<label>", "source_url": "<url>", "confidence": 0.0}
  ],
  "key_findings": [
    {"claim": "factual claim text [SOURCE: <label>, URL: <url>]", "source": "<label>", "source_url": "<url>", "confidence": 0.0}
  ],
  "detailed_analysis": "Multi-paragraph structured analysis. Every sentence containing a fact must carry a [SOURCE: ...] tag.",
  "contradictions": [
    {"topic": "what is in dispute", "claim_a": "claim from source A [SOURCE: ...]", "source_a": "<label>", "claim_b": "conflicting claim from source B [SOURCE: ...]", "source_b": "<label>", "resolution": "how to resolve or 'unresolved'"}
  ],
  "risk_matrix": [
    {"risk": "description of the risk", "category": "financial|operational|reputational|legal|technical|geopolitical", "likelihood": "low|medium|high", "impact": "low|medium|high", "score": 1, "rationale": "why [SOURCE: ...]", "source": "<label>"}
  ],
  "collection_gaps": [
    {"area": "what intelligence is missing", "description": "why it matters", "recommended_sources": ["source1", "source2"], "priority": "low|medium|high"}
  ],
  "monitoring_recommendations": [
    {"action": "what to monitor going forward", "frequency": "daily|weekly|monthly|quarterly", "rationale": "why [SOURCE: ...]", "source": "<label>"}
  ],
  "link_graph": {
    "nodes": [
      {"id": "unique-id", "label": "entity name", "type": "person|organization|domain|ip|email|wallet|location|repository|social|document|phone", "weight": 1, "source": "<label>"}
    ],
    "edges": [
      {"from": "node-id", "to": "node-id", "label": "relationship type", "confidence": 0.0, "source": "<label>"}
    ]
  },
  "overall_confidence": 0.0,
  "hypotheses": [
    {"statement": "competing hypothesis about the target", "confidence": 0.0, "rationale": "why, grounded in sourced data"}
  ]
}

Keep it concise: 3-5 key_findings, 2-3 hypotheses, 0-3 timeline events. Omit empty arrays. Omit link_graph if not relevant.`;

export interface AISynthesisRaw {
  executive_summary: string;
  bluf?: {
    text: string;
    key_judgment: string;
    confidence_level: "low" | "moderate" | "high" | "very_high";
  };
  five_w1h?: {
    who: string;
    what: string;
    when: string;
    where: string;
    why: string;
    how: string;
  };
  timeline?: {
    date: string;
    event: string;
    source: string;
    source_url: string;
    confidence: number;
  }[];
  key_findings: {
    claim: string;
    source: string;
    source_url: string;
    confidence: number;
  }[];
  detailed_analysis: string;
  contradictions?: {
    topic: string;
    claim_a: string;
    source_a: string;
    claim_b: string;
    source_b: string;
    resolution: string;
  }[];
  risk_matrix?: {
    risk: string;
    category: "financial" | "operational" | "reputational" | "legal" | "technical" | "geopolitical";
    likelihood: "low" | "medium" | "high";
    impact: "low" | "medium" | "high";
    score: number;
    rationale: string;
    source: string;
  }[];
  collection_gaps?: {
    area: string;
    description: string;
    recommended_sources: string[];
    priority: "low" | "medium" | "high";
  }[];
  monitoring_recommendations?: {
    action: string;
    frequency: string;
    rationale: string;
    source: string;
  }[];
  link_graph?: {
    nodes: {
      id: string;
      label: string;
      type: "person" | "organization" | "domain" | "ip" | "email" | "wallet" | "location" | "repository" | "social" | "document" | "phone";
      weight: number;
      source: string;
    }[];
    edges: {
      from: string;
      to: string;
      label: string;
      confidence: number;
      source: string;
    }[];
  };
  overall_confidence: number;
  hypotheses: { statement: string; confidence: number; rationale: string }[];
}

function buildUserPrompt(target: string, inputType: string, findings: {
  source: string;
  source_label: string;
  source_url: string;
  data: string;
  confidence: number;
  timestamp: string;
}[]): string {
  // Ensure diversity: take top findings from EACH source so the AI sees
  // a balanced picture. Prioritize web_search results (which contain
  // contextual information about the entity) alongside high-confidence
  // technical findings (DNS, IP, certificates).
  const bySource = new Map<string, typeof findings>();
  for (const f of findings) {
    if (!bySource.has(f.source)) bySource.set(f.source, []);
    bySource.get(f.source)!.push(f);
  }

  // Take up to 3 findings per source, sorted by confidence within each source
  const diverse: typeof findings = [];
  for (const [, sourceFindings] of bySource) {
    sourceFindings.sort((a, b) => b.confidence - a.confidence);
    diverse.push(...sourceFindings.slice(0, 3));
  }

  // Sort the diverse set by confidence and cap at 20 total
  const sorted = diverse.sort((a, b) => b.confidence - a.confidence).slice(0, 20);
  const lines = sorted.map(
    (f, i) =>
      `[${i + 1}] SOURCE: ${f.source_label} | URL: ${f.source_url} | CONFIDENCE: ${f.confidence.toFixed(2)} | DATE: ${f.timestamp}\n    DATA: ${f.data.slice(0, 300)}`
  );
  return `TARGET: ${target}\nINPUT TYPE: ${inputType}\n\nDATA FROM SOURCES (${sorted.length} of ${findings.length} findings shown, diverse selection from ${bySource.size} sources):\n${lines.join("\n\n")}\n\nNow produce the JSON intelligence report following all rules.`;
}

function stripJsonFences(s: string): string {
  let t = s.trim();
  // remove markdown code fences
  t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  // find first { and last }
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    t = t.slice(first, last + 1);
  }
  return t;
}

/**
 * Attempt to repair common JSON issues from LLM responses:
 * - Trailing commas before } or ]
 * - Missing closing brackets
 * - Extra text after JSON
 */
function repairJson(s: string): string {
  let t = s.trim();
  // Remove trailing commas before } or ]
  t = t.replace(/,\s*([}\]])/g, "$1");
  // If the JSON is truncated (missing closing braces), try to close them
  const opens = (t.match(/{/g) || []).length;
  const closes = (t.match(/}/g) || []).length;
  if (opens > closes) {
    t += "}".repeat(opens - closes);
  }
  const openBrackets = (t.match(/\[/g) || []).length;
  const closeBrackets = (t.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    t += "]".repeat(openBrackets - closeBrackets);
  }
  return t;
}

export async function synthesizeReport(
  target: string,
  inputType: string,
  findings: { source: string; source_label: string; source_url: string; data: string; confidence: number; timestamp: string }[]
): Promise<{ raw: AISynthesisRaw | null; text: string; attempts: number; error?: string }> {
  const userPrompt = buildUserPrompt(target, inputType, findings);
  let lastErr: string | undefined;
  for (let attempt = 1; attempt <= 1; attempt++) {
    try {
      const text = await unifiedChatComplete(SYNTH_SYSTEM_PROMPT, userPrompt);
      if (!text) {
        lastErr = "Empty AI response";
        // No retry — single attempt only
        continue;
      }
      const parsed = stripJsonFences(text);
      try {
        const obj = JSON.parse(parsed) as AISynthesisRaw;
        return { raw: obj, text, attempts: attempt };
      } catch {
        // Log the raw response for debugging and try to extract partial JSON
        console.warn("[ai-client] JSON parse failed. Response length:", text.length, "First 200 chars:", text.slice(0, 200));
        // Try to repair and parse again
        try {
          const repaired = repairJson(parsed);
          const obj2 = JSON.parse(repaired) as AISynthesisRaw;
          return { raw: obj2, text, attempts: attempt };
        } catch {
          lastErr = "AI response was not valid JSON (repair failed)";
        }
        // No retry — single attempt only
        continue;
      }
    } catch (e) {
      lastErr = e instanceof Error ? e.message : "AI call failed";
      // Don't retry on 400 Bad Request (content filter, malformed request) — retrying won't help
      const isBadRequest = lastErr.includes("400") || lastErr.includes("contentFilter") || lastErr.includes("1301");
      if (isBadRequest) {
        console.error(`[ai-client] synthesizeReport failed with bad request (no retry): ${lastErr}`);
        return { raw: null, text: "", attempts: attempt, error: lastErr };
      }
      // Check for rate limit (429) — wait longer before retry
      const isRateLimit = lastErr.includes("429") || lastErr.includes("Too many requests");
      const waitMs = isRateLimit ? 10000 : attempt * 2000; // 10s for 429, 2s/4s for other errors
      console.warn(`[ai-client] synthesizeReport attempt ${attempt} failed: ${lastErr}. Retrying in ${waitMs}ms...`);
      // No retry — single attempt only
      continue;
    }
  }
  return { raw: null, text: "", attempts: 1, error: lastErr };
}

// ACH synthesis: given evidence + hypotheses from the main synthesis, ask AI to
// produce a consistency matrix.
export async function synthesizeACH(
  target: string,
  evidence: { text: string; source: string }[],
  hypotheses: { statement: string; confidence: number; rationale: string }[]
): Promise<{ matrix: string[][]; rationale: string } | null> {
  const ev = evidence.map((e, i) => `E${i + 1}: ${e.text} [SRC: ${e.source}]`).join("\n");
  const hs = hypotheses.map((h, i) => `H${i + 1}: ${h.statement}`).join("\n");
  const prompt = `You are performing Analysis of Competing Hypotheses (ACH) for OSINT target "${target}".
EVIDENCE:
${ev}

HYPOTHESES:
${hs}

For each evidence row and hypothesis column, output a single word: consistent, inconsistent, or neutral.
Then output a brief rationale paragraph (2-4 sentences) on which hypothesis the evidence most/least supports.

Respond with ONLY a JSON object:
{"matrix":[["consistent|inconsistent|neutral", ...], ...], "rationale":"..."}`;
  try {
    const text = await unifiedChatComplete("You output strictly valid JSON, nothing else.", prompt);
    const parsed = stripJsonFences(text);
    const obj = JSON.parse(parsed) as { matrix: string[][]; rationale: string };
    return obj;
  } catch {
    return null;
  }
}

// Crypto risk assessment via LLM.
export async function assessCryptoRisk(
  wallet: string,
  summary: string
): Promise<string> {
  try {
    const text = await unifiedChatComplete(
      "You are a blockchain forensics analyst. Given wallet activity data, produce a concise risk assessment (3-5 sentences). " +
      "Every factual observation must reference the provided data. Do not invent on-chain details. End with an overall risk verdict.",
      `Wallet: ${wallet}\n\nData:\n${summary}`
    );
    return text || "";
  } catch {
    return "Unable to generate AI risk assessment for this wallet.";
  }
}

// Visual intel analysis (VLM).
export async function analyzeImageWithVLM(
  imageUrl: string,
  question: string
): Promise<string> {
  const zai = await getZai();
  try {
    const response = await withAiTimeout(
      (zai as unknown as {
        chat: {
          completions: {
            createVision: (args: unknown) => Promise<{ choices: { message: { content: string } }[] }>;
          };
        };
      }).chat.completions.createVision({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: question },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        thinking: { type: "disabled" },
      })
    );
    return response.choices?.[0]?.message?.content || "";
  } catch (e) {
    throw e;
  }
}

// Ask AI About Report — follow-up Q&A using ONLY the collected report evidence.
// Strict evidence-grounded: refuses to answer if evidence is insufficient.
export async function askAIAboutReport(
  question: string,
  reportContext: string
): Promise<{ answer: string; evidence_based: boolean; sources_cited: string[] }> {
  const systemPrompt = `You are OSINTiger's report analyst. A user has asked a follow-up question about a completed intelligence report.

ABSOLUTE RULES (NON-NEGOTIABLE):
1. Answer ONLY using the provided REPORT CONTEXT. Do NOT use any outside knowledge.
2. Every factual claim in your answer MUST cite a source using [SOURCE: <label>, URL: <url>] tags copied from the report.
3. If the report does not contain sufficient evidence to answer the question, respond with EXACTLY: "I cannot answer this based on the collected evidence. This question requires additional OSINT collection."
4. Do not speculate, infer, or extrapolate beyond what is explicitly stated in the report.
5. Keep answers concise (3-6 sentences) and directly responsive to the question.
6. List all source labels you cited at the end as: SOURCES_CITED: [label1, label2, ...]

REPORT CONTEXT:
${reportContext}

USER QUESTION: ${question}`;

  try {
    const text = await unifiedChatComplete(systemPrompt, question);
    const evidence_based = !text.includes("I cannot answer this based on the collected evidence");
    // Extract SOURCES_CITED list if present
    const citedMatch = text.match(/SOURCES_CITED:\s*\[([^\]]*)\]/i);
    const sources_cited = citedMatch
      ? citedMatch[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      : [];
    // Remove the SOURCES_CITED line from the answer
    const answer = text.replace(/SOURCES_CITED:\s*\[[^\]]*\]/i, "").trim();
    return { answer, evidence_based, sources_cited };
  } catch (e) {
    return {
      answer: `Unable to generate answer: ${e instanceof Error ? e.message : "AI call failed"}`,
      evidence_based: false,
      sources_cited: [],
    };
  }
}
