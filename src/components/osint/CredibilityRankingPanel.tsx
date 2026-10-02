"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Award, TrendingUp, Settings, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

// =====================
// Types
// =====================

interface SourceRanking {
  source: string;
  sourceLabel: string;
  tier: number;
  tierLabel: string;
  overridden: boolean;
  defaultTier: number;
  weight: number;
  findingCount: number;
  status: string;
  weightedFindings: number;
  credibilityContribution: number;
}

interface TierDistribution {
  tier: number;
  label: string;
  sourceCount: number;
  findingCount: number;
  weight: number;
  totalWeightedFindings: number;
  percentage: number;
}

interface WeightedEvidenceAssessment {
  weightedScore: number;
  totalFindings: number;
  totalWeightedFindings: number;
  averageWeight: number;
  explanation: string;
}

interface WeightedFinding {
  data: string;
  sourceUrl: string;
  source: string;
  sourceLabel: string;
  tier: number;
  weight: number;
  originalConfidence: number;
  weightedConfidence: number;
}

interface CredibilityRanking {
  config: { weights: Record<string, number>; overrides: Record<string, number> };
  sourceRankings: SourceRanking[];
  tierDistribution: TierDistribution[];
  weightedAssessment: WeightedEvidenceAssessment;
  topFindings: WeightedFinding[];
  meta: {
    totalSources: number;
    successfulSources: number;
    totalFindings: number;
    overriddenSources: number;
    generatedAt: string;
  };
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

const TIER_COLORS: Record<number, string> = {
  5: "#00ff41",
  4: "#00ffff",
  3: "#ffaa00",
  2: "#ff8866",
  1: "#ff0040",
};

const TIER_NAMES: Record<number, string> = {
  5: "Authoritative",
  4: "Threat Intel",
  3: "Established",
  2: "Community",
  1: "Unverified",
};

const DEFAULT_WEIGHTS: Record<string, number> = {
  tier5: 1.0,
  tier4: 0.8,
  tier3: 0.6,
  tier2: 0.4,
  tier1: 0.2,
};

export function CredibilityRankingPanel({ investigationId, apiPath }: Props) {
  const [ranking, setRanking] = useState<CredibilityRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [weights, setWeights] = useState<Record<string, number>>(DEFAULT_WEIGHTS);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const fetchRanking = useCallback((customWeights?: Record<string, number>) => {
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    const config = customWeights ? { weights: customWeights } : undefined;
    const url = config
      ? `${basePath}/${investigationId}/credibility?config=${encodeURIComponent(JSON.stringify(config))}`
      : `${basePath}/${investigationId}/credibility`;

    fetch(url, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (data.ranking) {
          setRanking(data.ranking);
          setError(null);
          setLoading(false);
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load credibility ranking");
        setLoading(false);
      });
  }, [investigationId, apiPath]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  const handleWeightChange = (tier: string, value: number) => {
    const newWeights = { ...weights, [tier]: value };
    setWeights(newWeights);
  };

  const applyWeights = () => {
    setLoading(true);
    fetchRanking(weights);
    setShowConfig(false);
  };

  const resetWeights = () => {
    setWeights(DEFAULT_WEIGHTS);
    setLoading(true);
    fetchRanking(DEFAULT_WEIGHTS);
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]">
          {"» computing source credibility rankings..."}
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

  if (!ranking) {
    return (
      <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">
        {"» No credibility data available."}
      </p>
    );
  }

  const { weightedAssessment, tierDistribution, sourceRankings, topFindings, meta } = ranking;

  return (
    <div className="space-y-4">
      {/* Weighted Evidence Score */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-[var(--hack-green)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">
              Weighted Evidence Score
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-3xl font-bold text-[var(--hack-green)]">
              {weightedAssessment.weightedScore}
            </span>
            <span className="font-mono text-sm text-[var(--hack-gray)]">/100</span>
          </div>
        </div>
        <div className="h-2 bg-black/40 border border-[var(--hack-border)] mb-2">
          <div
            className="h-full bg-[var(--hack-green)] transition-all"
            style={{ width: `${weightedAssessment.weightedScore}%` }}
          />
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{weightedAssessment.explanation}</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="border border-[var(--hack-border)] bg-black/20 px-2 py-1 text-center">
            <div className="font-mono text-sm font-bold text-[var(--hack-cyan)]">{weightedAssessment.totalFindings}</div>
            <div className="font-mono text-[8px] uppercase text-[var(--hack-gray)]">Findings</div>
          </div>
          <div className="border border-[var(--hack-border)] bg-black/20 px-2 py-1 text-center">
            <div className="font-mono text-sm font-bold text-[var(--hack-cyan)]">{weightedAssessment.totalWeightedFindings.toFixed(1)}</div>
            <div className="font-mono text-[8px] uppercase text-[var(--hack-gray)]">Weighted</div>
          </div>
          <div className="border border-[var(--hack-border)] bg-black/20 px-2 py-1 text-center">
            <div className="font-mono text-sm font-bold text-[var(--hack-cyan)]">{weightedAssessment.averageWeight.toFixed(2)}</div>
            <div className="font-mono text-[8px] uppercase text-[var(--hack-gray)]">Avg Weight</div>
          </div>
        </div>
      </div>

      {/* Tier Distribution */}
      <div className="border border-[var(--hack-border)] bg-black/20 p-3">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
            {"» Tier Distribution"}
          </span>
        </div>
        <div className="space-y-2">
          {tierDistribution.map((td) => (
            <div key={td.tier} className="flex items-center gap-3">
              {/* Tier badge */}
              <div
                className="font-mono text-[10px] font-bold px-2 py-0.5 shrink-0"
                style={{ color: TIER_COLORS[td.tier], border: `1px solid ${TIER_COLORS[td.tier]}40`, backgroundColor: `${TIER_COLORS[td.tier]}10` }}
              >
                T{td.tier}
              </div>
              {/* Tier name */}
              <span className="font-mono text-[10px] text-[var(--hack-gray)] shrink-0 w-20">
                {TIER_NAMES[td.tier]}
              </span>
              {/* Bar */}
              <div className="flex-1 h-4 bg-black/40 border border-[var(--hack-border)] relative">
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${td.percentage}%`,
                    backgroundColor: TIER_COLORS[td.tier],
                    opacity: 0.6,
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] text-white">
                  {td.sourceCount} sources · {td.findingCount} findings · {td.percentage}%
                </span>
              </div>
              {/* Weight */}
              <span className="font-mono text-[10px] text-[var(--hack-gray)] shrink-0 w-12 text-right">
                w:{td.weight.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Config Panel */}
      <div className="border border-[var(--hack-border)] bg-black/20">
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-green)]/5 transition-colors"
        >
          <Settings className="h-3.5 w-3.5 text-[var(--hack-gray)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">
            Configurable Weighting
          </span>
          {showConfig ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] ml-auto" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] ml-auto" />}
        </button>
        {showConfig && (
          <div className="px-3 pb-3 space-y-3">
            <p className="font-mono text-[9px] text-[var(--hack-gray)]/60">
              Adjust the weight (0-1) for each credibility tier. Higher weight = more influence on the overall score.
            </p>
            {Object.entries(weights).map(([key, value]) => {
              const tierNum = parseInt(key.replace("tier", ""));
              return (
                <div key={key} className="flex items-center gap-3">
                  <div
                    className="font-mono text-[10px] font-bold px-2 py-0.5 shrink-0"
                    style={{ color: TIER_COLORS[tierNum], border: `1px solid ${TIER_COLORS[tierNum]}40` }}
                  >
                    T{tierNum}
                  </div>
                  <span className="font-mono text-[10px] text-[var(--hack-gray)] shrink-0 w-24">
                    {TIER_NAMES[tierNum]}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={value}
                    onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
                    className="flex-1 accent-[var(--hack-green)]"
                  />
                  <span className="font-mono text-[10px] text-[var(--hack-green)] shrink-0 w-8 text-right">
                    {value.toFixed(1)}
                  </span>
                </div>
              );
            })}
            <div className="flex gap-2 pt-1">
              <button
                onClick={applyWeights}
                className="font-mono text-[10px] border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-3 py-1 text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20"
              >
                Apply Weights
              </button>
              <button
                onClick={resetWeights}
                className="flex items-center gap-1 font-mono text-[10px] border border-[var(--hack-border)] px-3 py-1 text-[var(--hack-gray)] hover:text-[var(--hack-red)]"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Source Rankings Table */}
      <div className="border border-[var(--hack-border)] bg-black/20">
        <div className="border-b border-[var(--hack-border)] px-3 py-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">
            {"» Source Rankings"}
          </span>
          {meta.overriddenSources > 0 && (
            <span className="font-mono text-[9px] text-[var(--hack-amber)]">
              {meta.overriddenSources} overridden
            </span>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full font-mono text-[10px]">
            <thead className="sticky top-0 bg-black/80">
              <tr className="text-left text-[var(--hack-gray)]/60 border-b border-[var(--hack-border)]">
                <th className="px-2 py-1">Source</th>
                <th className="px-2 py-1">Tier</th>
                <th className="px-2 py-1">Weight</th>
                <th className="px-2 py-1">Findings</th>
                <th className="px-2 py-1">Contrib.</th>
              </tr>
            </thead>
            <tbody>
              {sourceRankings.map((s, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--hack-border)]/30 hover:bg-[var(--hack-green)]/5 cursor-pointer"
                  onClick={() => setExpandedSource(expandedSource === s.source ? null : s.source)}
                >
                  <td className="px-2 py-1 text-[var(--hack-green)] truncate max-w-[150px]">
                    {s.sourceLabel}
                    {s.overridden && <span className="text-[var(--hack-amber)] ml-1">⚡</span>}
                  </td>
                  <td className="px-2 py-1" style={{ color: TIER_COLORS[s.tier] }}>
                    T{s.tier}
                    {s.overridden && <span className="text-[var(--hack-gray)]/40 text-[8px] ml-1">(was T{s.defaultTier})</span>}
                  </td>
                  <td className="px-2 py-1 text-[var(--hack-cyan)]">{s.weight.toFixed(1)}</td>
                  <td className="px-2 py-1 text-[var(--hack-gray)]">{s.findingCount}</td>
                  <td className="px-2 py-1 text-[var(--hack-green)]">{s.credibilityContribution}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Weighted Findings */}
      {topFindings.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20">
          <div className="border-b border-[var(--hack-border)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
              {"» Top Credibility-Weighted Findings"}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-[var(--hack-border)]/30">
            {topFindings.map((f, i) => (
              <div key={i} className="px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="font-mono text-[8px] font-bold px-1.5 py-0.5 shrink-0"
                    style={{ color: TIER_COLORS[f.tier], border: `1px solid ${TIER_COLORS[f.tier]}40` }}
                  >
                    T{f.tier}
                  </div>
                  <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate flex-1">
                    {f.data.slice(0, 80)}...
                  </span>
                  <span className="font-mono text-[9px] text-[var(--hack-cyan)] shrink-0">
                    {(f.weightedConfidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 pl-7">
                  <span className="font-mono text-[8px] text-[var(--hack-gray)]/60">
                    {f.sourceLabel} · weight {f.weight.toFixed(1)} · orig {(f.originalConfidence * 100).toFixed(0)}%
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
