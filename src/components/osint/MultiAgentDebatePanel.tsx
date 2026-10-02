"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Brain, ChevronDown, ChevronRight, ShieldCheck, AlertTriangle,
  Search, Server, ShieldAlert, Building2, CheckCircle2, CreditCard,
  GitBranch, Network, Clock, RefreshCw, Play, Users, Sparkles, XCircle,
  AlertCircle, FileText, Lightbulb, Zap, Layers,
} from "lucide-react";
import {
  runMultiAgentDebate,
  type DebateResult, type DebateAgentAnalysis, type DebateConflictItem,
  type DebateCoordinatorSynthesis, type DebateRound, type DebateAgentType,
} from "@/lib/osint/client";

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

// Agent visual config
const AGENT_ICONS: Record<DebateAgentType, React.ElementType> = {
  research: Search,
  technical: Server,
  cybersecurity: ShieldAlert,
  business: Building2,
  fact_checker: CheckCircle2,
  risk: AlertTriangle,
  ach: CreditCard,
};

const AGENT_COLORS: Record<DebateAgentType, string> = {
  research: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  technical: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  cybersecurity: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  business: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  fact_checker: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  risk: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  ach: "text-[var(--hack-purple)] border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10",
};

const AGENT_ICON_COLORS: Record<DebateAgentType, string> = {
  research: "text-[var(--hack-cyan)]",
  technical: "text-[var(--hack-amber)]",
  cybersecurity: "text-[var(--hack-red)]",
  business: "text-[var(--hack-green)]",
  fact_checker: "text-[var(--hack-green)]",
  risk: "text-[var(--hack-amber)]",
  ach: "text-[var(--hack-purple)]",
};

const CONFLICT_ICONS: Record<string, React.ElementType> = {
  agreement: CheckCircle2,
  partial_agreement: AlertCircle,
  direct_contradiction: AlertTriangle,
  unsupported_claim: XCircle,
  missing_evidence: AlertCircle,
};

const CONFLICT_COLORS: Record<string, string> = {
  agreement: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  partial_agreement: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  direct_contradiction: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  unsupported_claim: "text-[var(--hack-orange)] border-[var(--hack-orange)]/40 bg-[var(--hack-orange)]/10",
  missing_evidence: "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  very_high: "text-[var(--hack-green)]",
  high: "text-[var(--hack-green)]",
  moderate: "text-[var(--hack-amber)]",
  low: "text-[var(--hack-red)]",
};

export function MultiAgentDebatePanel({ investigationId, apiPath }: Props) {
  const [debate, setDebate] = useState<DebateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"agents" | "conflicts" | "synthesis" | "rounds">("synthesis");
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  const runDebate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await runMultiAgentDebate(investigationId, { apiPath, maxRounds: 1 });
      setDebate(result);
      // Auto-expand the first 3 agents
      const lastRound = result.rounds[result.rounds.length - 1];
      setExpandedAgents(new Set(lastRound.agentAnalyses.slice(0, 3).map((a) => a.agentType)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Debate failed");
    } finally {
      setLoading(false);
    }
  }, [investigationId, apiPath]);

  // Auto-trigger debate on first load
  useEffect(() => {
    if (!hasAutoTriggered && !debate && !loading) {
      setHasAutoTriggered(true);
      runDebate();
    }
  }, [hasAutoTriggered, debate, loading, runDebate]);

  const toggleAgent = (agentType: string) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentType)) next.delete(agentType);
      else next.add(agentType);
      return next;
    });
  };

  const toggleConflict = (id: string) => {
    setExpandedConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Loading state
  if (loading && !debate) {
    return (
      <div className="space-y-4">
        <div className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--hack-cyan)] mx-auto mb-3" />
          <p className="font-mono text-xs text-[var(--hack-cyan)] mb-1">
            {"» MULTI-AGENT DEBATE IN PROGRESS"}
          </p>
          <p className="font-mono text-[10px] text-[var(--hack-gray)]">
            {"» Dispatching 7 specialized agents in parallel..."}
          </p>
          <p className="font-mono text-[10px] text-[var(--hack-gray)]/60 mt-1">
            {"» Each agent reasons independently, then coordinator synthesizes."}
          </p>
          <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-2">
            This may take 30-90 seconds.
          </p>
        </div>
        <AgentSkeletonGrid />
      </div>
    );
  }

  // Error state
  if (error && !debate) {
    return (
      <div className="space-y-4">
        <div className="border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-[var(--hack-red)]" />
            <span className="font-mono text-xs text-[var(--hack-red)] uppercase">Debate Failed</span>
          </div>
          <p className="font-mono text-[10px] text-[var(--hack-gray)] mb-3">{error}</p>
          <button
            onClick={runDebate}
            className="flex items-center gap-1.5 border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 px-3 py-1 font-mono text-[10px] text-[var(--hack-cyan)] uppercase hover:bg-[var(--hack-cyan)]/20"
          >
            <RefreshCw className="h-3 w-3" /> Retry Debate
          </button>
        </div>
      </div>
    );
  }

  if (!debate) return null;

  const lastRound = debate.rounds[debate.rounds.length - 1];
  const synth = debate.finalSynthesis;

  return (
    <div className="space-y-4">
      {/* Header — title + stats + re-run */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Multi-Agent Debate</span>
            <span className="font-mono text-[9px] text-[var(--hack-green)] border border-[var(--hack-green)]/30 px-1.5 py-0.5">7 AGENTS</span>
            <span className="font-mono text-[9px] text-[var(--hack-cyan)] border border-[var(--hack-cyan)]/30 px-1.5 py-0.5">COORDINATED</span>
          </div>
          <button
            onClick={runDebate}
            disabled={loading}
            className="flex items-center gap-1.5 border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 px-3 py-1 font-mono text-[10px] text-[var(--hack-cyan)] uppercase hover:bg-[var(--hack-cyan)]/20 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            {loading ? "Running..." : "Re-run Debate"}
          </button>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed mb-2">
          7 specialized agents independently analyzed this investigation, then a coordinator synthesized their outputs into a defensible conclusion.
          Each agent reasons from evidence — never from other agents&apos; conclusions.
        </p>
        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mt-3">
          <Stat label="Agents" value={debate.debateStats.agentsRun} icon={Users} color="cyan" />
          <Stat label="Applicable" value={debate.debateStats.agentsApplicable} icon={CheckCircle2} color="green" />
          <Stat label="Rounds" value={debate.debateStats.roundsCompleted} icon={Layers} color="cyan" />
          <Stat label="Conflicts" value={debate.debateStats.totalConflicts} icon={AlertTriangle} color="amber" />
          <Stat label="Agreements" value={debate.debateStats.agreements} icon={CheckCircle2} color="green" />
          <Stat label="Contradictions" value={debate.debateStats.contradictions} icon={XCircle} color="red" />
          <Stat label="Duration" value={`${(debate.totalDurationMs / 1000).toFixed(1)}s`} icon={Clock} color="cyan" />
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 flex-wrap">
        <ViewTab active={viewMode === "synthesis"} onClick={() => setViewMode("synthesis")} icon={Brain} label="Synthesis" />
        <ViewTab active={viewMode === "agents"} onClick={() => setViewMode("agents")} icon={Users} label={`Agents (${lastRound.agentAnalyses.length})`} />
        <ViewTab active={viewMode === "conflicts"} onClick={() => setViewMode("conflicts")} icon={AlertTriangle} label={`Conflicts (${lastRound.conflicts.length})`} />
        <ViewTab active={viewMode === "rounds"} onClick={() => setViewMode("rounds")} icon={Layers} label={`Rounds (${debate.rounds.length})`} />
      </div>

      {/* SYNTHESIS VIEW */}
      {viewMode === "synthesis" && (
        <div className="space-y-4">
          {/* Final conclusion */}
          <div className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-[var(--hack-cyan)]" />
              <span className="font-mono text-xs uppercase text-[var(--hack-cyan)]">Coordinator Synthesis — Final Conclusion</span>
              <span className={`font-mono text-[9px] border px-1.5 py-0.5 ml-auto ${CONFIDENCE_COLORS[synth.confidenceLabel] || "text-[var(--hack-gray)]"} border-current`}>
                {synth.confidenceLabel.toUpperCase()} ({(synth.overallConfidence * 100).toFixed(0)}%)
              </span>
            </div>
            <p className="text-xs text-[var(--hack-gray)] leading-relaxed whitespace-pre-wrap">{synth.finalConclusion}</p>
            {synth.supportingRationale && (
              <div className="mt-3 border-t border-[var(--hack-border)] pt-2">
                <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Supporting Rationale:</span>
                <p className="text-[11px] text-[var(--hack-gray)]/80 mt-1 leading-relaxed">{synth.supportingRationale}</p>
              </div>
            )}
            <div className="flex items-center gap-3 mt-3 font-mono text-[9px] text-[var(--hack-gray)]/60 border-t border-[var(--hack-border)] pt-2">
              <span className="flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" /> synth: {synth.synthesisTimeMs}ms
              </span>
              <span>stopping: {synth.stoppingReason}</span>
              {synth.debateRoundsNeeded > 0 && (
                <span className="text-[var(--hack-amber)]">rounds needed: {synth.debateRoundsNeeded}</span>
              )}
            </div>
          </div>

          {/* Areas of agreement */}
          {synth.areasOfAgreement.length > 0 && (
            <div>
              <SectionHeader icon={CheckCircle2} title="Areas of Agreement" color="green" count={synth.areasOfAgreement.length} />
              <div className="space-y-2">
                {synth.areasOfAgreement.map((a, i) => (
                  <div key={i} className="border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-[var(--hack-green)] font-bold">{a.topic}</span>
                      <div className="flex gap-1 ml-auto">
                        {a.agents.map((at) => {
                          const Icon = AGENT_ICONS[at as DebateAgentType] || Users;
                          return <Icon key={at} className={`h-3 w-3 ${AGENT_ICON_COLORS[at as DebateAgentType] || "text-[var(--hack-gray)]"}`} />;
                        })}
                      </div>
                    </div>
                    <p className="font-mono text-[10px] text-[var(--hack-gray)]/80">{a.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Areas of disagreement */}
          {synth.areasOfDisagreement.length > 0 && (
            <div>
              <SectionHeader icon={AlertTriangle} title="Areas of Disagreement" color="amber" count={synth.areasOfDisagreement.length} />
              <div className="space-y-2">
                {synth.areasOfDisagreement.map((d, i) => (
                  <div key={i} className="border border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5 p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] text-[var(--hack-amber)] font-bold">{d.topic}</span>
                      <span className="font-mono text-[9px] text-[var(--hack-amber)]/60 ml-auto">{d.positions.length} positions</span>
                    </div>
                    <div className="space-y-1">
                      {d.positions.map((p, j) => {
                        const Icon = AGENT_ICONS[p.agent as DebateAgentType] || Users;
                        return (
                          <div key={j} className="flex items-start gap-2 font-mono text-[10px]">
                            <Icon className={`h-2.5 w-2.5 mt-0.5 shrink-0 ${AGENT_ICON_COLORS[p.agent as DebateAgentType] || "text-[var(--hack-gray)]"}`} />
                            <span className={`shrink-0 ${AGENT_ICON_COLORS[p.agent as DebateAgentType] || "text-[var(--hack-gray)]"}`}>{p.agent.replace(/_/g, " ")}:</span>
                            <span className="text-[var(--hack-gray)]/80">{p.position}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="font-mono text-[9px] text-[var(--hack-amber)]/70 mt-1.5 border-t border-[var(--hack-amber)]/20 pt-1">
                      <span className="uppercase">Resolution:</span> {d.resolution}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent contributions */}
          {synth.agentContributions.length > 0 && (
            <div>
              <SectionHeader icon={Users} title="Agent Contributions" color="cyan" count={synth.agentContributions.length} />
              <div className="space-y-1">
                {synth.agentContributions.map((c, i) => {
                  const Icon = AGENT_ICONS[c.agentType as DebateAgentType] || Users;
                  return (
                    <div key={i} className="border border-[var(--hack-border)] bg-black/20 p-2 flex items-start gap-2">
                      <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${AGENT_ICON_COLORS[c.agentType as DebateAgentType] || "text-[var(--hack-gray)]"}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`font-mono text-[9px] uppercase ${AGENT_ICON_COLORS[c.agentType as DebateAgentType] || "text-[var(--hack-gray)]"}`}>
                          {c.agentType.replace(/_/g, " ")}
                        </span>
                        <p className="font-mono text-[10px] text-[var(--hack-gray)]/80 mt-0.5">{c.contribution}</p>
                      </div>
                      <span className="font-mono text-[9px] text-[var(--hack-cyan)] shrink-0">
                        w: {(c.weight * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unresolved uncertainties */}
          {synth.unresolvedUncertainties.length > 0 && (
            <div>
              <SectionHeader icon={AlertCircle} title="Unresolved Uncertainties" color="red" count={synth.unresolvedUncertainties.length} />
              <ul className="space-y-1">
                {synth.unresolvedUncertainties.map((u, i) => (
                  <li key={i} className="font-mono text-[10px] text-[var(--hack-red)]/80 flex items-start gap-2">
                    <AlertCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended next actions */}
          {synth.recommendedNextActions.length > 0 && (
            <div>
              <SectionHeader icon={Lightbulb} title="Recommended Next Actions" color="green" count={synth.recommendedNextActions.length} />
              <ul className="space-y-1">
                {synth.recommendedNextActions.map((a, i) => (
                  <li key={i} className="font-mono text-[10px] text-[var(--hack-green)]/80 flex items-start gap-2">
                    <Zap className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence references */}
          {synth.evidenceReferences.length > 0 && (
            <div>
              <SectionHeader icon={FileText} title="Evidence References" color="cyan" count={synth.evidenceReferences.length} />
              <div className="space-y-1 max-h-60 overflow-y-auto custom-scroll">
                {synth.evidenceReferences.map((e, i) => (
                  <div key={i} className="border border-[var(--hack-border)] bg-black/20 p-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[var(--hack-green)] font-bold">{e.ref}</span>
                      <div className="flex gap-1 ml-auto">
                        {e.supportingAgents.map((at, j) => {
                          const Icon = AGENT_ICONS[at as DebateAgentType] || Users;
                          return <Icon key={j} className={`h-2.5 w-2.5 ${AGENT_ICON_COLORS[at as DebateAgentType] || "text-[var(--hack-gray)]"}`} />;
                        })}
                      </div>
                    </div>
                    <p className="font-mono text-[9px] text-[var(--hack-gray)]/60 mt-0.5">{e.significance}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AGENTS VIEW */}
      {viewMode === "agents" && (
        <div className="space-y-2">
          {lastRound.agentAnalyses.map((agent) => (
            <AgentCard
              key={agent.agentType}
              agent={agent}
              expanded={expandedAgents.has(agent.agentType)}
              onToggle={() => toggleAgent(agent.agentType)}
            />
          ))}
        </div>
      )}

      {/* CONFLICTS VIEW */}
      {viewMode === "conflicts" && (
        <div className="space-y-2">
          {lastRound.conflicts.length === 0 ? (
            <div className="border border-[var(--hack-border)] bg-black/20 p-6 text-center">
              <CheckCircle2 className="h-6 w-6 text-[var(--hack-green)] mx-auto mb-2" />
              <p className="font-mono text-xs text-[var(--hack-green)]">No conflicts identified — agents are in agreement.</p>
            </div>
          ) : (
            lastRound.conflicts.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                expanded={expandedConflicts.has(conflict.id)}
                onToggle={() => toggleConflict(conflict.id)}
              />
            ))
          )}
        </div>
      )}

      {/* ROUNDS VIEW */}
      {viewMode === "rounds" && (
        <div className="space-y-3">
          {debate.rounds.map((round) => (
            <RoundCard key={round.roundNumber} round={round} />
          ))}
        </div>
      )}

      {/* Evidence bundle summary */}
      <div className="border border-[var(--hack-border)] bg-black/20 p-3">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="h-3 w-3 text-[var(--hack-cyan)]" />
          <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Evidence Bundle</span>
          <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 ml-auto">
            {debate.evidenceBundleSummary.totalFindings} findings from {debate.evidenceBundleSummary.totalSources} sources
          </span>
        </div>
        <pre className="font-mono text-[9px] text-[var(--hack-gray)]/60 whitespace-pre-wrap line-clamp-3 mt-1">
          {debate.evidenceBundleSummary.evidencePreview || "No evidence preview available."}
        </pre>
      </div>

      {/* Loading overlay during re-run */}
      {loading && debate && (
        <div className="fixed bottom-4 right-4 border border-[var(--hack-cyan)]/40 bg-[var(--hack-bg)]/95 backdrop-blur p-3 z-30">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[var(--hack-cyan)]" />
            <span className="font-mono text-[10px] text-[var(--hack-cyan)]">Re-running debate...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Agent Card
// ============================================================================

function AgentCard({
  agent, expanded, onToggle,
}: {
  agent: DebateAgentAnalysis;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = AGENT_ICONS[agent.agentType] || Users;
  const colorClass = AGENT_COLORS[agent.agentType] || "";
  const iconColor = AGENT_ICON_COLORS[agent.agentType] || "text-[var(--hack-gray)]";

  return (
    <div className={`border ${agent.applicable ? "border-[var(--hack-border)]" : "border-[var(--hack-border)]/50 opacity-60"} bg-black/20`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-2.5 hover:bg-[var(--hack-cyan)]/5">
        {expanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} />
        <span className={`font-mono text-xs ${iconColor}`}>{agent.agentName}</span>
        {!agent.applicable && (
          <span className="font-mono text-[8px] text-[var(--hack-gray)]/60 border border-[var(--hack-border)] px-1">N/A</span>
        )}
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 ml-auto">
          {agent.keyObservations.length} obs
        </span>
        <span className={`font-mono text-[9px] ${CONFIDENCE_COLORS[agent.confidenceLevel] || "text-[var(--hack-gray)]"}`}>
          {agent.confidenceLevel} ({(agent.confidenceScore * 100).toFixed(0)}%)
        </span>
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/40">{(agent.reasoningTimeMs / 1000).toFixed(1)}s</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Summary */}
          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Summary:</span>
            <p className="text-[11px] text-[var(--hack-gray)] mt-0.5 leading-relaxed">{agent.summary}</p>
          </div>

          {/* Key observations */}
          {agent.keyObservations.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Key Observations:</span>
              <div className="space-y-1.5 mt-1">
                {agent.keyObservations.map((obs, i) => (
                  <div key={i} className="border border-[var(--hack-border)] bg-black/40 p-2">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[9px] text-[var(--hack-cyan)] shrink-0">[{i + 1}]</span>
                      <p className="font-mono text-[10px] text-[var(--hack-gray)]/80 flex-1">{obs.observation}</p>
                      <span className={`font-mono text-[9px] shrink-0 ${CONFIDENCE_COLORS[obs.confidence >= 0.7 ? "high" : obs.confidence >= 0.4 ? "moderate" : "low"]}`}>
                        {(obs.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    {obs.evidenceRefs.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="font-mono text-[8px] text-[var(--hack-gray)]/40">evidence:</span>
                        {obs.evidenceRefs.map((ref, j) => (
                          <span key={j} className="font-mono text-[8px] border border-[var(--hack-border)] bg-black/40 px-1 text-[var(--hack-green)]">{ref}</span>
                        ))}
                      </div>
                    )}
                    {obs.uncertainty && (
                      <p className="font-mono text-[9px] text-[var(--hack-amber)]/70 mt-1">
                        <span className="uppercase">Uncertainty:</span> {obs.uncertainty}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uncertainties */}
          {agent.uncertainties.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Uncertainties:</span>
              <ul className="mt-0.5 space-y-0.5">
                {agent.uncertainties.map((u, i) => (
                  <li key={i} className="font-mono text-[10px] text-[var(--hack-amber)]/80 flex items-start gap-1.5">
                    <AlertCircle className="h-2.5 w-2.5 mt-0.5 shrink-0" /> {u}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contradictions */}
          {agent.contradictions.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-red)]/60">Contradictions:</span>
              <ul className="mt-0.5 space-y-0.5">
                {agent.contradictions.map((c, i) => (
                  <li key={i} className="font-mono text-[10px] text-[var(--hack-red)]/80">
                    <span className="font-bold">{c.topic}:</span> {c.description}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended next steps */}
          {agent.recommendedNextSteps.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Recommended Next Steps:</span>
              <ul className="mt-0.5 space-y-0.5">
                {agent.recommendedNextSteps.map((s, i) => (
                  <li key={i} className="font-mono text-[10px] text-[var(--hack-green)]/80 flex items-start gap-1.5">
                    <Zap className="h-2.5 w-2.5 mt-0.5 shrink-0" /> {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Supporting evidence */}
          {agent.supportingEvidence.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Supporting Evidence:</span>
              <div className="space-y-0.5 mt-0.5">
                {agent.supportingEvidence.map((e, i) => (
                  <div key={i} className="font-mono text-[10px] flex items-start gap-2">
                    <span className="text-[var(--hack-green)] shrink-0">{e.ref}</span>
                    <span className="text-[var(--hack-gray)]/70">{e.relevance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {agent.error && (
            <div className="border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-2">
              <p className="font-mono text-[9px] text-[var(--hack-red)]">Error: {agent.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Conflict Card
// ============================================================================

function ConflictCard({
  conflict, expanded, onToggle,
}: {
  conflict: DebateConflictItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = CONFLICT_ICONS[conflict.type] || AlertCircle;
  const colorClass = CONFLICT_COLORS[conflict.type] || "";
  const typeLabel = conflict.type.replace(/_/g, " ").toUpperCase();

  return (
    <div className={`border ${colorClass}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-2.5 hover:bg-white/5">
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon className="h-4 w-4 shrink-0" />
        <span className="font-mono text-[9px] uppercase font-bold">{typeLabel}</span>
        <span className="font-mono text-[10px] truncate flex-1 text-left">{conflict.topic}</span>
        <span className="font-mono text-[9px] opacity-60">{conflict.agents.length} agents</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-[11px] text-[var(--hack-gray)]/80">{conflict.description}</p>

          {/* Agent positions */}
          <div>
            <span className="font-mono text-[9px] uppercase opacity-60">Agent Positions:</span>
            <div className="space-y-1 mt-1">
              {conflict.agents.map((a, i) => {
                const AgentIcon = AGENT_ICONS[a.agentType as DebateAgentType] || Users;
                const isStronger = conflict.strongerSide === a.agentType;
                return (
                  <div key={i} className={`border ${isStronger ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5" : "border-[var(--hack-border)] bg-black/40"} p-2`}>
                    <div className="flex items-center gap-2">
                      <AgentIcon className={`h-3 w-3 shrink-0 ${AGENT_ICON_COLORS[a.agentType as DebateAgentType] || "text-[var(--hack-gray)]"}`} />
                      <span className={`font-mono text-[9px] uppercase ${AGENT_ICON_COLORS[a.agentType as DebateAgentType] || "text-[var(--hack-gray)]"}`}>
                        {a.agentType.replace(/_/g, " ")}
                      </span>
                      {isStronger && <span className="font-mono text-[8px] text-[var(--hack-green)] border border-[var(--hack-green)]/40 px-1">STRONGER</span>}
                      <span className={`font-mono text-[9px] ml-auto ${CONFIDENCE_COLORS[a.confidence >= 0.7 ? "high" : a.confidence >= 0.4 ? "moderate" : "low"]}`}>
                        {(a.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-1">{a.position}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resolution */}
          <div className="border-t border-current/20 pt-2">
            <span className="font-mono text-[9px] uppercase opacity-60">Resolution:</span>
            <p className="font-mono text-[10px] mt-0.5">{conflict.resolution}</p>
            <p className="font-mono text-[9px] opacity-60 mt-1">{conflict.resolutionRationale}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Round Card
// ============================================================================

function RoundCard({ round }: { round: DebateRound }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-4 w-4 text-[var(--hack-cyan)]" />
        <span className="font-mono text-xs text-[var(--hack-cyan)] uppercase">Round {round.roundNumber}</span>
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 ml-auto">
          {(round.durationMs / 1000).toFixed(1)}s • {round.agentAnalyses.length} agents • {round.conflicts.length} conflicts
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {round.agentAnalyses.map((a) => {
          const Icon = AGENT_ICONS[a.agentType as DebateAgentType] || Users;
          return (
            <div key={a.agentType} className="border border-[var(--hack-border)] bg-black/40 p-1.5 text-center">
              <Icon className={`h-3 w-3 mx-auto ${AGENT_ICON_COLORS[a.agentType as DebateAgentType] || "text-[var(--hack-gray)]"}`} />
              <div className="font-mono text-[8px] text-[var(--hack-gray)]/60 uppercase mt-0.5">{a.agentType.replace(/_/g, " ")}</div>
              <div className={`font-mono text-[9px] ${CONFIDENCE_COLORS[a.confidenceLevel] || "text-[var(--hack-gray)]"}`}>
                {(a.confidenceScore * 100).toFixed(0)}%
              </div>
              <div className="font-mono text-[8px] text-[var(--hack-gray)]/40">
                {a.applicable ? `${a.keyObservations.length} obs` : "N/A"}
              </div>
            </div>
          );
        })}
      </div>
      {/* Conflict summary */}
      {round.conflicts.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--hack-border)]">
          <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Conflicts:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {round.conflicts.map((c) => {
              const Icon = CONFLICT_ICONS[c.type] || AlertCircle;
              return (
                <span key={c.id} className={`flex items-center gap-1 font-mono text-[8px] border px-1 py-0.5 ${CONFLICT_COLORS[c.type] || ""}`}>
                  <Icon className="h-2 w-2" />
                  {c.type.replace(/_/g, " ")}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Agent Skeleton Grid (loading state)
// ============================================================================

function AgentSkeletonGrid() {
  const agentTypes: DebateAgentType[] = ["research", "technical", "cybersecurity", "business", "fact_checker", "risk", "ach"];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {agentTypes.map((at) => {
        const Icon = AGENT_ICONS[at] || Users;
        const color = AGENT_ICON_COLORS[at] || "text-[var(--hack-gray)]";
        return (
          <div key={at} className="border border-[var(--hack-border)] bg-black/30 p-3 text-center animate-pulse">
            <Icon className={`h-5 w-5 mx-auto mb-1 ${color} opacity-50`} />
            <div className="font-mono text-[9px] text-[var(--hack-gray)]/60 uppercase">{at.replace(/_/g, " ")}</div>
            <Loader2 className="h-3 w-3 animate-spin text-[var(--hack-cyan)] mx-auto mt-1" />
          </div>
        );
      })}
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

function SectionHeader({ icon: Icon, title, color, count }: { icon: React.ElementType; title: string; color: string; count: number }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : color === "red" ? "text-[var(--hack-red)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className={`h-3.5 w-3.5 ${c}`} />
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">{title}</span>
      <span className={`font-mono text-[9px] ${c}`}>({count})</span>
    </div>
  );
}
