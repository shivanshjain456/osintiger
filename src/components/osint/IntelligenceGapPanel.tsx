"use client";

import { useState, useEffect } from "react";
import {
  Loader2, ChevronDown, ChevronRight, AlertTriangle, ShieldCheck, Target,
  Lightbulb, Clock, Database, Network, Server, Globe, Lock, Users, Building2,
  FileText, History, GitBranch, CheckCircle2, XCircle, AlertCircle, Zap,
  TrendingUp, Layers, Eye, Brain, Sparkles, ArrowRight, RefreshCw,
} from "lucide-react";

// =====================
// Types
// =====================

interface IntelligenceGap {
  id: string;
  dimension: string;
  title: string;
  description: string;
  gapClass: string;
  severity: string;
  severityScore: number;
  whatIsKnown: string;
  whatIsMissing: string;
  whyItMatters: string;
  howToObtain: string;
  expectedEvidence: string;
  expectedImpact: string;
  dependencies: string[];
  downstreamBranches: string[];
  recommendedSources: string[];
  actionType: string;
  automation: string;
  confidenceInAssessment: number;
}

interface NextAction {
  id: string;
  rank: number;
  action: string;
  targetGapIds: string[];
  actionType: string;
  automation: string;
  expectedUtility: number;
  confidenceGain: number;
  coverageImprovement: number;
  contradictionResolution: number;
  freshnessImprovement: number;
  relevanceToObjective: number;
  expectedEvidence: string;
  reasoning: string;
  alternativesConsidered: string[];
  alternativesRejectedReason: string;
  assumptions: string[];
  downstreamBranches: string[];
  isPrimary: boolean;
  isFallback: boolean;
}

interface EvidenceCoverage {
  dimension: string;
  coveragePercent: number;
  sourcesConsulted: string[];
  findingsCount: number;
  hasContradictions: boolean;
  isStale: boolean;
  lastEvidenceAge: string;
  assessment: string;
}

interface GapAnalysisReport {
  investigationId: string;
  objective: string;
  target: string;
  inputType: string;
  generatedAt: string;
  knownEvidenceSummary: string;
  gaps: IntelligenceGap[];
  nextActions: NextAction[];
  coverage: EvidenceCoverage[];
  unresolvedContradictions: { topic: string; sources: string[]; description: string }[];
  staleEvidence: { area: string; lastSeen: string; age: string; significance: string }[];
  analysisStats: {
    totalGaps: number;
    criticalGaps: number;
    highValueGaps: number;
    opportunisticGaps: number;
    dimensionsCovered: number;
    dimensionsNotCovered: number;
    avgCoverage: number;
    primaryAction: string | null;
  };
  strategicAssessment: string;
  confidenceInAnalysis: number;
  analysisDurationMs: number;
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

// =====================
// Visual config
// =====================

const DIMENSION_ICONS: Record<string, React.ElementType> = {
  identity_attribution: Users,
  infrastructure_hosting: Server,
  domain_dns: Globe,
  certificate_tls: Lock,
  social_professional: Users,
  organizational_hierarchy: Building2,
  technical_stack: Cpu,
  public_records: FileText,
  historical_evolution: History,
  relationship: GitBranch,
  source_credibility: ShieldCheck,
  provenance: Database,
  contradiction: AlertTriangle,
  recency: Clock,
  coverage: Layers,
  verification: CheckCircle2,
};

function Cpu(props: React.ComponentProps<"svg">) {
  return <Brain {...props} />;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  high: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  medium: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  low: "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20",
  minimal: "text-[var(--hack-gray)]/60 border-[var(--hack-border)]/50 bg-black/10",
};

const GAP_CLASS_COLORS: Record<string, string> = {
  critical: "text-[var(--hack-red)]",
  high_value: "text-[var(--hack-amber)]",
  opportunistic: "text-[var(--hack-cyan)]",
  low_value: "text-[var(--hack-gray)]",
  redundant: "text-[var(--hack-green)]",
  speculative: "text-[var(--hack-purple)]",
};

const COVERAGE_COLORS: Record<string, string> = {
  well_covered: "text-[var(--hack-green)]",
  partially_covered: "text-[var(--hack-amber)]",
  minimally_covered: "text-[var(--hack-orange)]",
  not_covered: "text-[var(--hack-red)]",
  contradictory: "text-[var(--hack-red)]",
};

const ACTION_TYPE_ICONS: Record<string, React.ElementType> = {
  exploratory: Sparkles,
  confirmatory: CheckCircle2,
  contradiction_resolving: AlertTriangle,
};

export function IntelligenceGapPanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<GapAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "gaps" | "actions" | "coverage">("overview");
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    let active = true;
    (async () => {
      try {
        const r = await fetch(`${basePath}/${investigationId}/gaps`, { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (!cancelled && active && data.report) {
          setReport(data.report);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled && active) {
          setError(e instanceof Error ? e.message : "Failed");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; active = false; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» analyzing intelligence gaps across 16 dimensions..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No gap analysis available."}</p>;

  const toggleGap = (id: string) => setExpandedGaps((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleAction = (id: string) => setExpandedActions((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Header — strategic assessment */}
      <div className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Intelligence Gap Analysis</span>
            <span className="font-mono text-[9px] text-[var(--hack-cyan)] border border-[var(--hack-cyan)]/30 px-1.5 py-0.5">STRATEGIC</span>
          </div>
          <span className={`font-mono text-[9px] border px-1.5 py-0.5 ${report.confidenceInAnalysis >= 0.7 ? "text-[var(--hack-green)] border-[var(--hack-green)]/40" : "text-[var(--hack-amber)] border-[var(--hack-amber)]/40"}`}>
            CONFIDENCE: {(report.confidenceInAnalysis * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{report.strategicAssessment}</p>
        <div className="flex items-center gap-3 mt-2 font-mono text-[9px] text-[var(--hack-gray)]/60 border-t border-[var(--hack-border)] pt-2">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" /> {report.analysisDurationMs}ms
          </span>
          <span>objective: {report.objective.slice(0, 60)}...</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <Stat label="Total Gaps" value={report.analysisStats.totalGaps} icon={AlertTriangle} color="cyan" />
        <Stat label="Critical" value={report.analysisStats.criticalGaps} icon={XCircle} color="red" />
        <Stat label="High-Value" value={report.analysisStats.highValueGaps} icon={AlertCircle} color="amber" />
        <Stat label="Opportunistic" value={report.analysisStats.opportunisticGaps} icon={Zap} color="cyan" />
        <Stat label="Dims Covered" value={`${report.analysisStats.dimensionsCovered}/16`} icon={Layers} color="green" />
        <Stat label="Avg Coverage" value={`${report.analysisStats.avgCoverage.toFixed(0)}%`} icon={TrendingUp} color="green" />
        <Stat label="Actions" value={report.nextActions.length} icon={Lightbulb} color="cyan" />
      </div>

      {/* Known evidence summary */}
      <div className="border border-[var(--hack-border)] bg-black/20 p-3">
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-3 w-3 text-[var(--hack-cyan)]" />
          <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Known Evidence Summary</span>
        </div>
        <p className="font-mono text-[10px] text-[var(--hack-gray)]/80">{report.knownEvidenceSummary}</p>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 flex-wrap">
        <ViewTab active={viewMode === "overview"} onClick={() => setViewMode("overview")} icon={Brain} label="Overview" />
        <ViewTab active={viewMode === "gaps"} onClick={() => setViewMode("gaps")} icon={AlertTriangle} label={`Gaps (${report.gaps.length})`} />
        <ViewTab active={viewMode === "actions"} onClick={() => setViewMode("actions")} icon={Lightbulb} label={`Next Actions (${report.nextActions.length})`} />
        <ViewTab active={viewMode === "coverage"} onClick={() => setViewMode("coverage")} icon={Layers} label="Coverage Matrix" />
      </div>

      {/* OVERVIEW VIEW */}
      {viewMode === "overview" && (
        <div className="space-y-4">
          {/* Primary recommendation */}
          {report.nextActions[0] && (
            <div>
              <SectionHeader icon={Zap} title="Primary Recommendation" color="green" />
              <ActionCard action={report.nextActions[0]} expanded={expandedActions.has(report.nextActions[0].id)} onToggle={() => toggleAction(report.nextActions[0].id)} />
            </div>
          )}

          {/* Top gaps */}
          <div>
            <SectionHeader icon={AlertTriangle} title="Top Intelligence Gaps" color="red" />
            <div className="space-y-2 max-h-96 overflow-y-auto custom-scroll">
              {report.gaps.slice(0, 5).map((gap) => (
                <GapCard key={gap.id} gap={gap} expanded={expandedGaps.has(gap.id)} onToggle={() => toggleGap(gap.id)} compact />
              ))}
            </div>
          </div>

          {/* Unresolved contradictions */}
          {report.unresolvedContradictions.length > 0 && (
            <div>
              <SectionHeader icon={AlertTriangle} title="Unresolved Contradictions" color="amber" count={report.unresolvedContradictions.length} />
              <div className="space-y-1">
                {report.unresolvedContradictions.map((c, i) => (
                  <div key={i} className="border border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5 p-2">
                    <span className="font-mono text-[10px] text-[var(--hack-amber)] font-bold">{c.topic}</span>
                    <p className="font-mono text-[9px] text-[var(--hack-gray)]/70 mt-0.5">{c.description}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="font-mono text-[8px] text-[var(--hack-gray)]/50">sources:</span>
                      {c.sources.map((s, j) => (
                        <span key={j} className="font-mono text-[8px] border border-[var(--hack-border)] px-1 text-[var(--hack-cyan)]">{s}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stale evidence */}
          {report.staleEvidence.length > 0 && (
            <div>
              <SectionHeader icon={Clock} title="Stale Evidence" color="amber" count={report.staleEvidence.length} />
              <div className="space-y-1">
                {report.staleEvidence.map((s, i) => (
                  <div key={i} className="border border-[var(--hack-border)] bg-black/20 p-2 flex items-center gap-2">
                    <Clock className="h-3 w-3 text-[var(--hack-amber)] shrink-0" />
                    <span className="font-mono text-[10px] text-[var(--hack-amber)] shrink-0">{s.area}</span>
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">{s.lastSeen}</span>
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/70 truncate">{s.significance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* GAPS VIEW */}
      {viewMode === "gaps" && (
        <div className="space-y-2 max-h-[700px] overflow-y-auto custom-scroll">
          {report.gaps.length === 0 ? (
            <div className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 p-6 text-center">
              <CheckCircle2 className="h-6 w-6 text-[var(--hack-green)] mx-auto mb-2" />
              <p className="font-mono text-xs text-[var(--hack-green)]">No intelligence gaps identified — evidence base is comprehensive.</p>
            </div>
          ) : (
            report.gaps.map((gap) => (
              <GapCard key={gap.id} gap={gap} expanded={expandedGaps.has(gap.id)} onToggle={() => toggleGap(gap.id)} />
            ))
          )}
        </div>
      )}

      {/* ACTIONS VIEW */}
      {viewMode === "actions" && (
        <div className="space-y-2 max-h-[700px] overflow-y-auto custom-scroll">
          {report.nextActions.length === 0 ? (
            <div className="border border-[var(--hack-border)] bg-black/20 p-6 text-center">
              <p className="font-mono text-xs text-[var(--hack-gray)]">No next actions recommended.</p>
            </div>
          ) : (
            report.nextActions.map((action) => (
              <ActionCard key={action.id} action={action} expanded={expandedActions.has(action.id)} onToggle={() => toggleAction(action.id)} />
            ))
          )}
        </div>
      )}

      {/* COVERAGE VIEW */}
      {viewMode === "coverage" && (
        <div className="space-y-2">
          <div className="border border-[var(--hack-border)] bg-black/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
              <span className="font-mono text-[10px] uppercase text-[var(--hack-gray)]">Coverage Matrix — 16 Dimensions</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {report.coverage.map((c) => {
                const Icon = DIMENSION_ICONS[c.dimension] || Database;
                return (
                  <div key={c.dimension} className="border border-[var(--hack-border)] bg-black/30 p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`h-3 w-3 shrink-0 ${COVERAGE_COLORS[c.assessment] || "text-[var(--hack-gray)]"}`} />
                      <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate flex-1">{c.dimension.replace(/_/g, " ")}</span>
                      <span className={`font-mono text-[9px] shrink-0 ${COVERAGE_COLORS[c.assessment] || "text-[var(--hack-gray)]"}`}>
                        {c.coveragePercent}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40">
                      <div
                        className={`h-full ${c.assessment === "well_covered" ? "bg-[var(--hack-green)]" : c.assessment === "contradictory" ? "bg-[var(--hack-red)]" : c.assessment === "not_covered" ? "bg-[var(--hack-red)]/40" : c.assessment === "minimally_covered" ? "bg-[var(--hack-orange)]" : "bg-[var(--hack-amber)]"}`}
                        style={{ width: `${c.coveragePercent}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1 font-mono text-[8px] text-[var(--hack-gray)]/50">
                      <span>{c.findingsCount} findings</span>
                      <span>{c.sourcesConsulted.length} sources</span>
                      {c.hasContradictions && <span className="text-[var(--hack-red)]">contradictions</span>}
                      {c.isStale && <span className="text-[var(--hack-amber)]">stale</span>}
                      <span className="ml-auto">{c.lastEvidenceAge}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Gap Card
// ============================================================================

function GapCard({ gap, expanded, onToggle, compact }: {
  gap: IntelligenceGap;
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const Icon = DIMENSION_ICONS[gap.dimension] || AlertTriangle;
  const severityColor = SEVERITY_COLORS[gap.severity] || SEVERITY_COLORS.medium;
  const classColor = GAP_CLASS_COLORS[gap.gapClass] || "text-[var(--hack-gray)]";

  return (
    <div className={`border ${severityColor}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-2.5 hover:bg-white/5">
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-mono text-[10px] font-bold flex-1 text-left truncate">{gap.title}</span>
        <span className={`font-mono text-[8px] uppercase shrink-0 ${classColor}`}>{gap.gapClass.replace(/_/g, " ")}</span>
        <span className="font-mono text-[8px] uppercase shrink-0">{gap.severity}</span>
        <span className="font-mono text-[9px] shrink-0">{(gap.severityScore * 100).toFixed(0)}%</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[11px] text-[var(--hack-gray)]/90 leading-relaxed">{gap.description}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">What's Known:</span>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-0.5">{gap.whatIsKnown}</p>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-red)]/60">What's Missing:</span>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-0.5">{gap.whatIsMissing}</p>
            </div>
          </div>

          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Why It Matters:</span>
            <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-0.5">{gap.whyItMatters}</p>
          </div>

          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">How to Obtain:</span>
            <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-0.5">{gap.howToObtain}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Expected Evidence:</span>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-0.5">{gap.expectedEvidence}</p>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Expected Impact:</span>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-0.5">{gap.expectedImpact}</p>
            </div>
          </div>

          {!compact && (
            <>
              {gap.dependencies.length > 0 && (
                <div>
                  <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Dependencies:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {gap.dependencies.map((d, i) => (
                      <span key={i} className="font-mono text-[8px] border border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5 px-1 text-[var(--hack-amber)]">{d.replace(/_/g, " ")}</span>
                    ))}
                  </div>
                </div>
              )}

              {gap.downstreamBranches.length > 0 && (
                <div>
                  <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Downstream Branches:</span>
                  <ul className="mt-0.5 space-y-0.5">
                    {gap.downstreamBranches.map((b, i) => (
                      <li key={i} className="font-mono text-[9px] text-[var(--hack-cyan)]/70 flex items-start gap-1">
                        <ArrowRight className="h-2 w-2 mt-0.5 shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {gap.recommendedSources.length > 0 && (
                <div>
                  <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Recommended Sources:</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {gap.recommendedSources.map((s, i) => (
                      <span key={i} className="font-mono text-[8px] border border-[var(--hack-border)] bg-black/40 px-1 text-[var(--hack-green)]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 font-mono text-[9px] text-[var(--hack-gray)]/50 border-t border-current/20 pt-1.5">
                <span>type: {gap.actionType.replace(/_/g, " ")}</span>
                <span>automation: {gap.automation}</span>
                <span>assessment conf: {(gap.confidenceInAssessment * 100).toFixed(0)}%</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Action Card
// ============================================================================

function ActionCard({ action, expanded, onToggle }: {
  action: NextAction;
  expanded: boolean;
  onToggle: () => void;
}) {
  const ActionIcon = ACTION_TYPE_ICONS[action.actionType] || Lightbulb;
  const isPrimary = action.isPrimary;

  return (
    <div className={`border ${isPrimary ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5" : "border-[var(--hack-border)] bg-black/20"}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-2.5 hover:bg-white/5">
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <span className={`font-mono text-[10px] font-bold shrink-0 ${isPrimary ? "text-[var(--hack-green)]" : "text-[var(--hack-cyan)]"}`}>
          #{action.rank}
        </span>
        {isPrimary && <span className="font-mono text-[8px] text-[var(--hack-green)] border border-[var(--hack-green)]/40 px-1 shrink-0">PRIMARY</span>}
        {action.isFallback && <span className="font-mono text-[8px] text-[var(--hack-amber)] border border-[var(--hack-amber)]/40 px-1 shrink-0">FALLBACK</span>}
        <ActionIcon className={`h-3.5 w-3.5 shrink-0 ${isPrimary ? "text-[var(--hack-green)]" : "text-[var(--hack-cyan)]"}`} />
        <span className="font-mono text-[10px] text-[var(--hack-gray)] flex-1 text-left truncate">{action.action.slice(0, 120)}...</span>
        <span className="font-mono text-[9px] text-[var(--hack-cyan)] shrink-0">{(action.expectedUtility * 100).toFixed(0)}%</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Score breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <ScoreBar label="Utility" value={action.expectedUtility} color="cyan" />
            <ScoreBar label="Conf Gain" value={action.confidenceGain} color="green" />
            <ScoreBar label="Coverage" value={action.coverageImprovement} color="cyan" />
            <ScoreBar label="Contradict" value={action.contradictionResolution} color="amber" />
            <ScoreBar label="Relevance" value={action.relevanceToObjective} color="green" />
          </div>

          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Reasoning:</span>
            <p className="font-mono text-[10px] text-[var(--hack-gray)]/80 mt-0.5 leading-relaxed">{action.reasoning}</p>
          </div>

          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Expected Evidence:</span>
            <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-0.5">{action.expectedEvidence}</p>
          </div>

          {action.assumptions.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Assumptions:</span>
              <ul className="mt-0.5 space-y-0.5">
                {action.assumptions.map((a, i) => (
                  <li key={i} className="font-mono text-[9px] text-[var(--hack-amber)]/70 flex items-start gap-1">
                    <AlertCircle className="h-2 w-2 mt-0.5 shrink-0" /> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {action.downstreamBranches.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Downstream Branches:</span>
              <ul className="mt-0.5 space-y-0.5">
                {action.downstreamBranches.map((b, i) => (
                  <li key={i} className="font-mono text-[9px] text-[var(--hack-cyan)]/70 flex items-start gap-1">
                    <ArrowRight className="h-2 w-2 mt-0.5 shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {action.alternativesConsidered.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/50">Alternatives Considered:</span>
              <ul className="mt-0.5 space-y-0.5">
                {action.alternativesConsidered.map((a, i) => (
                  <li key={i} className="font-mono text-[9px] text-[var(--hack-gray)]/50 flex items-start gap-1">
                    <XCircle className="h-2 w-2 mt-0.5 shrink-0" /> {a}
                  </li>
                ))}
              </ul>
              <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-0.5">{action.alternativesRejectedReason}</p>
            </div>
          )}

          <div className="flex items-center gap-3 font-mono text-[9px] text-[var(--hack-gray)]/50 border-t border-[var(--hack-border)] pt-1.5">
            <span>type: {action.actionType.replace(/_/g, " ")}</span>
            <span>automation: {action.automation}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Stat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : color === "red" ? "text-[var(--hack-red)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 p-2 text-center">
      <Icon className={`h-3 w-3 mx-auto mb-0.5 ${c}`} />
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
        active
          ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]"
          : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:border-[var(--hack-cyan)]/30"
      }`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, color, count }: { icon: React.ElementType; title: string; color: string; count?: number }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : color === "red" ? "text-[var(--hack-red)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className={`h-3.5 w-3.5 ${c}`} />
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">{title}</span>
      {count !== undefined && <span className={`font-mono text-[9px] ${c}`}>({count})</span>}
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  const c = color === "green" ? "bg-[var(--hack-green)]" : color === "amber" ? "bg-[var(--hack-amber)]" : "bg-[var(--hack-cyan)]";
  const text = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/40 p-1.5">
      <div className="flex items-center justify-between font-mono text-[8px] text-[var(--hack-gray)]/60 mb-0.5">
        <span>{label}</span>
        <span className={text}>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full h-1 bg-black/60">
        <div className={`h-full ${c}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}
