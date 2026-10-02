"use client";

import { useState, useEffect } from "react";
import { Loader2, Crosshair, ChevronDown, ChevronRight, AlertTriangle, Globe, Server, Database, Code2, Shield, Cloud } from "lucide-react";

// =====================
// Types
// =====================

interface AssetEntry {
  id: string;
  value: string;
  category: string;
  subtype: string;
  source: string;
  sourceLabel: string;
  tier: number;
  confidence: number;
  risk: string;
  evidence: string;
  active: boolean;
  metadata: Record<string, string>;
}

interface CategorySummary {
  category: string;
  label: string;
  count: number;
  activeCount: number;
  riskCounts: Record<string, number>;
  topRisk: string;
}

interface AttackSurfaceReport {
  assets: AssetEntry[];
  byCategory: Record<string, AssetEntry[]>;
  summaries: CategorySummary[];
  assessment: {
    totalAssets: number;
    activeAssets: number;
    highRiskAssets: number;
    criticalRiskAssets: number;
    attackSurfaceScore: number;
    riskLevel: string;
    explanation: string;
  };
  keyFindings: string[];
  meta: { sourcesAnalyzed: number; findingsAnalyzed: number; generatedAt: string };
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

const RISK_COLORS: Record<string, string> = {
  critical: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  high: "text-[var(--hack-orange)] border-[var(--hack-orange)]/40 bg-[var(--hack-orange)]/10",
  medium: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  low: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  info: "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20",
};

const SCORE_COLOR = (score: number) =>
  score >= 80 ? "var(--hack-red)" : score >= 60 ? "orange" : score >= 40 ? "amber" : score >= 20 ? "var(--hack-cyan)" : "var(--hack-green)";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  subdomain: Globe, port: Server, service: Server, storage: Database,
  api: Code2, admin_portal: Shield, development: Code2, staging: Cloud,
};

export function AttackSurfacePanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<AttackSurfaceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/attack-surface`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled && data.report) { setReport(data.report); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-red)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» mapping attack surface..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { assessment, summaries, keyFindings, byCategory } = report;

  const toggleCat = (cat: string) => setExpandedCats((prev) => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Assessment */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" style={{ color: SCORE_COLOR(assessment.attackSurfaceScore) }} />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Attack Surface Assessment</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold" style={{ color: SCORE_COLOR(assessment.attackSurfaceScore) }}>{assessment.attackSurfaceScore}</span>
            <span className="font-mono text-sm text-[var(--hack-gray)]">/100</span>
            <span className="font-mono text-[9px] px-2 py-0.5 border ml-2" style={{ color: SCORE_COLOR(assessment.attackSurfaceScore), borderColor: SCORE_COLOR(assessment.attackSurfaceScore) }}>
              {assessment.riskLevel.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="h-2 bg-black/40 border border-[var(--hack-border)] mb-2">
          <div className="h-full" style={{ width: `${assessment.attackSurfaceScore}%`, backgroundColor: SCORE_COLOR(assessment.attackSurfaceScore) }} />
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
      </div>

      {/* Key Findings */}
      {keyFindings.length > 0 && (
        <div className="border border-[var(--hack-red)]/20 bg-[var(--hack-red)]/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--hack-red)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-red)]">{"» Key Findings"}</span>
          </div>
          <ul className="space-y-1">
            {keyFindings.map((kf, i) => (
              <li key={i} className="text-xs text-[var(--hack-gray)] flex items-start gap-1">
                <span className="text-[var(--hack-red)] shrink-0">→</span>{kf}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Total Assets" value={assessment.totalAssets} />
        <Stat label="Active" value={assessment.activeAssets} />
        <Stat label="High Risk" value={assessment.highRiskAssets} color="orange" />
        <Stat label="Critical" value={assessment.criticalRiskAssets} color="red" />
        <Stat label="Categories" value={summaries.length} />
      </div>

      {/* Category Summary Bars */}
      {summaries.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Crosshair className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">{"» Asset Categories"}</span>
          </div>
          <div className="space-y-1.5">
            {summaries.map((s) => {
              const Icon = CATEGORY_ICONS[s.category] || Globe;
              return (
                <button
                  key={s.category}
                  onClick={() => toggleCat(s.category)}
                  className="w-full flex items-center gap-3 hover:bg-[var(--hack-cyan)]/5 px-2 py-1 transition-colors"
                >
                  {expandedCats.has(s.category) ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${RISK_COLORS[s.topRisk]?.split(" ")[0] || "text-[var(--hack-gray)]"}`} />
                  <span className="font-mono text-[10px] text-[var(--hack-green)] flex-1 text-left">{s.label}</span>
                  <div className="w-32 h-3 bg-black/40 border border-[var(--hack-border)] shrink-0 relative">
                    <div className="h-full" style={{ width: `${Math.min(s.count * 5, 100)}%`, backgroundColor: SCORE_COLOR(s.count * 5) }} />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-white">{s.count}</span>
                  </div>
                  <span className={`font-mono text-[8px] px-1 py-0.5 border shrink-0 ${RISK_COLORS[s.topRisk] || ""}`}>{s.topRisk.toUpperCase()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded Category Details */}
      {summaries.map((s) => {
        if (!expandedCats.has(s.category)) return null;
        const assets = byCategory[s.category] || [];
        return (
          <div key={s.category} className="border border-[var(--hack-border)] bg-black/20">
            <div className="border-b border-[var(--hack-border)] px-3 py-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
                {s.label} ({assets.length})
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {assets.map((a) => (
                <div key={a.id} className="flex items-center gap-2 border-b border-[var(--hack-border)]/20 px-3 py-1 hover:bg-[var(--hack-green)]/5">
                  <span className={`font-mono text-[8px] px-1 py-0.5 border shrink-0 ${RISK_COLORS[a.risk] || ""}`}>{a.risk.toUpperCase()}</span>
                  <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">{a.value}</span>
                  <span className="font-mono text-[8px] text-[var(--hack-gray)]/50 shrink-0">{a.subtype}</span>
                  <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 shrink-0">T{a.tier}</span>
                  {a.active && <span className="w-1.5 h-1.5 rounded-full bg-[var(--hack-green)] shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color === "red" ? "text-[var(--hack-red)]" : color === "orange" ? "text-[var(--hack-orange)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}
