// Source Credibility Ranking — domain models and ranking service.
// Automatically classifies information sources into credibility tiers with configurable weighting.
//
// Features:
// 1. Automatic classification: 5 tiers based on source type
// 2. Configurable weighting: users can adjust tier weights and override individual source tiers
// 3. Evidence weighting: findings from higher-tier sources get more weight
// 4. Tier distribution: shows how many sources fall into each tier
// 5. Weighted evidence score: credibility-weighted score for the entire evidence base

import type { SourceResult, SourceConsulted, NormalizedFinding } from "./types";
import { SOURCE_RELIABILITY, getReliabilityTier, getTierLabel, type ReliabilityTier } from "./confidence-engine";

// =====================
// Configuration
// =====================

/** Configurable weights for each credibility tier (0-1). */
export interface CredibilityWeights {
  /** Tier 5 (Authoritative) weight. Default: 1.0 */
  tier5: number;
  /** Tier 4 (Threat Intel) weight. Default: 0.8 */
  tier4: number;
  /** Tier 3 (Established) weight. Default: 0.6 */
  tier3: number;
  /** Tier 2 (Community) weight. Default: 0.4 */
  tier2: number;
  /** Tier 1 (Unverified) weight. Default: 0.2 */
  tier1: number;
}

export const DEFAULT_CREDIBILITY_WEIGHTS: CredibilityWeights = {
  tier5: 1.0,
  tier4: 0.8,
  tier3: 0.6,
  tier2: 0.4,
  tier1: 0.2,
};

/** Per-source tier overrides (sourceKey → tier). */
export type TierOverrides = Record<string, ReliabilityTier>;

/** Complete credibility configuration. */
export interface CredibilityConfig {
  weights: CredibilityWeights;
  overrides: TierOverrides;
}

export const DEFAULT_CREDIBILITY_CONFIG: CredibilityConfig = {
  weights: DEFAULT_CREDIBILITY_WEIGHTS,
  overrides: {},
};

// =====================
// Ranking Models
// =====================

/** A single source's credibility ranking. */
export interface SourceRanking {
  source: string;
  sourceLabel: string;
  /** Effective tier (after overrides). */
  tier: ReliabilityTier;
  tierLabel: string;
  /** Whether this tier was overridden by config. */
  overridden: boolean;
  /** Default tier (before overrides). */
  defaultTier: ReliabilityTier;
  /** Weight (0-1) based on tier and config. */
  weight: number;
  /** Number of findings from this source. */
  findingCount: number;
  /** Status of the source query. */
  status: string;
  /** Weighted finding count (findings × weight). */
  weightedFindings: number;
  /** Contribution to overall credibility (percentage). */
  credibilityContribution: number;
}

/** Tier distribution summary. */
export interface TierDistribution {
  tier: ReliabilityTier;
  label: string;
  sourceCount: number;
  findingCount: number;
  weight: number;
  totalWeightedFindings: number;
  percentage: number;
}

/** Weighted evidence assessment. */
export interface WeightedEvidenceAssessment {
  /** Overall weighted score (0-100). */
  weightedScore: number;
  /** Total findings across all sources. */
  totalFindings: number;
  /** Total weighted findings. */
  totalWeightedFindings: number;
  /** Average weight across all findings. */
  averageWeight: number;
  /** Explanation of the weighted score. */
  explanation: string;
}

/** Finding with its source's credibility weight applied. */
export interface WeightedFinding {
  data: string;
  sourceUrl: string;
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  weight: number;
  originalConfidence: number;
  /** Adjusted confidence = original × weight. */
  weightedConfidence: number;
}

// =====================
// Complete Credibility Ranking
// =====================

/** The complete credibility ranking for an investigation. */
export interface CredibilityRanking {
  /** The configuration used for this ranking. */
  config: CredibilityConfig;
  /** Per-source rankings (sorted by tier desc, then findings desc). */
  sourceRankings: SourceRanking[];
  /** Tier distribution. */
  tierDistribution: TierDistribution[];
  /** Weighted evidence assessment. */
  weightedAssessment: WeightedEvidenceAssessment;
  /** Top weighted findings (highest credibility). */
  topFindings: WeightedFinding[];
  /** Metadata. */
  meta: {
    totalSources: number;
    successfulSources: number;
    totalFindings: number;
    overriddenSources: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface CredibilityApiResponse {
  investigation_id: string;
  ranking: CredibilityRanking;
}

// =====================
// Ranking Calculator
// =====================

/**
 * Compute the complete credibility ranking for an investigation.
 * @param sourceResults All source results.
 * @param config Credibility configuration (weights + overrides).
 * @param maxTopFindings Maximum number of top findings to return.
 * @returns The complete credibility ranking.
 */
export function computeCredibilityRanking(
  sourceResults: SourceResult[],
  config: CredibilityConfig = DEFAULT_CREDIBILITY_CONFIG,
  maxTopFindings: number = 15
): CredibilityRanking {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const totalFindings = successfulResults.reduce((s, sr) => s + sr.findings.length, 0);

  // Build source rankings
  const sourceRankings: SourceRanking[] = [];
  let totalWeightedFindings = 0;

  for (const sr of sourceResults) {
    const defaultTier = getReliabilityTier(sr.source);
    const overriddenTier = config.overrides[sr.source];
    const effectiveTier = overriddenTier || defaultTier;
    const overridden = overriddenTier !== undefined && overriddenTier !== defaultTier;
    const weight = getTierWeight(effectiveTier, config.weights);
    const findingCount = sr.status === "success" ? sr.findings.length : 0;
    const weightedFindings = findingCount * weight;

    totalWeightedFindings += weightedFindings;

    sourceRankings.push({
      source: sr.source,
      sourceLabel: sr.source_label,
      tier: effectiveTier,
      tierLabel: getTierLabel(effectiveTier),
      overridden,
      defaultTier,
      weight,
      findingCount,
      status: sr.status,
      weightedFindings,
      credibilityContribution: 0, // Will be calculated below
    });
  }

  // Calculate credibility contribution percentages
  for (const ranking of sourceRankings) {
    ranking.credibilityContribution = totalWeightedFindings > 0
      ? Math.round((ranking.weightedFindings / totalWeightedFindings) * 100)
      : 0;
  }

  // Sort by tier desc, then findings desc
  sourceRankings.sort((a, b) => b.tier - a.tier || b.findingCount - a.findingCount);

  // Build tier distribution
  const tierDistribution = buildTierDistribution(sourceRankings, config.weights);

  // Build weighted assessment
  const weightedAssessment = buildWeightedAssessment(
    sourceRankings,
    totalFindings,
    totalWeightedFindings,
    config.weights
  );

  // Build top findings
  const topFindings = buildTopFindings(successfulResults, config, maxTopFindings);

  const overriddenCount = sourceRankings.filter((r) => r.overridden).length;

  return {
    config,
    sourceRankings,
    tierDistribution,
    weightedAssessment,
    topFindings,
    meta: {
      totalSources: sourceResults.length,
      successfulSources: successfulResults.length,
      totalFindings,
      overriddenSources: overriddenCount,
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Helper Functions
// =====================

/** Get the weight for a given tier from the config. */
function getTierWeight(tier: ReliabilityTier, weights: CredibilityWeights): number {
  switch (tier) {
    case 5: return weights.tier5;
    case 4: return weights.tier4;
    case 3: return weights.tier3;
    case 2: return weights.tier2;
    case 1: return weights.tier1;
    default: return 0.2;
  }
}

/** Build tier distribution summary. */
function buildTierDistribution(
  rankings: SourceRanking[],
  weights: CredibilityWeights
): TierDistribution[] {
  const tiers: ReliabilityTier[] = [5, 4, 3, 2, 1];
  const totalWeighted = rankings.reduce((s, r) => s + r.weightedFindings, 0);

  return tiers.map((tier) => {
    const tierRankings = rankings.filter((r) => r.tier === tier);
    const findingCount = tierRankings.reduce((s, r) => s + r.findingCount, 0);
    const tierWeightedFindings = tierRankings.reduce((s, r) => s + r.weightedFindings, 0);
    const weight = getTierWeight(tier, weights);

    return {
      tier,
      label: getTierLabel(tier),
      sourceCount: tierRankings.length,
      findingCount,
      weight,
      totalWeightedFindings: tierWeightedFindings,
      percentage: totalWeighted > 0 ? Math.round((tierWeightedFindings / totalWeighted) * 100) : 0,
    };
  }).filter((d) => d.sourceCount > 0);
}

/** Build the weighted evidence assessment. */
function buildWeightedAssessment(
  rankings: SourceRanking[],
  totalFindings: number,
  totalWeightedFindings: number,
  weights: CredibilityWeights
): WeightedEvidenceAssessment {
  const averageWeight = totalFindings > 0 ? totalWeightedFindings / totalFindings : 0;
  const weightedScore = Math.round(averageWeight * 100);

  // Build explanation
  const tierBreakdown = [5, 4, 3, 2, 1]
    .map((tier) => {
      const tierRankings = rankings.filter((r) => r.tier === tier);
      if (tierRankings.length === 0) return null;
      const findings = tierRankings.reduce((s, r) => s + r.findingCount, 0);
      return `T${tier} (${getTierLabel(tier as ReliabilityTier)}): ${tierRankings.length} sources, ${findings} findings, weight ${getTierWeight(tier as ReliabilityTier, weights)}`;
    })
    .filter(Boolean)
    .join("; ");

  const explanation = `Weighted evidence score is ${weightedScore}/100 (average weight: ${averageWeight.toFixed(2)}). ` +
    `Tier distribution: ${tierBreakdown}. ` +
    `Total findings: ${totalFindings}, weighted findings: ${totalWeightedFindings.toFixed(1)}. ` +
    `Higher-tier sources contribute more to the overall credibility assessment.`;

  return {
    weightedScore,
    totalFindings,
    totalWeightedFindings,
    averageWeight,
    explanation,
  };
}

/** Build top weighted findings (highest credibility first). */
function buildTopFindings(
  results: SourceResult[],
  config: CredibilityConfig,
  maxFindings: number
): WeightedFinding[] {
  const allFindings: WeightedFinding[] = [];

  for (const sr of results) {
    if (sr.status !== "success") continue;
    const tier = config.overrides[sr.source] || getReliabilityTier(sr.source);
    const weight = getTierWeight(tier, config.weights);

    for (const f of sr.findings) {
      allFindings.push({
        data: f.data,
        sourceUrl: f.source_url,
        source: sr.source,
        sourceLabel: sr.source_label,
        tier,
        weight,
        originalConfidence: f.confidence,
        weightedConfidence: f.confidence * weight,
      });
    }
  }

  // Sort by weighted confidence desc
  allFindings.sort((a, b) => b.weightedConfidence - a.weightedConfidence);

  return allFindings.slice(0, maxFindings);
}

// =====================
// Default Tier Descriptions (for UI)
// =====================

export const TIER_DESCRIPTIONS: Record<ReliabilityTier, { label: string; description: string; color: string; examples: string[] }> = {
  5: {
    label: "Authoritative",
    description: "Government agencies, standards bodies, and official registries. Highest reliability.",
    color: "#00ff41",
    examples: ["NVD", "CISA KEV", "SEC EDGAR", "OFAC", "Interpol", "OpenSanctions"],
  },
  4: {
    label: "Threat Intelligence",
    description: "Major threat intelligence platforms with curated, verified data.",
    color: "#00ffff",
    examples: ["Shodan", "AlienVault OTX", "AbuseIPDB", "VirusTotal", "GreyNoise", "ThreatFox"],
  },
  3: {
    label: "Established Data",
    description: "Established data providers with reliable but not authoritative data.",
    color: "#ffaa00",
    examples: ["crt.sh", "DNS (Google/Cloudflare)", "BGPView", "GLEIF", "OpenCorporates", "Wikipedia"],
  },
  2: {
    label: "Community",
    description: "Community-maintained or aggregate sources. Useful but require verification.",
    color: "#ff8866",
    examples: ["HackerNews", "DuckDuckGo", "Reddit", "Archive.org", "GitHub", "Wayback Machine"],
  },
  1: {
    label: "Unverified",
    description: "User-generated or algorithmic results. Lowest reliability — always cross-verify.",
    color: "#ff0040",
    examples: ["Web Search"],
  },
};
