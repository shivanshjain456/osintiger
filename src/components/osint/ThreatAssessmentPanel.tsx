"use client";

import { useState, useEffect } from "react";
import { Loader2, ShieldAlert, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Eye, Wrench, Clock, HelpCircle } from "lucide-react";

// =====================
// Types
// =====================

interface RiskDriver {
  id: string; type: string; description: string; role: string; impact: number;
  evidence: string; source: string; sourceLabel: string; tier: number; confidence: number; explanation: string;
}
interface ThreatScenario {
  id: string; name: string; description: string; likelihood: string; likelihoodReasoning: string;
  impact: string; impactDescription: string; impactCategories: string[];
  confidence: string; confidenceReasoning: string; driverIds: string[]; alternativeInterpretations: string[];
}
interface EvidenceRef { type: string; description: string; source: string; sourceLabel: string; tier: number; confidence: number; timestamp: string; }
interface UnknownGap { area: string; description: string; impact: string; whatWouldHelp: string; priority: string; }
interface Mitigation { id: string; action: string; priority: string; type: string; rationale: string; driverIds: string[]; expectedEffectiveness: string; }

interface ThreatAssessment {
  riskDrivers: RiskDriver[];
  scenarios: ThreatScenario[];
  evidence: EvidenceRef[];
  unknowns: UnknownGap[];
  mitigations: Mitigation[];
  overall: {
    threatLevel: string; threatScore: number; overallConfidence: string;
    overallLikelihood: string; overallImpact: string; summary: string; explanation: string;
  };
  meta: { sourcesAnalyzed: number; findingsAnalyzed: number; driversIdentified: number; scenariosEvaluated: number; unknownsIdentified: number; mitigationsRecommended: number; generatedAt: string };
}

interface Props { investigationId: string; apiPath: "standard" | "agent"; }

const THREAT_COLORS: Record<string, string> = {
  minimal: "var(--hack-green)", low: "var(--hack-cyan)", moderate: "amber",
  high: "orange", critical: "var(--hack-red)",
};
const THREAT_TEXT_COLORS: Record<string, string> = {
  minimal: "text-[var(--hack-green)]", low: "text-[var(--hack-cyan)]", moderate: "text-[var(--hack-amber)]",
  high: "text-[var(--hack-orange)]", critical: "text-[var(--hack-red)]",
};
const LIKELIHOOD_COLORS: Record<string, string> = {
  very_low: "text-[var(--hack-green)]", low: "text-[var(--hack-cyan)]", moderate: "text-[var(--hack-amber)]",
  high: "text-[var(--hack-orange)]", very_high: "text-[var(--hack-red)]",
};
const ROLE_COLORS: Record<string, string> = {
  direct_indicator: "text-[var(--hack-red)] border-[var(--hack-red)]/40",
  supporting_signal: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40",
  contextual_factor: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40",
  mitigating_factor: "text-[var(--hack-green)] border-[var(--hack-green)]/40",
};
const PRIORITY_ICONS: Record<string, React.ElementType> = {
  immediate: AlertTriangle, short_term: Clock, medium_term: Eye, monitoring: Eye,
};
const PRIORITY_COLORS: Record<string, string> = {
  immediate: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  short_term: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  medium_term: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  monitoring: "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20",
};

export function ThreatAssessmentPanel({ investigationId, apiPath }: Props) {
  const [assessment, setAssessment] = useState<ThreatAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSecs, setExpandedSecs] = useState<Set<string>>(new Set(["scenarios", "drivers"]));

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/threat`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled && data.assessment) { setAssessment(data.assessment); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-red)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» assessing threats..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!assessment) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { overall, riskDrivers, scenarios, evidence, unknowns, mitigations } = assessment;

  const toggleSec = (s: string) => setExpandedSecs((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Overall Assessment */}
      <div className="border p-4" style={{ borderColor: `${THREAT_COLORS[overall.threatLevel] || "var(--hack-border)"}40`, backgroundColor: `${THREAT_COLORS[overall.threatLevel] || "var(--hack-bg)"}10` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" style={{ color: THREAT_COLORS[overall.threatLevel] || "var(--hack-gray)" }} />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Threat Assessment</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold" style={{ color: THREAT_COLORS[overall.threatLevel] || "var(--hack-gray)" }}>
              {overall.threatScore}
            </span>
            <span className="font-mono text-sm text-[var(--hack-gray)]">/100</span>
            <span className={`font-mono text-[9px] px-2 py-0.5 border ml-2 ${THREAT_TEXT_COLORS[overall.threatLevel] || "text-[var(--hack-gray)]"}`} style={{ borderColor: THREAT_COLORS[overall.threatLevel] }}>
              {overall.threatLevel.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="h-2 bg-black/40 border border-[var(--hack-border)] mb-2">
          <div className="h-full" style={{ width: `${overall.threatScore}%`, backgroundColor: THREAT_COLORS[overall.threatLevel] }} />
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed mb-2">{overall.summary}</p>
        <p className="text-xs text-[var(--hack-gray)]/70 leading-relaxed">{overall.explanation}</p>
        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="border border-[var(--hack-border)] bg-black/20 px-2 py-1 text-center">
            <div className={`font-mono text-sm font-bold ${LIKELIHOOD_COLORS[overall.overallLikelihood] || "text-[var(--hack-gray)]"}`}>{overall.overallLikelihood.toUpperCase()}</div>
            <div className="font-mono text-[8px] text-[var(--hack-gray)]">LIKELIHOOD</div>
          </div>
          <div className="border border-[var(--hack-border)] bg-black/20 px-2 py-1 text-center">
            <div className={`font-mono text-sm font-bold ${THREAT_TEXT_COLORS[overall.overallImpact] || "text-[var(--hack-gray)]"}`}>{overall.overallImpact.toUpperCase()}</div>
            <div className="font-mono text-[8px] text-[var(--hack-gray)]">IMPACT</div>
          </div>
          <div className="border border-[var(--hack-border)] bg-black/20 px-2 py-1 text-center">
            <div className={`font-mono text-sm font-bold ${LIKELIHOOD_COLORS[overall.overallConfidence] || "text-[var(--hack-gray)]"}`}>{overall.overallConfidence.toUpperCase()}</div>
            <div className="font-mono text-[8px] text-[var(--hack-gray)]">CONFIDENCE</div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Stat label="Drivers" value={assessment.meta.driversIdentified} />
        <Stat label="Scenarios" value={assessment.meta.scenariosEvaluated} />
        <Stat label="Evidence" value={evidence.length} />
        <Stat label="Unknowns" value={assessment.meta.unknownsIdentified} color="amber" />
        <Stat label="Mitigations" value={assessment.meta.mitigationsRecommended} color="green" />
        <Stat label="Findings" value={assessment.meta.findingsAnalyzed} />
      </div>

      {/* Threat Scenarios */}
      {scenarios.length > 0 && (
        <Section title="Threat Scenarios" icon={ShieldAlert} expanded={expandedSecs.has("scenarios")} onToggle={() => toggleSec("scenarios")}>
          <div className="space-y-3">
            {scenarios.map((scn) => (
              <div key={scn.id} className="border border-[var(--hack-border)] bg-black/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-xs font-bold text-[var(--hack-green)]">{scn.name}</span>
                  <span className={`font-mono text-[8px] px-1 py-0.5 border ${LIKELIHOOD_COLORS[scn.likelihood] || ""} border-current`}>{scn.likelihood.toUpperCase()}</span>
                  <span className={`font-mono text-[8px] px-1 py-0.5 border ${THREAT_TEXT_COLORS[scn.impact] || ""} border-current`}>IMPACT: {scn.impact.toUpperCase()}</span>
                  <span className={`font-mono text-[8px] px-1 py-0.5 border ${LIKELIHOOD_COLORS[scn.confidence] || ""} border-current`}>CONF: {scn.confidence.toUpperCase()}</span>
                </div>
                <p className="text-xs text-[var(--hack-gray)] mb-2">{scn.description}</p>
                <div className="space-y-1.5">
                  <div>
                    <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]">Likelihood Reasoning: </span>
                    <span className="text-[10px] text-[var(--hack-gray)]">{scn.likelihoodReasoning}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]">Impact: </span>
                    <span className="text-[10px] text-[var(--hack-gray)]">{scn.impactDescription}</span>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]">Confidence: </span>
                    <span className="text-[10px] text-[var(--hack-gray)]">{scn.confidenceReasoning}</span>
                  </div>
                  {scn.alternativeInterpretations.length > 0 && (
                    <div>
                      <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]">Alternative Interpretations:</span>
                      <ul className="mt-0.5">
                        {scn.alternativeInterpretations.map((alt, i) => (
                          <li key={i} className="text-[10px] text-[var(--hack-gray)]/70 flex items-start gap-1">
                            <span className="text-[var(--hack-amber)]/60 shrink-0">→</span>{alt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Risk Drivers */}
      {riskDrivers.length > 0 && (
        <Section title="Risk Drivers" icon={AlertTriangle} expanded={expandedSecs.has("drivers")} onToggle={() => toggleSec("drivers")}>
          <div className="space-y-1.5">
            {riskDrivers.map((drv) => (
              <div key={drv.id} className="border border-[var(--hack-border)]/30 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-[8px] px-1 py-0.5 border shrink-0 ${ROLE_COLORS[drv.role] || "text-[var(--hack-gray)]"}`}>
                    {drv.role.toUpperCase().replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">{drv.description}</span>
                  <span className={`font-mono text-[8px] shrink-0 ${drv.impact > 0 ? "text-[var(--hack-red)]" : "text-[var(--hack-green)]"}`}>
                    {drv.impact > 0 ? `+${drv.impact}` : drv.impact}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--hack-gray)]/60 mt-0.5">{drv.explanation}</p>
                <div className="font-mono text-[8px] text-[var(--hack-gray)]/40 mt-0.5">
                  Source: {drv.sourceLabel} · T{drv.tier} · {(drv.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Mitigations */}
      {mitigations.length > 0 && (
        <Section title="Recommended Mitigations" icon={Wrench} expanded={expandedSecs.has("mitigations")} onToggle={() => toggleSec("mitigations")}>
          <div className="space-y-1.5">
            {mitigations.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority)).map((mit) => {
              const Icon = PRIORITY_ICONS[mit.priority] || Eye;
              return (
                <div key={mit.id} className={`border px-2 py-1.5 ${PRIORITY_COLORS[mit.priority] || ""}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="font-mono text-[8px] px-1 py-0.5 border border-current shrink-0">{mit.priority.toUpperCase().replace(/_/g, " ")}</span>
                    <span className="font-mono text-[10px] text-[var(--hack-green)] flex-1">{mit.action}</span>
                  </div>
                  <p className="text-[10px] text-[var(--hack-gray)]/60 mt-0.5">{mit.rationale}</p>
                  <p className="text-[9px] text-[var(--hack-gray)]/40 mt-0.5">Effectiveness: {mit.expectedEffectiveness}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Unknowns */}
      {unknowns.length > 0 && (
        <Section title="Unknowns & Blind Spots" icon={HelpCircle} expanded={expandedSecs.has("unknowns")} onToggle={() => toggleSec("unknowns")}>
          <div className="space-y-1.5">
            {unknowns.map((unk, i) => (
              <div key={i} className="border border-[var(--hack-amber)]/20 bg-[var(--hack-amber)]/5 px-2 py-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-mono text-[8px] px-1 py-0.5 border ${unk.priority === "high" ? "text-[var(--hack-red)] border-[var(--hack-red)]/40" : unk.priority === "medium" ? "text-[var(--hack-amber)] border-[var(--hack-amber)]/40" : "text-[var(--hack-gray)] border-[var(--hack-border)]"}`}>
                    {unk.priority.toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--hack-amber)]">{unk.area}</span>
                </div>
                <p className="text-[10px] text-[var(--hack-gray)]">{unk.description}</p>
                <p className="text-[9px] text-[var(--hack-gray)]/60 mt-0.5">Impact: {unk.impact}</p>
                <p className="text-[9px] text-[var(--hack-green)]/70 mt-0.5">What would help: {unk.whatWouldHelp}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Evidence */}
      {evidence.length > 0 && (
        <Section title="Evidence Base" icon={CheckCircle2} expanded={expandedSecs.has("evidence")} onToggle={() => toggleSec("evidence")}>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {evidence.slice(0, 20).map((ev, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-[var(--hack-border)]/20 py-0.5">
                <span className={`font-mono text-[8px] shrink-0 ${ev.type === "primary" ? "text-[var(--hack-green)]" : ev.type === "corroborating" ? "text-[var(--hack-cyan)]" : "text-[var(--hack-gray)]"}`}>
                  [{ev.type.toUpperCase()}]
                </span>
                <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate flex-1">{ev.description}</span>
                <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 shrink-0">T{ev.tier}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function priorityOrder(p: string): number {
  return { immediate: 0, short_term: 1, medium_term: 2, monitoring: 3 }[p] ?? 4;
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function Section({ title, icon: Icon, expanded, onToggle, children }: { title: string; icon: React.ElementType; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/20">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-cyan)]/5 transition-colors">
        <Icon className="h-4 w-4 text-[var(--hack-cyan)] shrink-0" />
        <span className="font-mono text-xs text-[var(--hack-green)] flex-1 text-left">{title}</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
