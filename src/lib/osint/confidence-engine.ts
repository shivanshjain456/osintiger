// Confidence Engine — domain models and calculator.
// Computes 6 dimensions of confidence for any investigation, with full explainability.
//
// Dimensions:
// 1. Source Confidence — weighted average of source reliability tiers
// 2. Cross-Source Confidence — how well sources corroborate each other
// 3. Freshness — how recent the evidence is
// 4. Verification — how many independent sources confirm findings
// 5. Trust Score — combination of source diversity + verification coverage
// 6. Overall Confidence — weighted combination of all dimensions
//
// Every score includes a human-readable explanation.

import type { SourceResult, NormalizedFinding, SourceConsulted } from "./types";
import type { SourceKey } from "./router";

// =====================
// Source Reliability Tiers
// =====================

/** Reliability tier for each source (1=lowest, 5=highest). */
export type ReliabilityTier = 1 | 2 | 3 | 4 | 5;

/**
 * Source reliability tiers based on established OSINT methodology.
 * Tier 5: Authoritative government/standards bodies (NVD, CISA, SEC EDGAR, OFAC, Interpol)
 * Tier 4: Major threat intelligence platforms (Shodan, AlienVault OTX, AbuseIPDB, VirusTotal)
 * Tier 3: Established data providers (crt.sh, DNS, BGP, GLEIF, OpenCorporates, Wikipedia)
 * Tier 2: Community/aggregate sources (HackerNews, DuckDuckGo, Reddit, Archive.org, Wayback)
 * Tier 1: Unverified/user-generated (web search results, social media)
 */
export const SOURCE_RELIABILITY: Record<string, ReliabilityTier> = {
  // Tier 5: Authoritative
  nvd: 5, cisa_kev: 5, edgar: 5, fec: 5, ofac: 5, interpol: 5, opensanctions: 5,
  cveorg: 5, osv: 5, usaspending: 5,
  // Tier 4: Major threat intel
  shodan_internetdb: 4, threat_intel: 4, otx: 4, abuseipdb: 4, virustotal: 4,
  greynoise: 4, threatfox: 4, urlhaus: 4, malwarebazaar: 4, hashrep: 4,
  shodan_cvedb: 4, epss: 4,
  // Tier 3: Established data
  crtsh: 3, doh: 3, dns_google: 3, openrdap: 3, bgpview: 3, peeringdb: 3,
  ipinfo: 3, ipquery: 3, ipwhois: 3, ipapico: 3, freeipapi: 3,
  gleif: 3, opencorporates: 3, icij: 3,
  wikipedia: 3, wikinews: 3, nominatim: 3, openmeteo: 3,
  emailmx: 3, mailcheck: 3, blockstream: 3, mempool: 3, blockchair: 3,
  etherscan: 3, httpheaders: 3, robotssitemap: 3, domainsdb: 3,
  gdelt: 3, googlenews: 3, binlist: 3, npm: 3, pypi: 3,
  // Tier 2: Community/aggregate
  hackernews: 2, duckduckgo: 2, reddit: 2, stackexchange: 2,
  wayback: 2, archiveorg: 2, cloudflare_trace: 2,
  github: 2, gitlab: 2, whatsmyname: 2, usernamesearch: 2,
  genderize: 2, agify: 2, nationalize: 2,
  bitcoinabuse: 2, urlscan: 2, phoneinfo: 2, gravatar: 2,
  // Tier 1: Unverified
  web_search: 1,
};

/** Get the reliability tier for a source key. */
export function getReliabilityTier(source: string): ReliabilityTier {
  return SOURCE_RELIABILITY[source] || 2;
}

/** Get a human-readable label for a reliability tier. */
export function getTierLabel(tier: ReliabilityTier): string {
  const labels: Record<ReliabilityTier, string> = {
    5: "Authoritative (government/standards)",
    4: "Major threat intelligence platform",
    3: "Established data provider",
    2: "Community/aggregate source",
    1: "Unverified/user-generated",
  };
  return labels[tier];
}

// =====================
// Confidence Dimensions
// =====================

/** A single dimension of confidence with score + explanation. */
export interface ConfidenceDimension {
  /** Dimension name. */
  name: string;
  /** Score 0-100. */
  score: number;
  /** Human-readable explanation of how the score was computed. */
  explanation: string;
  /** contributing factors (for detailed breakdown). */
  factors: { label: string; value: string; impact: number }[];
}

/** Source-level confidence detail. */
export interface SourceConfidenceDetail {
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  tierLabel: string;
  findingCount: number;
  status: string;
  contribution: number; // How much this source contributes to overall confidence
}

/** Verification detail for a key finding. */
export interface VerificationDetail {
  finding: string;
  findingIndex: number;
  confirmingSources: string[];
  confirmationCount: number;
  isVerified: boolean;
}

// =====================
// Complete Confidence Breakdown
// =====================

/** The complete confidence breakdown for an investigation. */
export interface ConfidenceBreakdown {
  /** Overall confidence score (0-100). */
  overall: number;
  /** Overall explanation. */
  overallExplanation: string;
  /** Individual dimensions. */
  dimensions: {
    sourceConfidence: ConfidenceDimension;
    crossSourceConfidence: ConfidenceDimension;
    freshness: ConfidenceDimension;
    verification: ConfidenceDimension;
    trustScore: ConfidenceDimension;
  };
  /** Per-source details. */
  sourceDetails: SourceConfidenceDetail[];
  /** Verification details for key findings. */
  verificationDetails: VerificationDetail[];
  /** Metadata. */
  meta: {
    totalSources: number;
    successfulSources: number;
    totalFindings: number;
    verifiedFindings: number;
    sourceDiversity: number;
    generatedAt: string;
  };
}

// =====================
// Calculator
// =====================

/**
 * Compute the complete confidence breakdown for an investigation.
 * @param sourceResults All source results from the investigation.
 * @param sourcesConsulted The sources consulted summary.
 * @param keyFindings Optional key findings for verification analysis.
 * @returns The complete confidence breakdown.
 */
export function computeConfidence(
  sourceResults: SourceResult[],
  sourcesConsulted: SourceConsulted[],
  keyFindings?: { claim: string; source: string; source_url: string; confidence: number }[]
): ConfidenceBreakdown {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const totalFindings = successfulResults.reduce((s, sr) => s + sr.findings.length, 0);

  // Compute each dimension
  const sourceConfidence = computeSourceConfidence(successfulResults);
  const crossSourceConfidence = computeCrossSourceConfidence(successfulResults);
  const freshness = computeFreshness(successfulResults);
  const verification = computeVerification(successfulResults, keyFindings);
  const trustScore = computeTrustScore(successfulResults, verification);

  // Overall = weighted combination
  const weights = {
    sourceConfidence: 0.25,
    crossSourceConfidence: 0.20,
    freshness: 0.15,
    verification: 0.25,
    trustScore: 0.15,
  };
  const overall = Math.round(
    sourceConfidence.score * weights.sourceConfidence +
    crossSourceConfidence.score * weights.crossSourceConfidence +
    freshness.score * weights.freshness +
    verification.score * weights.verification +
    trustScore.score * weights.trustScore
  );

  const overallExplanation = buildOverallExplanation(
    overall,
    sourceConfidence,
    crossSourceConfidence,
    freshness,
    verification,
    trustScore,
    successfulResults.length,
    totalFindings
  );

  const sourceDetails = buildSourceDetails(successfulResults);
  const verificationDetails = buildVerificationDetails(successfulResults, keyFindings);

  return {
    overall,
    overallExplanation,
    dimensions: {
      sourceConfidence,
      crossSourceConfidence,
      freshness,
      verification,
      trustScore,
    },
    sourceDetails,
    verificationDetails,
    meta: {
      totalSources: sourceResults.length,
      successfulSources: successfulResults.length,
      totalFindings,
      verifiedFindings: verificationDetails.filter((v) => v.isVerified).length,
      sourceDiversity: computeSourceDiversity(successfulResults),
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Dimension: Source Confidence
// =====================

function computeSourceConfidence(results: SourceResult[]): ConfidenceDimension {
  if (results.length === 0) {
    return {
      name: "Source Confidence",
      score: 0,
      explanation: "No successful sources to evaluate.",
      factors: [],
    };
  }

  const factors: { label: string; value: string; impact: number }[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const sr of results) {
    const tier = getReliabilityTier(sr.source);
    const weight = sr.findings.length; // More findings = more weight
    weightedSum += tier * 20 * weight; // Tier 5 = 100, Tier 1 = 20
    totalWeight += weight;

    factors.push({
      label: sr.source_label || sr.source,
      value: `Tier ${tier} (${getTierLabel(tier)}), ${sr.findings.length} findings`,
      impact: tier * 20,
    });
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

  const tierCounts: Record<ReliabilityTier, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const sr of results) {
    tierCounts[getReliabilityTier(sr.source)]++;
  }

  const explanation = `Based on ${results.length} successful sources: ` +
    `Tier 5 (authoritative): ${tierCounts[5]}, Tier 4 (threat intel): ${tierCounts[4]}, ` +
    `Tier 3 (established): ${tierCounts[3]}, Tier 2 (community): ${tierCounts[2]}, Tier 1 (unverified): ${tierCounts[1]}. ` +
    `Score is a finding-weighted average of source reliability tiers.`;

  return { name: "Source Confidence", score, explanation, factors };
}

// =====================
// Dimension: Cross-Source Confidence
// =====================

function computeCrossSourceConfidence(results: SourceResult[]): ConfidenceDimension {
  if (results.length < 2) {
    return {
      name: "Cross-Source Confidence",
      score: 0,
      explanation: "Only one source available — cross-source corroboration cannot be assessed.",
      factors: [],
    };
  }

  // Count entity overlaps: entities mentioned by multiple sources
  const entitySources = new Map<string, Set<string>>();
  for (const sr of results) {
    for (const f of sr.findings) {
      // Extract entities from finding text (simplified: use source_url as a proxy for entity)
      const key = f.source_url;
      if (!entitySources.has(key)) entitySources.set(key, new Set());
      entitySources.get(key)!.add(sr.source);
    }
  }

  let corroborated = 0;
  let total = 0;
  for (const [, sources] of entitySources) {
    total++;
    if (sources.size >= 2) corroborated++;
  }

  const corroborationRate = total > 0 ? corroborated / total : 0;
  const score = Math.round(corroborationRate * 100);

  const factors = [
    { label: "Sources compared", value: `${results.length}`, impact: Math.min(results.length * 10, 50) },
    { label: "Corroborated entities", value: `${corroborated}/${total}`, impact: Math.round(corroborationRate * 50) },
    { label: "Corroboration rate", value: `${(corroborationRate * 100).toFixed(1)}%`, impact: Math.round(corroborationRate * 50) },
  ];

  const explanation = `${corroborated} out of ${total} data points are corroborated by 2+ independent sources ` +
    `(${(corroborationRate * 100).toFixed(1)}% corroboration rate). ` +
    `Higher corroboration = higher confidence that findings are accurate.`;

  return { name: "Cross-Source Confidence", score, explanation, factors };
}

// =====================
// Dimension: Freshness
// =====================

function computeFreshness(results: SourceResult[]): ConfidenceDimension {
  const now = Date.now();
  const timestamps: number[] = [];

  for (const sr of results) {
    for (const f of sr.findings) {
      if (f.timestamp) {
        const ts = new Date(f.timestamp).getTime();
        if (!isNaN(ts)) timestamps.push(ts);
      }
    }
  }

  if (timestamps.length === 0) {
    return {
      name: "Freshness",
      score: 50,
      explanation: "No timestamps available — freshness cannot be assessed precisely. Defaulting to moderate score.",
      factors: [],
    };
  }

  const avgAge = timestamps.reduce((s, t) => s + (now - t), 0) / timestamps.length;
  const avgAgeHours = avgAge / (1000 * 60 * 60);
  const avgAgeDays = avgAgeHours / 24;

  // Score: 100 if < 1 hour old, 90 if < 1 day, 70 if < 7 days, 50 if < 30 days, 30 if < 90 days, 10 otherwise
  let score: number;
  let ageLabel: string;
  if (avgAgeHours < 1) { score = 100; ageLabel = "less than 1 hour"; }
  else if (avgAgeHours < 24) { score = 90; ageLabel = `${avgAgeHours.toFixed(1)} hours`; }
  else if (avgAgeDays < 7) { score = 70; ageLabel = `${avgAgeDays.toFixed(1)} days`; }
  else if (avgAgeDays < 30) { score = 50; ageLabel = `${avgAgeDays.toFixed(1)} days`; }
  else if (avgAgeDays < 90) { score = 30; ageLabel = `${avgAgeDays.toFixed(1)} days`; }
  else { score = 10; ageLabel = `${avgAgeDays.toFixed(0)} days`; }

  const factors = [
    { label: "Data points with timestamps", value: `${timestamps.length}`, impact: 20 },
    { label: "Average age", value: ageLabel, impact: score },
    { label: "Freshness tier", value: score >= 90 ? "Very fresh" : score >= 70 ? "Fresh" : score >= 50 ? "Moderate" : "Stale", impact: score },
  ];

  const explanation = `Average evidence age is ${ageLabel}. ` +
    `${timestamps.length} data points have timestamps. ` +
    `Fresher evidence is more likely to reflect current state.`;

  return { name: "Freshness", score, explanation, factors };
}

// =====================
// Dimension: Verification
// =====================

function computeVerification(
  results: SourceResult[],
  keyFindings?: { claim: string; source: string; source_url: string; confidence: number }[]
): ConfidenceDimension {
  if (!keyFindings || keyFindings.length === 0) {
    // Without key findings, assess based on source count
    const sourceCount = results.length;
    const score = Math.min(sourceCount * 15, 100);
    return {
      name: "Verification",
      score,
      explanation: `${sourceCount} sources contributed evidence. ` +
        `More independent sources = higher verification confidence. ` +
        `(Key finding verification not available — using source count as proxy.)`,
      factors: [
        { label: "Independent sources", value: `${sourceCount}`, impact: score },
      ],
    };
  }

  // Check how many key findings are confirmed by 2+ sources
  let verified = 0;
  const factors: { label: string; value: string; impact: number }[] = [];

  for (const kf of keyFindings) {
    const confirmingSources = new Set<string>();
    // Check if other sources mention similar content
    for (const sr of results) {
      if (sr.source === kf.source) continue; // Skip the same source
      for (const f of sr.findings) {
        // Simple text overlap check
        if (hasTextOverlap(kf.claim, f.data)) {
          confirmingSources.add(sr.source);
        }
      }
    }
    if (confirmingSources.size >= 1) verified++;

    factors.push({
      label: `Finding: ${kf.claim.slice(0, 50)}...`,
      value: `${confirmingSources.size + 1} source(s)`,
      impact: confirmingSources.size >= 1 ? 20 : 0,
    });
  }

  const verificationRate = keyFindings.length > 0 ? verified / keyFindings.length : 0;
  const score = Math.round(verificationRate * 100);

  const explanation = `${verified} out of ${keyFindings.length} key findings are confirmed by 2+ independent sources ` +
    `(${(verificationRate * 100).toFixed(0)}% verification rate). ` +
    `Verified findings are more likely to be accurate.`;

  return { name: "Verification", score, explanation, factors: factors.slice(0, 10) };
}

// =====================
// Dimension: Trust Score
// =====================

function computeTrustScore(
  results: SourceResult[],
  verification: ConfidenceDimension
): ConfidenceDimension {
  const sourceDiversity = computeSourceDiversity(results);
  const successRate = results.length > 0
    ? results.filter((r) => r.status === "success").length / results.length
    : 0;

  // Trust = combination of diversity + success rate + verification
  const diversityScore = Math.min(sourceDiversity * 10, 50);
  const successScore = successRate * 30;
  const verificationScore = verification.score * 0.2;
  const score = Math.round(diversityScore + successScore + verificationScore);

  const factors = [
    { label: "Source diversity", value: `${sourceDiversity} distinct source categories`, impact: Math.round(diversityScore) },
    { label: "Source success rate", value: `${(successRate * 100).toFixed(0)}%`, impact: Math.round(successScore) },
    { label: "Verification contribution", value: `${verification.score}/100`, impact: Math.round(verificationScore) },
  ];

  const explanation = `Trust combines source diversity (${sourceDiversity} categories), ` +
    `success rate (${(successRate * 100).toFixed(0)}%), and verification score (${verification.score}/100). ` +
    `Higher diversity + higher success + more verification = higher trust.`;

  return { name: "Trust Score", score, explanation, factors };
}

// =====================
// Helper Functions
// =====================

function computeSourceDiversity(results: SourceResult[]): number {
  // Count distinct source categories (based on source key prefix patterns)
  const categories = new Set<string>();
  for (const sr of results) {
    // Categorize by source type
    if (["crtsh", "doh", "dns_google", "openrdap", "domainsdb"].includes(sr.source)) categories.add("dns_cert");
    else if (["ipinfo", "ipquery", "ipwhois", "ipapico", "freeipapi", "bgpview", "peeringdb"].includes(sr.source)) categories.add("network");
    else if (["nvd", "osv", "cveorg", "cisa_kev", "shodan_cvedb", "epss"].includes(sr.source)) categories.add("vulnerability");
    else if (["otx", "abuseipdb", "virustotal", "greynoise", "threatfox", "urlhaus", "malwarebazaar"].includes(sr.source)) categories.add("threat_intel");
    else if (["ofac", "opensanctions", "interpol", "icij"].includes(sr.source)) categories.add("sanctions");
    else if (["edgar", "opencorporates", "gleif", "fec", "usaspending"].includes(sr.source)) categories.add("corporate");
    else if (["etherscan", "blockchair", "blockstream", "mempool", "bitcoinabuse"].includes(sr.source)) categories.add("crypto");
    else if (["github", "gitlab", "reddit", "wikipedia", "stackexchange", "whatsmyname"].includes(sr.source)) categories.add("social_dev");
    else if (["gdelt", "googlenews", "wikinews", "hackernews", "duckduckgo"].includes(sr.source)) categories.add("news_search");
    else if (["wayback", "archiveorg"].includes(sr.source)) categories.add("archive");
    else if (["mailcheck", "gravatar", "emailmx"].includes(sr.source)) categories.add("email");
    else categories.add("other");
  }
  return categories.size;
}

function hasTextOverlap(a: string, b: string): boolean {
  // Check if two strings share significant word overlap
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 4));
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap >= 2; // At least 2 significant words in common
}

function buildSourceDetails(results: SourceResult[]): SourceConfidenceDetail[] {
  const totalFindings = results.reduce((s, sr) => s + sr.findings.length, 0);
  return results
    .map((sr) => {
      const tier = getReliabilityTier(sr.source);
      const contribution = totalFindings > 0 ? (sr.findings.length / totalFindings) * 100 : 0;
      return {
        source: sr.source,
        sourceLabel: sr.source_label,
        tier,
        tierLabel: getTierLabel(tier),
        findingCount: sr.findings.length,
        status: sr.status,
        contribution: Math.round(contribution),
      };
    })
    .sort((a, b) => b.tier - a.tier || b.findingCount - a.findingCount);
}

function buildVerificationDetails(
  results: SourceResult[],
  keyFindings?: { claim: string; source: string; source_url: string; confidence: number }[]
): VerificationDetail[] {
  if (!keyFindings) return [];

  return keyFindings.map((kf, i) => {
    const confirmingSources: string[] = [kf.source];
    for (const sr of results) {
      if (sr.source === kf.source) continue;
      for (const f of sr.findings) {
        if (hasTextOverlap(kf.claim, f.data)) {
          if (!confirmingSources.includes(sr.source)) {
            confirmingSources.push(sr.source);
          }
          break;
        }
      }
    }
    return {
      finding: kf.claim,
      findingIndex: i,
      confirmingSources,
      confirmationCount: confirmingSources.length,
      isVerified: confirmingSources.length >= 2,
    };
  });
}

function buildOverallExplanation(
  overall: number,
  source: ConfidenceDimension,
  crossSource: ConfidenceDimension,
  freshness: ConfidenceDimension,
  verification: ConfidenceDimension,
  trust: ConfidenceDimension,
  sourceCount: number,
  findingCount: number
): string {
  const level = overall >= 80 ? "HIGH" : overall >= 60 ? "MODERATE" : overall >= 40 ? "LOW" : "VERY LOW";
  return `Overall confidence is ${level} (${overall}/100), computed as a weighted combination of: ` +
    `Source Confidence (${source.score}/100, weight 25%), ` +
    `Cross-Source Confidence (${crossSource.score}/100, weight 20%), ` +
    `Freshness (${freshness.score}/100, weight 15%), ` +
    `Verification (${verification.score}/100, weight 25%), ` +
    `Trust Score (${trust.score}/100, weight 15%). ` +
    `Based on ${sourceCount} successful sources and ${findingCount} findings.`;
}
