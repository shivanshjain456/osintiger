"use client";

import { useState, useEffect } from "react";
import {
  Loader2, ChevronDown, ChevronRight, Building2, User, ShieldAlert, Server,
  ShieldCheck, FileText, GitBranch, AlertTriangle, AlertCircle, BookOpen,
  Target, Layers, Clock, Zap, TrendingUp, Eye, Database, Network,
} from "lucide-react";
import {
  fetchPlaybookDetail, type PlaybookDetailResponse, type PlaybookDefinition,
} from "@/lib/osint/client";

interface Props {
  investigationId: string;
}

const PLAYBOOK_ICONS: Record<string, React.ElementType> = {
  Building2,
  User,
  ShieldAlert,
  Server,
  ShieldCheck,
  FileText,
  GitBranch,
  AlertTriangle,
  AlertCircle,
  BookOpen,
};

const COLOR_CLASSES: Record<string, string> = {
  cyan: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  green: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  amber: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  red: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  purple: "text-[var(--hack-purple)] border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10",
};

const TEXT_COLOR: Record<string, string> = {
  cyan: "text-[var(--hack-cyan)]",
  green: "text-[var(--hack-green)]",
  amber: "text-[var(--hack-amber)]",
  red: "text-[var(--hack-red)]",
  purple: "text-[var(--hack-purple)]",
};

export function PlaybookPanel({ investigationId }: Props) {
  const [detail, setDetail] = useState<PlaybookDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSecs, setExpandedSecs] = useState<Set<string>>(new Set(["collection"]));

  useEffect(() => {
    let cancelled = false;
    let active = true;
    (async () => {
      try {
        const d = await fetchPlaybookDetail(investigationId);
        if (!cancelled && active) {
          setDetail(d);
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
  }, [investigationId]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» loading playbook configuration..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!detail) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No playbook data."}</p>;

  const pb = detail.playbook;
  const Icon = PLAYBOOK_ICONS[pb.icon] || BookOpen;
  const colorClass = COLOR_CLASSES[pb.color] || COLOR_CLASSES.cyan;
  const textColor = TEXT_COLOR[pb.color] || "text-[var(--hack-cyan)]";

  const toggleSec = (s: string) => setExpandedSecs((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Header — playbook identity */}
      <div className={`border ${colorClass} p-4`}>
        <div className="flex items-center gap-3 mb-2">
          <Icon className={`h-6 w-6 ${textColor}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className={`font-mono text-base font-bold ${textColor}`}>{pb.name}</h3>
              {detail.is_default && (
                <span className="font-mono text-[9px] border border-current/30 px-1.5 py-0.5">AUTO-SELECTED</span>
              )}
              <span className="font-mono text-[9px] border border-current/30 px-1.5 py-0.5 uppercase">{pb.category}</span>
            </div>
            <p className="text-xs text-[var(--hack-gray)] mt-1">{pb.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-2 font-mono text-[9px] text-[var(--hack-gray)]/60 border-t border-current/20 pt-2">
          <span>target: {detail.target}</span>
          <span>type: {detail.input_type}</span>
          <span>certainty: {pb.expectedCertainty}</span>
          <span>style: {pb.workflow.style.replace(/_/g, " ")}</span>
          {pb.workflow.continuousMonitoring && <span className="text-[var(--hack-cyan)]">continuous monitoring</span>}
        </div>
      </div>

      {/* Applicable input types */}
      {pb.applicableInputTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Best for:</span>
          {pb.applicableInputTypes.map((t) => (
            <span key={t} className={`font-mono text-[9px] border border-current/30 px-1.5 py-0.5 ${textColor}`}>{t}</span>
          ))}
        </div>
      )}

      {/* Config sections */}
      <div className="space-y-2">
        {/* Collection Strategy */}
        <ConfigSection
          title="Collection Strategy"
          icon={Database}
          color={textColor}
          expanded={expandedSecs.has("collection")}
          onToggle={() => toggleSec("collection")}
          rationale={pb.collection.rationale}
        >
          <div className="space-y-2">
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Prioritized Sources ({pb.collection.prioritizedSources.length}):</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {pb.collection.prioritizedSources.map((s, i) => (
                  <span key={i} className="font-mono text-[8px] border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 px-1 text-[var(--hack-green)]">{s}</span>
                ))}
              </div>
            </div>
            {pb.collection.deferredSources.length > 0 && (
              <div>
                <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Deferred Sources ({pb.collection.deferredSources.length}):</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {pb.collection.deferredSources.map((s, i) => (
                    <span key={i} className="font-mono text-[8px] border border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5 px-1 text-[var(--hack-amber)]">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {pb.collection.skippedSources.length > 0 && (
              <div>
                <span className="font-mono text-[9px] uppercase text-[var(--hack-red)]/60">Skipped Sources ({pb.collection.skippedSources.length}):</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {pb.collection.skippedSources.map((s, i) => (
                    <span key={i} className="font-mono text-[8px] border border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5 px-1 text-[var(--hack-red)] line-through">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Focus Entity Types:</span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {pb.collection.focusEntityTypes.map((t, i) => (
                    <span key={i} className="font-mono text-[8px] border border-[var(--hack-border)] px-1 text-[var(--hack-cyan)]">{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Discovery Paths:</span>
                <ul className="mt-0.5 space-y-0.5">
                  {pb.collection.discoveryPaths.map((p, i) => (
                    <li key={i} className="font-mono text-[9px] text-[var(--hack-gray)]/70 flex items-start gap-1">
                      <Network className="h-2 w-2 mt-0.5 shrink-0" /> {p.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </ConfigSection>

        {/* Prioritization */}
        <ConfigSection
          title="Prioritization"
          icon={Target}
          color={textColor}
          expanded={expandedSecs.has("prioritization")}
          onToggle={() => toggleSec("prioritization")}
          rationale={pb.prioritization.rationale}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <WeightBar label="Utility" value={pb.prioritization.utilityWeight} />
            <WeightBar label="Confidence" value={pb.prioritization.confidenceWeight} />
            <WeightBar label="Risk Relevance" value={pb.prioritization.riskRelevanceWeight} />
            <WeightBar label="Downstream" value={pb.prioritization.downstreamWeight} />
          </div>
          <div className="flex items-center gap-3 mt-2 font-mono text-[9px] text-[var(--hack-gray)]/60">
            <span>pivot threshold: {(pb.prioritization.pivotThreshold * 100).toFixed(0)}%</span>
            <span>breadth: {pb.prioritization.favorBreadth ? "favored" : "not favored"}</span>
          </div>
        </ConfigSection>

        {/* Scoring */}
        <ConfigSection
          title="Scoring Model"
          icon={TrendingUp}
          color={textColor}
          expanded={expandedSecs.has("scoring")}
          onToggle={() => toggleSec("scoring")}
          rationale={pb.scoring.rationale}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <WeightBar label="Recency" value={pb.scoring.recencyWeight} />
            <WeightBar label="Credibility" value={pb.scoring.credibilityWeight} />
            <WeightBar label="Corroboration" value={pb.scoring.corroborationWeight} />
            <WeightBar label="Tech Relevance" value={pb.scoring.technicalRelevanceWeight} />
            <WeightBar label="Reputational" value={pb.scoring.reputationalImpactWeight} />
            <WeightBar label="Anomaly" value={pb.scoring.anomalyWeight} />
          </div>
          <div className="mt-2 space-y-1">
            <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">
              confirmed threshold: {(pb.scoring.confirmedThreshold * 100).toFixed(0)}% | probable: {(pb.scoring.probableThreshold * 100).toFixed(0)}%
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-red)]/60">Risk Lenses:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {pb.scoring.riskLenses.map((l, i) => (
                  <span key={i} className="font-mono text-[8px] border border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5 px-1 text-[var(--hack-red)]">{l}</span>
                ))}
              </div>
            </div>
          </div>
        </ConfigSection>

        {/* Reporting */}
        <ConfigSection
          title="Reporting Template"
          icon={FileText}
          color={textColor}
          expanded={expandedSecs.has("reporting")}
          onToggle={() => toggleSec("reporting")}
          rationale={pb.reporting.rationale}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-[var(--hack-gray)]/60">template:</span>
              <span className={textColor}>{pb.reporting.templateType}</span>
              <span className="text-[var(--hack-gray)]/60 ml-2">style:</span>
              <span className={textColor}>{pb.reporting.summaryStyle.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Key Sections ({pb.reporting.keySections.length}):</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {pb.reporting.keySections.map((s, i) => (
                  <span key={i} className="font-mono text-[8px] border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/5 px-1 text-[var(--hack-cyan)]">{s.replace(/_/g, " ")}</span>
                ))}
              </div>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-red)]/60">Risk Flags ({pb.reporting.riskFlags.length}):</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {pb.reporting.riskFlags.map((f, i) => (
                  <span key={i} className="font-mono text-[8px] border border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5 px-1 text-[var(--hack-red)]">{f.replace(/_/g, " ")}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[9px] text-[var(--hack-gray)]/60">
              <span className="flex items-center gap-1">
                {pb.reporting.includeOwnershipStructure ? <CheckMark /> : <XMark />} ownership structure
              </span>
              <span className="flex items-center gap-1">
                {pb.reporting.includeTimeline ? <CheckMark /> : <XMark />} timeline
              </span>
              <span className="flex items-center gap-1">
                {pb.reporting.includeAttribution ? <CheckMark /> : <XMark />} attribution
              </span>
              <span className="flex items-center gap-1">
                {pb.reporting.includeConfidenceExplanations ? <CheckMark /> : <XMark />} confidence explanations
              </span>
            </div>
          </div>
        </ConfigSection>

        {/* Workflow */}
        <ConfigSection
          title="Workflow Orchestration"
          icon={Layers}
          color={textColor}
          expanded={expandedSecs.has("workflow")}
          onToggle={() => toggleSec("workflow")}
          rationale={pb.workflow.rationale}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className="text-[var(--hack-gray)]/60">style:</span>
              <span className={textColor}>{pb.workflow.style.replace(/_/g, " ")}</span>
              <span className="text-[var(--hack-gray)]/60 ml-2">max depth:</span>
              <span className={textColor}>{pb.workflow.maxDepth}</span>
              {pb.workflow.continuousMonitoring && <span className="text-[var(--hack-cyan)]">continuous monitoring</span>}
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Step Sequence:</span>
              <ol className="mt-0.5 space-y-0.5">
                {pb.workflow.stepSequence.map((s, i) => (
                  <li key={i} className="font-mono text-[9px] text-[var(--hack-gray)]/70 flex items-start gap-2">
                    <span className={`${textColor} font-bold shrink-0`}>{i + 1}.</span> {s.replace(/_/g, " ")}
                  </li>
                ))}
              </ol>
            </div>
            {pb.workflow.escalationRules.length > 0 && (
              <div>
                <span className="font-mono text-[9px] uppercase text-[var(--hack-red)]/60">Escalation Rules:</span>
                <ul className="mt-0.5 space-y-0.5">
                  {pb.workflow.escalationRules.map((r, i) => (
                    <li key={i} className="font-mono text-[9px] text-[var(--hack-red)]/70 flex items-start gap-1">
                      <AlertTriangle className="h-2 w-2 mt-0.5 shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pb.workflow.reviewCheckpoints.length > 0 && (
              <div>
                <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Review Checkpoints:</span>
                <ul className="mt-0.5 space-y-0.5">
                  {pb.workflow.reviewCheckpoints.map((c, i) => (
                    <li key={i} className="font-mono text-[9px] text-[var(--hack-amber)]/70 flex items-start gap-1">
                      <Clock className="h-2 w-2 mt-0.5 shrink-0" /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pb.workflow.stoppingConditions.length > 0 && (
              <div>
                <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Stopping Conditions:</span>
                <ul className="mt-0.5 space-y-0.5">
                  {pb.workflow.stoppingConditions.map((c, i) => (
                    <li key={i} className="font-mono text-[9px] text-[var(--hack-green)]/70 flex items-start gap-1">
                      <CheckMark /> {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </ConfigSection>
      </div>

      {/* Typical questions */}
      {pb.typicalQuestions.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-3">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60 mb-1">
            <Eye className="h-3 w-3" /> Typical Questions This Playbook Answers:
          </span>
          <ul className="space-y-0.5">
            {pb.typicalQuestions.map((q, i) => (
              <li key={i} className="font-mono text-[10px] text-[var(--hack-gray)]/70 flex items-start gap-1.5">
                <span className="text-[var(--hack-cyan)] shrink-0">?</span> {q}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Failure modes */}
      {pb.failureModes.length > 0 && (
        <div className="border border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5 p-3">
          <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase text-[var(--hack-amber)]/60 mb-1">
            <AlertCircle className="h-3 w-3" /> Common Failure Modes to Avoid:
          </span>
          <ul className="space-y-0.5">
            {pb.failureModes.map((f, i) => (
              <li key={i} className="font-mono text-[10px] text-[var(--hack-amber)]/70 flex items-start gap-1.5">
                <XMark /> {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Config Section (expandable)
// ============================================================================

function ConfigSection({
  title, icon: Icon, color, expanded, onToggle, rationale, children,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  rationale: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/20">
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-2.5 hover:bg-[var(--hack-cyan)]/5">
        {expanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="font-mono text-xs text-[var(--hack-gray)] flex-1 text-left">{title}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <p className="font-mono text-[9px] text-[var(--hack-gray)]/60 italic mb-2 border-l-2 border-[var(--hack-border)] pl-2">{rationale}</p>
          {children}
        </div>
      )}
    </div>
  );
}

function WeightBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/40 p-1.5">
      <div className="flex items-center justify-between font-mono text-[8px] text-[var(--hack-gray)]/60 mb-0.5">
        <span>{label}</span>
        <span className="text-[var(--hack-cyan)]">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="w-full h-1 bg-black/60">
        <div className="h-full bg-[var(--hack-cyan)]" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function CheckMark() {
  return <span className="text-[var(--hack-green)] text-[10px]">✓</span>;
}

function XMark() {
  return <span className="text-[var(--hack-red)] text-[10px]">✗</span>;
}
