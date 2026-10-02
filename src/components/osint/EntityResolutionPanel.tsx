"use client";

import { useState, useEffect } from "react";
import { Loader2, Users, ChevronDown, ChevronRight, GitMerge, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

// =====================
// Types
// =====================

interface EntityRecord { id: string; rawValue: string; normalizedValue: string; type: string; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; timestamp: string; attributes: Record<string, string>; }
interface SignalScore { type: string; score: number; weight: number; contribution: number; explanation: string; }
interface ResolutionCandidate { id: string; recordA: EntityRecord; recordB: EntityRecord; confidence: number; signals: SignalScore[]; outcome: string; merged: boolean; explanation: string; conflicts: { field: string; valueA: string; valueB: string }[]; }
interface CanonicalIdentity { id: string; primaryName: string; normalizedName: string; type: string; aliases: string[]; sourceRecords: { recordId: string; rawValue: string; source: string; sourceLabel: string; confidence: number }[]; confidence: number; createdAt: string; updatedAt: string; mergeHistory: { timestamp: string; action: string; detail: string }[]; }

interface EntityResolutionReport {
  records: EntityRecord[];
  candidates: ResolutionCandidate[];
  canonicalIdentities: CanonicalIdentity[];
  assessment: { totalRecords: number; totalCandidates: number; autoMerged: number; manualReview: number; rejected: number; canonicalIdentities: number; duplicatesResolved: number; avgConfidence: number; explanation: string; };
  meta: { sourcesAnalyzed: number; findingsAnalyzed: number; generatedAt: string };
}

interface Props { investigationId: string; apiPath: "standard" | "agent"; }

const OUTCOME_ICONS: Record<string, React.ElementType> = { auto_merge: GitMerge, manual_review: AlertTriangle, reject: XCircle };
const OUTCOME_COLORS: Record<string, string> = { auto_merge: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10", manual_review: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10", reject: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10" };

const TYPE_COLORS: Record<string, string> = { domain: "text-[var(--hack-amber)]", ip: "text-[var(--hack-red)]", email: "text-[var(--hack-purple)]", organization: "text-[var(--hack-cyan)]", person: "text-[var(--hack-green)]", wallet: "text-[var(--hack-amber)]", username: "text-[var(--hack-purple)]" };

export function EntityResolutionPanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<EntityResolutionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSecs, setExpandedSecs] = useState<Set<string>>(new Set(["identities"]));
  const [viewMode, setViewMode] = useState<"identities" | "candidates">("identities");

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/resolution`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled && data.report) { setReport(data.report); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» resolving entity identities..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { assessment, records, candidates, canonicalIdentities } = report;

  const toggleSec = (s: string) => setExpandedSecs((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Assessment */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Entity Resolution</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Avg Confidence</div>
              <div className="font-mono text-lg font-bold text-[var(--hack-green)]">{(assessment.avgConfidence * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Records" value={assessment.totalRecords} />
        <Stat label="Candidates" value={assessment.totalCandidates} />
        <Stat label="Merged" value={assessment.autoMerged} color="green" />
        <Stat label="Review" value={assessment.manualReview} color="amber" />
        <Stat label="Identities" value={assessment.canonicalIdentities} color="cyan" />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button onClick={() => setViewMode("identities")} className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase ${viewMode === "identities" ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]" : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)]"}`}>
          <Users className="h-3 w-3" /> Identities ({canonicalIdentities.length})
        </button>
        <button onClick={() => setViewMode("candidates")} className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase ${viewMode === "candidates" ? "border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10 text-[var(--hack-amber)]" : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)]"}`}>
          <GitMerge className="h-3 w-3" /> Candidates ({candidates.length})
        </button>
      </div>

      {/* Identities View */}
      {viewMode === "identities" && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {canonicalIdentities.map((ident) => {
            const isExpanded = expandedSecs.has(ident.id);
            const hasMerge = ident.sourceRecords.length > 1;
            return (
              <div key={ident.id} className="border border-[var(--hack-border)] bg-black/20">
                <button onClick={() => toggleSec(ident.id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-cyan)]/5">
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
                  {hasMerge ? <GitMerge className="h-3.5 w-3.5 text-[var(--hack-green)]" /> : <Users className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />}
                  <span className={`font-mono text-xs ${TYPE_COLORS[ident.type] || "text-[var(--hack-gray)]"}`}>{ident.primaryName}</span>
                  {ident.aliases.length > 0 && <span className="font-mono text-[9px] text-[var(--hack-gray)]/50">+{ident.aliases.length} alias(es)</span>}
                  <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 ml-auto">{ident.sourceRecords.length} source(s)</span>
                  {hasMerge && <span className="font-mono text-[8px] text-[var(--hack-green)] border border-[var(--hack-green)]/30 px-1">MERGED</span>}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {ident.aliases.length > 0 && (
                      <div>
                        <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Aliases: </span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {ident.aliases.map((a, i) => <span key={i} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1 text-[var(--hack-cyan)]">{a}</span>)}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Source Records:</span>
                      <div className="space-y-0.5 mt-0.5">
                        {ident.sourceRecords.map((sr, i) => (
                          <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                            <span className={`shrink-0 ${TYPE_COLORS[ident.type] || ""}`}>{sr.rawValue}</span>
                            <span className="text-[var(--hack-gray)]/40 truncate">— {sr.sourceLabel}</span>
                            <span className="text-[var(--hack-gray)]/30 shrink-0 ml-auto">{(sr.confidence * 100).toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {ident.mergeHistory.length > 0 && (
                      <div>
                        <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Merge History:</span>
                        {ident.mergeHistory.map((h, i) => (
                          <p key={i} className="font-mono text-[9px] text-[var(--hack-gray)]/60 mt-0.5">{h.detail}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Candidates View */}
      {viewMode === "candidates" && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {candidates.length === 0 ? (
            <div className="border border-[var(--hack-border)] bg-black/20 p-6 text-center">
              <p className="font-mono text-xs text-[var(--hack-gray)]">{"» No resolution candidates — insufficient comparable records."}</p>
            </div>
          ) : (
            candidates.map((cand) => {
              const Icon = OUTCOME_ICONS[cand.outcome] || AlertTriangle;
              const isExpanded = expandedSecs.has(cand.id);
              return (
                <div key={cand.id} className="border border-[var(--hack-border)] bg-black/20">
                  <button onClick={() => toggleSec(cand.id)} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-amber)]/5">
                    {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${OUTCOME_COLORS[cand.outcome]?.split(" ")[0] || "text-[var(--hack-gray)]"}`} />
                    <span className={`font-mono text-[8px] px-1 py-0.5 border shrink-0 ${OUTCOME_COLORS[cand.outcome] || ""}`}>{cand.outcome.toUpperCase().replace("_", " ")}</span>
                    <span className={`font-mono text-[10px] ${TYPE_COLORS[cand.recordA.type] || ""}`}>{cand.recordA.rawValue}</span>
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/40">↔</span>
                    <span className={`font-mono text-[10px] ${TYPE_COLORS[cand.recordB.type] || ""}`}>{cand.recordB.rawValue}</span>
                    <span className="font-mono text-[10px] text-[var(--hack-green)] ml-auto shrink-0">{(cand.confidence * 100).toFixed(0)}%</span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-2">
                      <p className="text-[10px] text-[var(--hack-gray)]">{cand.explanation}</p>
                      {cand.signals.length > 0 && (
                        <div>
                          <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Signals:</span>
                          <div className="space-y-0.5 mt-0.5">
                            {cand.signals.map((sig, i) => (
                              <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                                <span className="text-[var(--hack-gray)]/60 shrink-0">{sig.type.replace(/_/g, " ")}:</span>
                                <div className="w-16 h-1.5 bg-black/40 shrink-0"><div className="h-full bg-[var(--hack-cyan)]/40" style={{ width: `${sig.score * 100}%` }} /></div>
                                <span className="text-[var(--hack-cyan)] shrink-0">{(sig.score * 100).toFixed(0)}%</span>
                                <span className="text-[var(--hack-gray)]/40 truncate">{sig.explanation}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {cand.conflicts.length > 0 && (
                        <div>
                          <span className="font-mono text-[9px] uppercase text-[var(--hack-red)]/60">Conflicts:</span>
                          {cand.conflicts.map((c, i) => (
                            <div key={i} className="font-mono text-[10px] text-[var(--hack-red)]/70 mt-0.5">
                              {c.field}: "{c.valueA}" vs "{c.valueB}"
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : color === "cyan" ? "text-[var(--hack-cyan)]" : "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}
