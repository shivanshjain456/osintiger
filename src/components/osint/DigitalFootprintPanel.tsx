"use client";

import { useState, useEffect } from "react";
import { Loader2, Eye, Server, Shield, AlertTriangle, Users, Package, ChevronDown, ChevronRight } from "lucide-react";

// =====================
// Types
// =====================

interface FootprintDimension {
  name: string;
  score: number;
  riskLevel: string;
  explanation: string;
  factors: { label: string; value: string; impact: number }[];
}

interface FootprintReport {
  overall: number;
  overallRiskLevel: string;
  overallExplanation: string;
  dimensions: {
    publicExposure: FootprintDimension;
    infrastructureFootprint: FootprintDimension;
    securityPosture: FootprintDimension;
    dataLeakExposure: FootprintDimension;
    socialPresence: FootprintDimension;
    openAssets: FootprintDimension;
  };
  metrics: {
    totalSources: number;
    successfulSources: number;
    totalFindings: number;
    uniqueIPs: number;
    dnsRecords: number;
    certificates: number;
    technologies: number;
    securityHeadersPresent: number;
    securityHeadersMissing: number;
    leakMentions: number;
    socialMentions: number;
    openAssets: number;
  };
  exposureBreakdown: { category: string; count: number; percentage: number }[];
  meta: { generatedAt: string };
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

const RISK_COLORS: Record<string, string> = {
  minimal: "text-[var(--hack-green)]",
  low: "text-[var(--hack-green)]",
  moderate: "text-[var(--hack-amber)]",
  high: "text-[var(--hack-orange)]",
  critical: "text-[var(--hack-red)]",
};

const RISK_BG: Record<string, string> = {
  minimal: "border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5",
  low: "border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5",
  moderate: "border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5",
  high: "border-[var(--hack-orange)]/30 bg-[var(--hack-orange)]/5",
  critical: "border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5",
};

function scoreColor(score: number): string {
  if (score >= 80) return "var(--hack-red)";
  if (score >= 60) return "orange";
  if (score >= 40) return "amber";
  if (score >= 20) return "var(--hack-cyan)";
  return "var(--hack-green)";
}

export function DigitalFootprintPanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<FootprintReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/footprint`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        if (!cancelled && data.report) { setReport(data.report); setLoading(false); }
      })
      .catch((e) => {
        if (!cancelled) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» computing digital footprint score..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { overall, overallRiskLevel, dimensions, metrics, exposureBreakdown } = report;

  const radarDims = [
    { ...dimensions.publicExposure, icon: Eye },
    { ...dimensions.infrastructureFootprint, icon: Server },
    { ...dimensions.securityPosture, icon: Shield },
    { ...dimensions.dataLeakExposure, icon: AlertTriangle },
    { ...dimensions.socialPresence, icon: Users },
    { ...dimensions.openAssets, icon: Package },
  ];

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className={`border p-4 ${RISK_BG[overallRiskLevel] || "border-[var(--hack-border)] bg-black/30"}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5" style={{ color: scoreColor(overall) }} />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Overall Digital Footprint</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold" style={{ color: scoreColor(overall) }}>{overall}</span>
            <span className="font-mono text-sm text-[var(--hack-gray)]">/100</span>
            <span className={`font-mono text-[9px] px-2 py-0.5 border ml-2 ${RISK_COLORS[overallRiskLevel] || "text-[var(--hack-gray)]"}`} style={{ borderColor: scoreColor(overall) }}>
              {overallRiskLevel.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="h-2 bg-black/40 border border-[var(--hack-border)] mb-2">
          <div className="h-full transition-all" style={{ width: `${overall}%`, backgroundColor: scoreColor(overall) }} />
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{report.overallExplanation}</p>
      </div>

      {/* Radar Chart */}
      <div className="border border-[var(--hack-border)] bg-black/20 p-4">
        <div className="flex justify-center">
          <FootprintRadar dimensions={radarDims} />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Metric label="Sources" value={metrics.successfulSources} />
        <Metric label="Findings" value={metrics.totalFindings} />
        <Metric label="IPs" value={metrics.uniqueIPs} />
        <Metric label="DNS" value={metrics.dnsRecords} />
        <Metric label="Certs" value={metrics.certificates} />
        <Metric label="Tech" value={metrics.technologies} />
        <Metric label="Sec Headers" value={`${metrics.securityHeadersPresent}/${metrics.securityHeadersPresent + metrics.securityHeadersMissing}`} />
        <Metric label="Leak Hits" value={metrics.leakMentions} />
        <Metric label="Social" value={metrics.socialMentions} />
        <Metric label="Open Assets" value={metrics.openAssets} />
        <Metric label="Missing Headers" value={metrics.securityHeadersMissing} />
        <Metric label="Total Sources" value={metrics.totalSources} />
      </div>

      {/* Dimension Breakdown */}
      <div className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)] section-header">Dimension Breakdown</h3>
        {radarDims.map((dim) => {
          const isExpanded = expandedDim === dim.name;
          return (
            <div key={dim.name} className="border border-[var(--hack-border)] bg-black/20">
              <button
                onClick={() => setExpandedDim(isExpanded ? null : dim.name)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--hack-cyan)]/5 transition-colors text-left"
              >
                <dim.icon className="h-4 w-4 shrink-0" style={{ color: scoreColor(dim.score) }} />
                <span className="font-mono text-xs text-[var(--hack-green)] flex-1">{dim.name}</span>
                <div className="w-24 h-1.5 bg-black/40 shrink-0">
                  <div className="h-full" style={{ width: `${dim.score}%`, backgroundColor: scoreColor(dim.score) }} />
                </div>
                <span className="font-mono text-sm font-bold shrink-0 w-8 text-right" style={{ color: scoreColor(dim.score) }}>{dim.score}</span>
                <span className={`font-mono text-[8px] shrink-0 ${RISK_COLORS[dim.riskLevel] || "text-[var(--hack-gray)]"}`}>{dim.riskLevel.toUpperCase()}</span>
                {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pl-10 space-y-2">
                  <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{dim.explanation}</p>
                  {dim.factors.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]/60">Contributing Factors:</span>
                      {dim.factors.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-[var(--hack-gray)]">{f.label}:</span>
                          <span className="text-[var(--hack-green)]">{f.value}</span>
                          <span className="text-[var(--hack-gray)]/40 ml-auto">{f.impact > 0 ? `+${f.impact}` : f.impact}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Exposure Breakdown by Source Category */}
      {exposureBreakdown.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">{"» Exposure by Source Category"}</span>
          </div>
          <div className="space-y-1">
            {exposureBreakdown.map((eb, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[var(--hack-green)] w-24 shrink-0">{eb.category}</span>
                <div className="flex-1 h-3 bg-black/40 border border-[var(--hack-border)] relative">
                  <div className="h-full bg-[var(--hack-cyan)]/40" style={{ width: `${eb.percentage}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-white">
                    {eb.count} ({eb.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================
// Sub-components
// =====================

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className="font-mono text-sm font-bold text-[var(--hack-cyan)]">{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function FootprintRadar({ dimensions }: { dimensions: { name: string; score: number }[] }) {
  const size = 220;
  const center = size / 2;
  const maxRadius = 80;
  const numAxes = dimensions.length;
  const points = dimensions.map((dim, i) => {
    const angle = (i / numAxes) * Math.PI * 2 - Math.PI / 2;
    const radius = (dim.score / 100) * maxRadius;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      labelX: center + Math.cos(angle) * (maxRadius + 30),
      labelY: center + Math.sin(angle) * (maxRadius + 30),
      name: dim.name,
      score: dim.score,
    };
  });
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size + 100} height={size + 40} viewBox={`0 0 ${size + 100} ${size + 40}`}>
      <g transform={`translate(50, 20)`}>
        {[20, 40, 60, 80, 100].map((level) => (
          <circle key={level} cx={center} cy={center} r={(level / 100) * maxRadius} fill="none" stroke="rgba(0,255,65,0.1)" strokeWidth="1" />
        ))}
        {points.map((p, i) => {
          const angle = (i / numAxes) * Math.PI * 2 - Math.PI / 2;
          return <line key={i} x1={center} y1={center} x2={center + Math.cos(angle) * maxRadius} y2={center + Math.sin(angle) * maxRadius} stroke="rgba(0,255,65,0.1)" strokeWidth="1" />;
        })}
        <polygon points={polygonPoints} fill="rgba(0,255,65,0.15)" stroke="rgba(0,255,65,0.6)" strokeWidth="2" />
        {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--hack-green)" />)}
        {points.map((p, i) => (
          <g key={i}>
            <text x={p.labelX} y={p.labelY} fill="rgba(0,255,65,0.7)" fontSize="7" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">
              {p.name.split(" ").map((w, j) => <tspan key={j} x={p.labelX} dy={j === 0 ? 0 : 8}>{w}</tspan>)}
            </text>
            <text x={p.labelX} y={p.labelY + (p.name.split(" ").length * 8) + 2} fill="var(--hack-cyan)" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">{p.score}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
