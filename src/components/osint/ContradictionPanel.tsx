"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight, ShieldCheck, GitCompare } from "lucide-react";

// =====================
// Types
// =====================

interface ContradictionEntry {
  id: string;
  type: string;
  severity: string;
  topic: string;
  entity: string;
  claimA: string;
  sourceA: string;
  tierA: number;
  urlA: string;
  claimB: string;
  sourceB: string;
  tierB: number;
  urlB: string;
  valueA: string;
  valueB: string;
  contradictionConfidence: number;
  resolution: {
    action: string;
    reasoning: string;
    requiresManualVerification: boolean;
  };
  preferredSource: string;
  explanation: string;
}

interface ContradictionReport {
  contradictions: ContradictionEntry[];
  summary: {
    totalContradictions: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    resolved: number;
    unresolved: number;
  };
  assessment: {
    conflictLevel: number;
    hasSignificantConflicts: boolean;
    explanation: string;
  };
  meta: {
    sourcesCompared: number;
    findingsAnalyzed: number;
    generatedAt: string;
  };
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  high: "text-[var(--hack-orange)] border-[var(--hack-orange)]/40 bg-[var(--hack-orange)]/10",
  medium: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  low: "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20",
};

const SEVERITY_ICONS: Record<string, React.ElementType> = {
  critical: XCircle,
  high: AlertTriangle,
  medium: AlertTriangle,
  low: CheckCircle2,
};

const TYPE_ICONS: Record<string, string> = {
  entity_value: "🔍",
  status_conflict: "⚠️",
  negation_conflict: "❌",
  semantic_conflict: "💭",
  temporal_conflict: "⏰",
  attribute_conflict: "📋",
};

const TIER_COLORS: Record<number, string> = {
  5: "text-[var(--hack-green)]",
  4: "text-[var(--hack-cyan)]",
  3: "text-[var(--hack-amber)]",
  2: "text-[var(--hack-orange)]",
  1: "text-[var(--hack-red)]",
};

export function ContradictionPanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<ContradictionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/contradictions`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data.report) {
          setReport(data.report);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load contradictions");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-red)] mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]">
          {"» detecting contradictions across sources..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">
        {`» Error: ${error}`}
      </p>
    );
  }

  if (!report) {
    return (
      <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">
        {"» No contradiction data available."}
      </p>
    );
  }

  const { contradictions, summary, assessment, meta } = report;

  return (
    <div className="space-y-4">
      {/* Overall Assessment */}
      <div className={`border p-4 ${
        assessment.hasSignificantConflicts
          ? "border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5"
          : "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {assessment.hasSignificantConflicts ? (
              <AlertTriangle className="h-5 w-5 text-[var(--hack-red)]" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-[var(--hack-green)]" />
            )}
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">
              Conflict Assessment
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`font-mono text-3xl font-bold ${
              assessment.conflictLevel >= 50 ? "text-[var(--hack-red)]" :
              assessment.conflictLevel >= 25 ? "text-[var(--hack-amber)]" :
              "text-[var(--hack-green)]"
            }`}>
              {assessment.conflictLevel}
            </span>
            <span className="font-mono text-sm text-[var(--hack-gray)]">/100</span>
          </div>
        </div>
        <div className="h-2 bg-black/40 border border-[var(--hack-border)] mb-2">
          <div
            className="h-full transition-all"
            style={{
              width: `${assessment.conflictLevel}%`,
              backgroundColor: assessment.conflictLevel >= 50 ? "var(--hack-red)" : assessment.conflictLevel >= 25 ? "amber" : "var(--hack-green)",
            }}
          />
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Total Conflicts" value={summary.totalContradictions} color="red" />
        <StatCard label="Resolved" value={summary.resolved} color="green" />
        <StatCard label="Unresolved" value={summary.unresolved} color="amber" />
        <StatCard label="Findings Analyzed" value={meta.findingsAnalyzed} color="cyan" />
      </div>

      {/* Severity Distribution */}
      {summary.totalContradictions > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <GitCompare className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
              {"» Severity Distribution"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {["critical", "high", "medium", "low"].map((sev) => {
              const count = summary.bySeverity[sev] || 0;
              if (count === 0) return null;
              return (
                <span key={sev} className={`font-mono text-[10px] px-2 py-0.5 border ${SEVERITY_COLORS[sev]}`}>
                  {count} {sev.toUpperCase()}
                </span>
              );
            })}
          </div>
          {/* Type Distribution */}
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(summary.byType).map(([type, count]) => (
              <span key={type} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1.5 py-0.5 text-[var(--hack-gray)]">
                {TYPE_ICONS[type] || "•"} {type.replace(/_/g, " ")}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Contradiction List */}
      {contradictions.length === 0 ? (
        <div className="border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 p-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-[var(--hack-green)] mx-auto mb-2" />
          <p className="font-mono text-xs text-[var(--hack-green)]">
            {"» No contradictions detected. All sources are consistent."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-red)] section-header">
            Detected Contradictions ({contradictions.length})
          </h3>
          {contradictions.map((c) => {
            const isExpanded = expandedIds.has(c.id);
            const SeverityIcon = SEVERITY_ICONS[c.severity] || AlertTriangle;
            return (
              <div key={c.id} className={`border-l-2 ${
                c.severity === "critical" ? "border-l-[var(--hack-red)]" :
                c.severity === "high" ? "border-l-[var(--hack-orange)]" :
                c.severity === "medium" ? "border-l-[var(--hack-amber)]" :
                "border-l-[var(--hack-border)]"
              } border border-[var(--hack-border)] bg-black/20`}>
                {/* Header */}
                <button
                  onClick={() => setExpandedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(c.id)) next.delete(c.id);
                    else next.add(c.id);
                    return next;
                  })}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-red)]/5 transition-colors text-left"
                >
                  <SeverityIcon className={`h-4 w-4 shrink-0 ${
                    c.severity === "critical" ? "text-[var(--hack-red)]" :
                    c.severity === "high" ? "text-[var(--hack-orange)]" :
                    c.severity === "medium" ? "text-[var(--hack-amber)]" :
                    "text-[var(--hack-gray)]"
                  }`} />
                  <span className="font-mono text-[10px] text-[var(--hack-gray)]/60 shrink-0">
                    {TYPE_ICONS[c.type] || "•"}
                  </span>
                  <span className="font-mono text-xs text-[var(--hack-red)] truncate flex-1">
                    {c.topic}
                  </span>
                  <span className={`font-mono text-[9px] px-1.5 py-0.5 border shrink-0 ${SEVERITY_COLORS[c.severity]}`}>
                    {c.severity.toUpperCase()}
                  </span>
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3">
                    {/* Explanation */}
                    <div>
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]/60">
                        Explanation:
                      </span>
                      <p className="text-xs text-[var(--hack-gray)] mt-0.5">{c.explanation}</p>
                    </div>

                    {/* Side-by-side comparison */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {/* Claim A */}
                      <div className="border-l-2 border-[var(--hack-green)] pl-2 bg-black/30 p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`font-mono text-[9px] font-bold ${TIER_COLORS[c.tierA] || "text-[var(--hack-gray)]"}`}>
                            T{c.tierA}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--hack-green)]">{c.sourceA}</span>
                          {c.preferredSource === "A" && (
                            <ShieldCheck className="h-3 w-3 text-[var(--hack-green)]" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--hack-gray)]">{c.claimA.slice(0, 150)}{c.claimA.length > 150 ? "..." : ""}</p>
                        <div className="mt-1">
                          <span className="font-mono text-[9px] text-[var(--hack-green)]/60">Value: </span>
                          <span className="font-mono text-[10px] text-[var(--hack-green)]">{c.valueA}</span>
                        </div>
                      </div>
                      {/* Claim B */}
                      <div className="border-l-2 border-[var(--hack-red)] pl-2 bg-black/30 p-2">
                        <div className="flex items-center gap-1 mb-1">
                          <span className={`font-mono text-[9px] font-bold ${TIER_COLORS[c.tierB] || "text-[var(--hack-gray)]"}`}>
                            T{c.tierB}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--hack-red)]">{c.sourceB}</span>
                          {c.preferredSource === "B" && (
                            <ShieldCheck className="h-3 w-3 text-[var(--hack-green)]" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--hack-gray)]">{c.claimB.slice(0, 150)}{c.claimB.length > 150 ? "..." : ""}</p>
                        <div className="mt-1">
                          <span className="font-mono text-[9px] text-[var(--hack-red)]/60">Value: </span>
                          <span className="font-mono text-[10px] text-[var(--hack-red)]">{c.valueB}</span>
                        </div>
                      </div>
                    </div>

                    {/* Resolution */}
                    <div className="border border-[var(--hack-cyan)]/20 bg-[var(--hack-cyan)]/5 p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
                        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-cyan)]">
                          Recommended Resolution
                        </span>
                        {c.resolution.requiresManualVerification && (
                          <span className="font-mono text-[8px] border border-[var(--hack-amber)]/40 text-[var(--hack-amber)] px-1 py-0.5">
                            MANUAL CHECK NEEDED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--hack-cyan)]">{c.resolution.action}</p>
                      <p className="text-[10px] text-[var(--hack-gray)]/70 mt-1">{c.resolution.reasoning}</p>
                    </div>

                    {/* Contradiction confidence */}
                    <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--hack-gray)]/50">
                      <span>Contradiction confidence: {(c.contradictionConfidence * 100).toFixed(0)}%</span>
                      <span>·</span>
                      <span>Preferred: {c.preferredSource === "A" ? c.sourceA : c.preferredSource === "B" ? c.sourceB : c.preferredSource}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================
// Sub-components
// =====================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClass =
    color === "red" ? "text-[var(--hack-red)]" :
    color === "green" ? "text-[var(--hack-green)]" :
    color === "amber" ? "text-[var(--hack-amber)]" :
    "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${colorClass}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}
