"use client";

import { useState, useEffect } from "react";
import { Loader2, ShieldCheck, AlertCircle, TrendingUp, Clock, GitBranch, Award } from "lucide-react";

// =====================
// Types (matching the backend ConfidenceBreakdown)
// =====================

interface ConfidenceDimension {
  name: string;
  score: number;
  explanation: string;
  factors: { label: string; value: string; impact: number }[];
}

interface SourceConfidenceDetail {
  source: string;
  sourceLabel: string;
  tier: number;
  tierLabel: string;
  findingCount: number;
  status: string;
  contribution: number;
}

interface VerificationDetail {
  finding: string;
  findingIndex: number;
  confirmingSources: string[];
  confirmationCount: number;
  isVerified: boolean;
}

interface ConfidenceBreakdown {
  overall: number;
  overallExplanation: string;
  dimensions: {
    sourceConfidence: ConfidenceDimension;
    crossSourceConfidence: ConfidenceDimension;
    freshness: ConfidenceDimension;
    verification: ConfidenceDimension;
    trustScore: ConfidenceDimension;
  };
  sourceDetails: SourceConfidenceDetail[];
  verificationDetails: VerificationDetail[];
  meta: {
    totalSources: number;
    successfulSources: number;
    totalFindings: number;
    verifiedFindings: number;
    sourceDiversity: number;
    generatedAt: string;
  };
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

const TIER_COLORS: Record<number, string> = {
  5: "text-[var(--hack-green)]",
  4: "text-[var(--hack-cyan)]",
  3: "text-[var(--hack-amber)]",
  2: "text-[var(--hack-orange)]",
  1: "text-[var(--hack-red)]",
};

const SCORE_COLORS: Record<string, string> = {
  high: "text-[var(--hack-green)]",
  moderate: "text-[var(--hack-cyan)]",
  low: "text-[var(--hack-amber)]",
  very_low: "text-[var(--hack-red)]",
};

function getScoreLevel(score: number): keyof typeof SCORE_COLORS {
  if (score >= 80) return "high";
  if (score >= 60) return "moderate";
  if (score >= 40) return "low";
  return "very_low";
}

export function ConfidenceEnginePanel({ investigationId, apiPath }: Props) {
  const [breakdown, setBreakdown] = useState<ConfidenceBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/confidence`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data.confidence) {
          setBreakdown(data.confidence);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load confidence");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]">
          {"» computing confidence dimensions..."}
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

  if (!breakdown) {
    return (
      <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">
        {"» No confidence data available."}
      </p>
    );
  }

  const overallLevel = getScoreLevel(breakdown.overall);
  const dims = breakdown.dimensions;

  // Radar chart data (5 dimensions)
  const radarDims = [
    { ...dims.sourceConfidence, icon: Award, color: "var(--hack-green)" },
    { ...dims.crossSourceConfidence, icon: GitBranch, color: "var(--hack-cyan)" },
    { ...dims.freshness, icon: Clock, color: "amber" },
    { ...dims.verification, icon: ShieldCheck, color: "var(--hack-green)" },
    { ...dims.trustScore, icon: TrendingUp, color: "var(--hack-cyan)" },
  ];

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${SCORE_COLORS[overallLevel]}`} />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">
              Overall Confidence
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className={`font-mono text-3xl font-bold ${SCORE_COLORS[overallLevel]}`}>
              {breakdown.overall}
            </span>
            <span className="font-mono text-sm text-[var(--hack-gray)]">/100</span>
          </div>
        </div>
        {/* Score bar */}
        <div className="h-2 bg-black/40 border border-[var(--hack-border)] mb-2">
          <div
            className="h-full transition-all"
            style={{
              width: `${breakdown.overall}%`,
              backgroundColor: breakdown.overall >= 80 ? "var(--hack-green)" : breakdown.overall >= 60 ? "var(--hack-cyan)" : breakdown.overall >= 40 ? "amber" : "var(--hack-red)",
            }}
          />
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{breakdown.overallExplanation}</p>
      </div>

      {/* Radar Chart (SVG) */}
      <div className="border border-[var(--hack-border)] bg-black/20 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
            {"» Confidence Radar"}
          </span>
        </div>
        <div className="flex justify-center">
          <RadarChart dimensions={radarDims} />
        </div>
      </div>

      {/* Dimension Breakdown */}
      <div className="space-y-2">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)] section-header">
          Dimension Breakdown
        </h3>
        {radarDims.map((dim) => {
          const isExpanded = expandedDim === dim.name;
          const level = getScoreLevel(dim.score);
          return (
            <div key={dim.name} className="border border-[var(--hack-border)] bg-black/20">
              <button
                onClick={() => setExpandedDim(isExpanded ? null : dim.name)}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--hack-green)]/5 transition-colors text-left"
              >
                <dim.icon className={`h-4 w-4 shrink-0 ${SCORE_COLORS[level]}`} />
                <span className="font-mono text-xs text-[var(--hack-green)] flex-1">{dim.name}</span>
                {/* Score bar */}
                <div className="w-24 h-1.5 bg-black/40 shrink-0">
                  <div
                    className="h-full"
                    style={{
                      width: `${dim.score}%`,
                      backgroundColor: dim.score >= 80 ? "var(--hack-green)" : dim.score >= 60 ? "var(--hack-cyan)" : dim.score >= 40 ? "amber" : "var(--hack-red)",
                    }}
                  />
                </div>
                <span className={`font-mono text-sm font-bold ${SCORE_COLORS[level]} shrink-0 w-8 text-right`}>
                  {dim.score}
                </span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-3 pl-10 space-y-2">
                  <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{dim.explanation}</p>
                  {dim.factors.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]/60">
                        Contributing Factors:
                      </span>
                      {dim.factors.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-[var(--hack-gray)]">{f.label}:</span>
                          <span className="text-[var(--hack-green)]">{f.value}</span>
                          <span className="text-[var(--hack-gray)]/40 ml-auto">+{f.impact}</span>
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

      {/* Meta stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <MetaCard label="Total Sources" value={breakdown.meta.totalSources} />
        <MetaCard label="Successful" value={breakdown.meta.successfulSources} />
        <MetaCard label="Findings" value={breakdown.meta.totalFindings} />
        <MetaCard label="Verified" value={breakdown.meta.verifiedFindings} />
        <MetaCard label="Diversity" value={breakdown.meta.sourceDiversity} />
      </div>

      {/* Source Details Table */}
      {breakdown.sourceDetails.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20">
          <div className="border-b border-[var(--hack-border)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
              {"» Source Reliability Breakdown"}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full font-mono text-[10px]">
              <thead className="sticky top-0 bg-black/80">
                <tr className="text-left text-[var(--hack-gray)]/60 border-b border-[var(--hack-border)]">
                  <th className="px-2 py-1">Source</th>
                  <th className="px-2 py-1">Tier</th>
                  <th className="px-2 py-1">Findings</th>
                  <th className="px-2 py-1">Contrib.</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.sourceDetails.map((s, i) => (
                  <tr key={i} className="border-b border-[var(--hack-border)]/30">
                    <td className="px-2 py-1 text-[var(--hack-green)] truncate max-w-[150px]">{s.sourceLabel}</td>
                    <td className={`px-2 py-1 ${TIER_COLORS[s.tier] || "text-[var(--hack-gray)]"}`}>T{s.tier}</td>
                    <td className="px-2 py-1 text-[var(--hack-gray)]">{s.findingCount}</td>
                    <td className="px-2 py-1 text-[var(--hack-cyan)]">{s.contribution}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verification Details */}
      {breakdown.verificationDetails.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20">
          <div className="border-b border-[var(--hack-border)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">
              {"» Finding Verification"}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-[var(--hack-border)]/30">
            {breakdown.verificationDetails.map((v, i) => (
              <div key={i} className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  {v.isVerified ? (
                    <ShieldCheck className="h-3 w-3 text-[var(--hack-green)] shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-[var(--hack-amber)] shrink-0" />
                  )}
                  <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate flex-1">
                    {v.finding.slice(0, 80)}...
                  </span>
                  <span className={`font-mono text-[9px] shrink-0 ${v.isVerified ? "text-[var(--hack-green)]" : "text-[var(--hack-amber)]"}`}>
                    {v.confirmationCount} source(s)
                  </span>
                </div>
                {v.confirmingSources.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-0.5 pl-5">
                    {v.confirmingSources.map((src, j) => (
                      <span key={j} className="font-mono text-[8px] border border-[var(--hack-border)] bg-black/40 px-1 text-[var(--hack-cyan)]">
                        {src}
                      </span>
                    ))}
                  </div>
                )}
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

function MetaCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className="font-mono text-sm font-bold text-[var(--hack-cyan)]">{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function RadarChart({ dimensions }: { dimensions: { name: string; score: number; color: string }[] }) {
  const size = 220;
  const center = size / 2;
  const maxRadius = 80;
  const numAxes = dimensions.length;

  // Calculate points for each dimension
  const points = dimensions.map((dim, i) => {
    const angle = (i / numAxes) * Math.PI * 2 - Math.PI / 2;
    const radius = (dim.score / 100) * maxRadius;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      labelX: center + Math.cos(angle) * (maxRadius + 25),
      labelY: center + Math.sin(angle) * (maxRadius + 25),
      name: dim.name,
      score: dim.score,
    };
  });

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  // Grid circles
  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <svg width={size + 80} height={size + 40} viewBox={`0 0 ${size + 80} ${size + 40}`}>
      <g transform={`translate(40, 20)`}>
        {/* Grid circles */}
        {gridLevels.map((level) => {
          const r = (level / 100) * maxRadius;
          return (
            <circle
              key={level}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke="rgba(0,255,65,0.1)"
              strokeWidth="1"
            />
          );
        })}

        {/* Axis lines */}
        {points.map((p, i) => {
          const angle = (i / numAxes) * Math.PI * 2 - Math.PI / 2;
          const endX = center + Math.cos(angle) * maxRadius;
          const endY = center + Math.sin(angle) * maxRadius;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={endX}
              y2={endY}
              stroke="rgba(0,255,65,0.1)"
              strokeWidth="1"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={polygonPoints}
          fill="rgba(0,255,65,0.15)"
          stroke="rgba(0,255,65,0.6)"
          strokeWidth="2"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="var(--hack-green)"
          />
        ))}

        {/* Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <text
              x={p.labelX}
              y={p.labelY}
              fill="rgba(0,255,65,0.7)"
              fontSize="8"
              fontFamily="monospace"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {p.name.split(" ").map((w, j) => (
                <tspan key={j} x={p.labelX} dy={j === 0 ? 0 : 9}>{w}</tspan>
              ))}
            </text>
            <text
              x={p.labelX}
              y={p.labelY + (p.name.split(" ").length * 9) + 2}
              fill="var(--hack-cyan)"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {p.score}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
