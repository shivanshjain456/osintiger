"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, MessageSquare, ShieldCheck, AlertCircle, Brain, ChevronDown,
  ChevronRight, Link2, FileText, AlertTriangle, Lightbulb, Clock, Database,
  Network, Eye, GitBranch, Sparkles, X, RefreshCw, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaimText } from "./AttributionTag";
import type { PollResponse, QAAnswer, ConversationTurn, Citation } from "@/lib/osint/client";
import { askQuestionLegacy } from "@/lib/osint/client";

interface Props {
  poll: PollResponse;
}

interface QandAEntry {
  question: string;
  answer: QAAnswer;
  timestamp: string;
}

const INTENT_ICONS: Record<string, React.ElementType> = {
  factual_lookup: Database,
  comparative: GitBranch,
  timeline: Clock,
  relationship: Network,
  risk: AlertTriangle,
  synthesis: Brain,
  evidence_request: FileText,
  follow_up: MessageSquare,
  disambiguation: Eye,
  unknown: Sparkles,
};

const INTENT_COLORS: Record<string, string> = {
  factual_lookup: "text-[var(--hack-cyan)]",
  comparative: "text-[var(--hack-purple)]",
  timeline: "text-[var(--hack-amber)]",
  relationship: "text-[var(--hack-green)]",
  risk: "text-[var(--hack-red)]",
  synthesis: "text-[var(--hack-cyan)]",
  evidence_request: "text-[var(--hack-green)]",
  follow_up: "text-[var(--hack-gray)]",
  disambiguation: "text-[var(--hack-amber)]",
  unknown: "text-[var(--hack-gray)]",
};

const SUFFICIENCY_COLORS: Record<string, string> = {
  sufficient: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  partial: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  insufficient: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  very_high: "text-[var(--hack-green)]",
  high: "text-[var(--hack-green)]",
  moderate: "text-[var(--hack-amber)]",
  low: "text-[var(--hack-red)]",
};

const TIER_COLORS: Record<number, string> = {
  5: "text-[var(--hack-green)] border-[var(--hack-green)]/40",
  4: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40",
  3: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40",
  2: "text-[var(--hack-orange)] border-[var(--hack-orange)]/40",
  1: "text-[var(--hack-red)] border-[var(--hack-red)]/40",
};

export function AskAIPanel({ poll }: Props) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QandAEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [useKB, setUseKB] = useState(true);
  const [expandedAnswers, setExpandedAnswers] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new Q&A
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setQuestion("");
    try {
      // Build conversation history for the API
      const conversationHistory: ConversationTurn[] = history.map((h) => ({
        question: h.question,
        answer: h.answer.answer,
        timestamp: h.timestamp,
      }));

      const res = await askQuestionLegacy(poll.investigation_id, q, {
        conversationHistory,
        useKnowledgeBase: useKB,
      });

      const newEntry: QandAEntry = {
        question: q,
        answer: res.structured_answer,
        timestamp: res.answered_at || new Date().toISOString(),
      };
      setHistory((prev) => [...prev, newEntry]);
      // Auto-expand the latest answer
      setExpandedAnswers((prev) => new Set([...prev, history.length]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get answer");
    } finally {
      setLoading(false);
    }
  }, [question, loading, history, poll.investigation_id, useKB]);

  const toggleExpand = (idx: number) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const suggestions = [
    "What is the primary risk associated with this target?",
    "Summarize the key entities and their relationships.",
    "What intelligence is missing from this report?",
    "Which sources provided the highest-confidence findings?",
    "Show me the evidence for the main claims.",
    "What is the timeline of key events?",
  ];

  return (
    <div className="border border-[var(--hack-border)] bg-black/30 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--hack-border)] px-3 py-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
            {"» EVIDENCE-GROUNDED Q&A — ZERO HALLUCINATION"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseKB((v) => !v)}
            className={`flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] uppercase transition ${
              useKB
                ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]"
                : "border-[var(--hack-border)] bg-black/30 text-[var(--hack-gray)]"
            }`}
            title="Toggle Knowledge Base retrieval (cross-investigation)"
          >
            <Database className="h-2.5 w-2.5" /> KB
          </button>
          <span className="font-mono text-[9px] text-[var(--hack-gray)]">
            {history.length} answered
          </span>
        </div>
      </div>

      {/* Q&A History */}
      <div
        ref={scrollRef}
        className="max-h-[600px] overflow-y-auto p-3 space-y-3 custom-scroll"
      >
        {history.length === 0 && !loading && (
          <div className="text-center py-6">
            <Brain className="h-8 w-8 text-[var(--hack-cyan)]/40 mx-auto mb-3" />
            <p className="font-mono text-[10px] text-[var(--hack-gray)] mb-2">
              {"» Ask any question about this report or the Knowledge Base."}
            </p>
            <p className="font-mono text-[9px] text-[var(--hack-gray)]/60 mb-4">
              {"» Every answer is grounded in collected evidence with mandatory citations."}
              <br />
              {"» The system refuses when evidence is insufficient — never hallucinates."}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center max-w-2xl">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setQuestion(s)}
                  className="font-mono text-[10px] border border-[var(--hack-border)] bg-black/40 px-2 py-1 text-[var(--hack-gray)] hover:border-[var(--hack-cyan)]/50 hover:text-[var(--hack-cyan)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((entry, i) => {
          const isExpanded = expandedAnswers.has(i);
          const ans = entry.answer;
          const IntentIcon = INTENT_ICONS[ans.interpretation.intent] || Sparkles;
          const intentColor = INTENT_COLORS[ans.interpretation.intent] || "text-[var(--hack-gray)]";
          const isRefusal = ans.answerMode === "refusal";
          const isClarification = ans.answerMode === "clarification";
          return (
            <div key={i} className="space-y-1.5">
              {/* Question */}
              <div className="flex justify-end">
                <div className="bg-[var(--hack-green)]/10 border border-[var(--hack-green)]/30 px-3 py-1.5 max-w-[85%]">
                  <p className="font-mono text-xs text-[var(--hack-green)]">{entry.question}</p>
                </div>
              </div>

              {/* Answer */}
              <div className="flex justify-start">
                <div className={`bg-black/40 border px-3 py-2 max-w-[95%] w-full ${
                  isRefusal ? "border-[var(--hack-red)]/40" : isClarification ? "border-[var(--hack-amber)]/40" : "border-[var(--hack-border)]"
                }`}>
                  {/* Answer header — intent + confidence + sufficiency */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {isRefusal ? (
                      <XCircle className="h-3 w-3 text-[var(--hack-red)]" />
                    ) : isClarification ? (
                      <AlertCircle className="h-3 w-3 text-[var(--hack-amber)]" />
                    ) : ans.citations.length > 0 ? (
                      <ShieldCheck className="h-3 w-3 text-[var(--hack-green)]" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-[var(--hack-amber)]" />
                    )}
                    <span className={`font-mono text-[9px] uppercase tracking-wider ${isRefusal ? "text-[var(--hack-red)]" : "text-[var(--hack-gray)]"}`}>
                      {isRefusal ? "Refused — insufficient evidence" : isClarification ? "Clarification needed" : ans.citations.length > 0 ? "Evidence-based" : "Limited evidence"}
                    </span>
                    {/* Intent badge */}
                    <span className={`flex items-center gap-1 font-mono text-[9px] border border-[var(--hack-border)] px-1.5 py-0.5 ${intentColor}`}>
                      <IntentIcon className="h-2.5 w-2.5" />
                      {ans.interpretation.intent.replace(/_/g, " ")}
                    </span>
                    {/* Answer mode badge */}
                    <span className="font-mono text-[9px] border border-[var(--hack-border)] px-1.5 py-0.5 text-[var(--hack-gray)]">
                      {ans.answerMode.replace(/_/g, " ")}
                    </span>
                    {/* Sufficiency badge */}
                    <span className={`font-mono text-[9px] border px-1.5 py-0.5 uppercase ${SUFFICIENCY_COLORS[ans.evidenceSufficiency]}`}>
                      {ans.evidenceSufficiency}
                    </span>
                    {/* Confidence */}
                    <span className={`font-mono text-[9px] ${CONFIDENCE_COLORS[ans.confidenceLabel]} ml-auto`}>
                      {(ans.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>

                  {/* Answer text */}
                  <div className="font-mono text-xs text-[var(--hack-gray)] leading-relaxed whitespace-pre-wrap">
                    <AnswerWithCitations text={ans.answer} citations={ans.citations} />
                  </div>

                  {/* Citations */}
                  {ans.citations.length > 0 && (
                    <div className="mt-2 border-t border-[var(--hack-border)] pt-2">
                      <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">
                        Citations ({ans.citations.length}):
                      </span>
                      <div className="space-y-1 mt-1">
                        {ans.citations.map((cit) => (
                          <div key={cit.index} className="border border-[var(--hack-border)] bg-black/40 p-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[9px] text-[var(--hack-green)] font-bold">[{cit.index}]</span>
                              <span className="font-mono text-[9px] text-[var(--hack-cyan)]">{cit.sourceLabel}</span>
                              <span className={`font-mono text-[8px] border px-1 ${TIER_COLORS[cit.tier] || "text-[var(--hack-gray)]"}`}>
                                T{cit.tier}
                              </span>
                              <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 ml-auto">
                                {(cit.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                            <p className="font-mono text-[9px] text-[var(--hack-gray)]/70 mt-1 line-clamp-2">{cit.snippet}</p>
                            {cit.sourceUrl && (
                              <a href={cit.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-[8px] text-[var(--hack-cyan)]/60 hover:underline mt-0.5 block truncate">
                                {cit.sourceUrl}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contradictions */}
                  {ans.contradictions.length > 0 && (
                    <div className="mt-2 border-t border-[var(--hack-amber)]/30 pt-2">
                      <span className="flex items-center gap-1 font-mono text-[9px] uppercase text-[var(--hack-amber)]">
                        <AlertTriangle className="h-2.5 w-2.5" /> Contradictions ({ans.contradictions.length}):
                      </span>
                      <div className="space-y-1 mt-1">
                        {ans.contradictions.map((c, ci) => (
                          <div key={ci} className="border border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5 p-1.5">
                            <p className="font-mono text-[9px] text-[var(--hack-amber)] mb-1">{c.topic}</p>
                            <div className="grid grid-cols-2 gap-1">
                              <div className="font-mono text-[9px] text-[var(--hack-gray)]">
                                <span className="text-[var(--hack-cyan)]">A ({c.sourceA}):</span> {c.claimA.slice(0, 80)}...
                              </div>
                              <div className="font-mono text-[9px] text-[var(--hack-gray)]">
                                <span className="text-[var(--hack-cyan)]">B ({c.sourceB}):</span> {c.claimB.slice(0, 80)}...
                              </div>
                            </div>
                            <p className="font-mono text-[9px] text-[var(--hack-amber)]/70 mt-1">
                              Stronger: {c.strongerSide === "neither" ? "neither" : `Side ${c.strongerSide.toUpperCase()}`} — {c.rationale}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Limitations */}
                  {ans.limitations.length > 0 && (
                    <div className="mt-2 border-t border-[var(--hack-border)] pt-2">
                      <span className="flex items-center gap-1 font-mono text-[9px] uppercase text-[var(--hack-red)]/70">
                        <AlertCircle className="h-2.5 w-2.5" /> Limitations:
                      </span>
                      <ul className="mt-0.5 space-y-0.5">
                        {ans.limitations.map((lim, li) => (
                          <li key={li} className="font-mono text-[9px] text-[var(--hack-gray)]/70">
                            {"• "}{lim}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expandable details: reasoning chain + evidence */}
                  <button
                    onClick={() => toggleExpand(i)}
                    className="flex items-center gap-1 mt-2 font-mono text-[9px] text-[var(--hack-cyan)] hover:underline"
                  >
                    {isExpanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                    {isExpanded ? "Hide details" : `Show reasoning + ${ans.evidenceUsed.length} evidence`}
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-3 border-t border-[var(--hack-border)] pt-2">
                      {/* Reasoning chain */}
                      <div>
                        <span className="flex items-center gap-1 font-mono text-[9px] uppercase text-[var(--hack-cyan)]">
                          <GitBranch className="h-2.5 w-2.5" /> Reasoning Chain:
                        </span>
                        <div className="space-y-1 mt-1">
                          {ans.reasoningChain.map((step, si) => (
                            <div key={si} className="flex gap-2 font-mono text-[9px]">
                              <span className="text-[var(--hack-cyan)] shrink-0">[{step.step}]</span>
                              <div className="flex-1">
                                <span className="text-[var(--hack-gray)]">{step.description}</span>
                                <p className="text-[var(--hack-gray)]/60 mt-0.5">{step.reasoning}</p>
                                {step.evidenceUsed.length > 0 && (
                                  <p className="text-[var(--hack-cyan)]/60 mt-0.5">evidence: {step.evidenceUsed.join(", ")}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Evidence used */}
                      <div>
                        <span className="flex items-center gap-1 font-mono text-[9px] uppercase text-[var(--hack-green)]">
                          <FileText className="h-2.5 w-2.5" /> Evidence Used ({ans.evidenceUsed.length}):
                        </span>
                        <div className="space-y-1 mt-1 max-h-48 overflow-y-auto custom-scroll">
                          {ans.evidenceUsed.map((ev, ei) => (
                            <div key={ei} className="border border-[var(--hack-border)] bg-black/40 p-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[9px] text-[var(--hack-green)] font-bold">ev_{ei}</span>
                                <span className="font-mono text-[9px] text-[var(--hack-cyan)]">{ev.sourceLabel}</span>
                                <span className={`font-mono text-[8px] border px-1 ${TIER_COLORS[ev.tier] || "text-[var(--hack-gray)]"}`}>T{ev.tier}</span>
                                <span className="font-mono text-[8px] text-[var(--hack-gray)]/60">{ev.source}</span>
                                <span className="font-mono text-[9px] text-[var(--hack-cyan)]/60 ml-auto">
                                  rel: {(ev.relevanceScore * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="font-mono text-[9px] text-[var(--hack-gray)]/70 mt-1 line-clamp-3">{ev.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Follow-up suggestions */}
                      {ans.followUpSuggestions.length > 0 && (
                        <div>
                          <span className="flex items-center gap-1 font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">
                            <Lightbulb className="h-2.5 w-2.5" /> Suggested Follow-ups:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ans.followUpSuggestions.map((sug, si) => (
                              <button
                                key={si}
                                onClick={() => setQuestion(sug)}
                                className="font-mono text-[9px] border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/5 px-1.5 py-0.5 text-[var(--hack-cyan)] hover:bg-[var(--hack-cyan)]/15"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center gap-3 font-mono text-[8px] text-[var(--hack-gray)]/50 border-t border-[var(--hack-border)] pt-1.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {ans.durationMs}ms
                        </span>
                        <span>scope: {ans.interpretation.scope.replace(/_/g, " ")}</span>
                        {ans.interpretation.targetEntities.length > 0 && (
                          <span>entities: {ans.interpretation.targetEntities.join(", ")}</span>
                        )}
                        {ans.interpretation.isFollowUp && <span className="text-[var(--hack-cyan)]">follow-up</span>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-black/40 border border-[var(--hack-border)] px-3 py-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-[var(--hack-cyan)]" />
                <span className="font-mono text-[10px] text-[var(--hack-gray)]">
                  {"» interpreting question, retrieving evidence, synthesizing answer…"}
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-[var(--hack-red)]/10 border border-[var(--hack-red)]/40 px-3 py-2">
              <p className="font-mono text-[10px] text-[var(--hack-red)]">
                {"» ERROR: "}{error}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--hack-border)] p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask();
              }
            }}
            placeholder="ask about this report or the knowledge base…"
            maxLength={1000}
            disabled={loading}
            className="flex-1 bg-black/40 border border-[var(--hack-border)] px-3 py-1.5 font-mono text-xs text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/50 focus:outline-none focus:border-[var(--hack-cyan)]/50"
          />
          <Button
            onClick={ask}
            disabled={loading || !question.trim()}
            size="sm"
            className="bg-[var(--hack-cyan)]/10 border border-[var(--hack-cyan)]/40 text-[var(--hack-cyan)] hover:bg-[var(--hack-cyan)]/20 font-mono text-xs"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-1.5 font-mono text-[8px] text-[var(--hack-gray)]/50">
          <span>conversation history preserved for follow-up context</span>
          {history.length > 0 && (
            <button
              onClick={() => { setHistory([]); setExpandedAnswers(new Set()); }}
              className="flex items-center gap-1 hover:text-[var(--hack-red)]"
            >
              <RefreshCw className="h-2.5 w-2.5" /> clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AnswerWithCitations — renders answer text with inline [EVIDENCE: ev_N] tags
// converted to superscript citation numbers
// ============================================================================

function AnswerWithCitations({ text, citations }: { text: string; citations: Citation[] }) {
  // Convert [EVIDENCE: ev_N] to [N] superscripts
  // Build a map from evidenceId -> citation index
  const evidenceToCitation = new Map<string, number>();
  for (const c of citations) {
    evidenceToCitation.set(c.evidenceId, c.index);
  }

  // Split on [EVIDENCE: ev_N] patterns
  const parts: React.ReactNode[] = [];
  const regex = /\[EVIDENCE:\s*(ev_\d+)\s*\]/gi;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    // Add the citation superscript
    const evId = match[1];
    const citationIdx = evidenceToCitation.get(evId);
    if (citationIdx !== undefined) {
      parts.push(
        <sup key={key++} className="text-[var(--hack-green)] font-bold ml-0.5 cursor-help" title={citations.find((c) => c.evidenceId === evId)?.sourceLabel}>
          [{citationIdx}]
        </sup>
      );
    } else {
      // Unknown citation — show as-is
      parts.push(<span key={key++} className="text-[var(--hack-gray)]/50">{match[0]}</span>);
    }
    lastIndex = regex.lastIndex;
  }
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}
