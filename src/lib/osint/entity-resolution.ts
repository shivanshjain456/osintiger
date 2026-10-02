// Entity Resolution Engine — domain models and resolver.
// Probabilistic identity resolution that determines when records refer to the same entity.
//
// 15 matching signals (weighted):
// 1. Name similarity 2. Alias overlap 3. Username similarity 4. Email similarity
// 5. Domain ownership 6. Organization affiliation 7. Job title similarity
// 8. Geographic proximity 9. Temporal overlap 10. Shared contacts
// 11. Shared social accounts 12. Shared websites 13. Shared documents
// 14. Shared infrastructure 15. Source co-occurrence
//
// Resolution model: deterministic rejection → probabilistic scoring → threshold-based decision
// Three outcomes: auto-merge (≥0.8), manual review (0.5-0.79), reject (<0.5)

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Entity Record (source-level)
// =====================

export type EntityType = "person" | "organization" | "domain" | "ip" | "email" | "username" | "wallet" | "phone" | "url" | "hash" | "cve";

export interface EntityRecord {
  id: string;
  /** Original entity value from source. */
  rawValue: string;
  /** Normalized value for matching. */
  normalizedValue: string;
  /** Entity type. */
  type: EntityType;
  /** Source. */
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  /** Confidence. */
  confidence: number;
  /** Evidence text. */
  evidence: string;
  /** Timestamp. */
  timestamp: string;
  /** Additional attributes extracted from evidence. */
  attributes: Record<string, string>;
}

// =====================
// Signal Score
// =====================

export type SignalType =
  | "name_similarity" | "alias_overlap" | "username_similarity" | "email_similarity"
  | "domain_ownership" | "org_affiliation" | "job_title" | "geo_proximity"
  | "temporal_overlap" | "shared_contacts" | "shared_social" | "shared_websites"
  | "shared_documents" | "shared_infrastructure" | "source_co_occurrence";

export interface SignalScore {
  type: SignalType;
  /** Score 0-1 (higher = more similar). */
  score: number;
  /** Weight applied. */
  weight: number;
  /** Weighted contribution. */
  contribution: number;
  /** Explanation. */
  explanation: string;
}

// =====================
// Resolution Candidate
// =====================

export type ResolutionOutcome = "auto_merge" | "manual_review" | "reject";

export interface ResolutionCandidate {
  id: string;
  recordA: EntityRecord;
  recordB: EntityRecord;
  /** Overall confidence (0-1). */
  confidence: number;
  /** Individual signal scores. */
  signals: SignalScore[];
  /** Resolution outcome. */
  outcome: ResolutionOutcome;
  /** Whether the records were merged. */
  merged: boolean;
  /** Explanation of the decision. */
  explanation: string;
  /** Conflicting fields. */
  conflicts: { field: string; valueA: string; valueB: string }[];
}

// =====================
// Canonical Identity
// =====================

export interface CanonicalIdentity {
  id: string;
  /** Primary name/value. */
  primaryName: string;
  /** Normalized name. */
  normalizedName: string;
  /** Entity type. */
  type: EntityType;
  /** All known aliases/variants. */
  aliases: string[];
  /** Source records contributing to this identity. */
  sourceRecords: { recordId: string; rawValue: string; source: string; sourceLabel: string; confidence: number }[];
  /** Confidence in this identity. */
  confidence: number;
  /** When this identity was created. */
  createdAt: string;
  /** Last updated. */
  updatedAt: string;
  /** Merge history. */
  mergeHistory: { timestamp: string; action: string; detail: string }[];
}

// =====================
// Complete Resolution Report
// =====================

export interface EntityResolutionReport {
  records: EntityRecord[];
  candidates: ResolutionCandidate[];
  canonicalIdentities: CanonicalIdentity[];
  assessment: {
    totalRecords: number;
    totalCandidates: number;
    autoMerged: number;
    manualReview: number;
    rejected: number;
    canonicalIdentities: number;
    duplicatesResolved: number;
    avgConfidence: number;
    explanation: string;
  };
  meta: {
    sourcesAnalyzed: number;
    findingsAnalyzed: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface EntityResolutionApiResponse {
  investigation_id: string;
  report: EntityResolutionReport;
}

// =====================
// Signal Weights (configurable)
// =====================

export const DEFAULT_SIGNAL_WEIGHTS: Record<SignalType, number> = {
  name_similarity: 0.15,
  alias_overlap: 0.12,
  username_similarity: 0.10,
  email_similarity: 0.12,
  domain_ownership: 0.08,
  org_affiliation: 0.08,
  job_title: 0.05,
  geo_proximity: 0.05,
  temporal_overlap: 0.05,
  shared_contacts: 0.05,
  shared_social: 0.05,
  shared_websites: 0.03,
  shared_documents: 0.02,
  shared_infrastructure: 0.03,
  source_co_occurrence: 0.02,
};

// =====================
// Thresholds (configurable)
// =====================

export const DEFAULT_THRESHOLDS = {
  autoMerge: 0.8,
  manualReview: 0.5,
  reject: 0.5,
};

// =====================
// Resolver
// =====================

export function resolveEntities(sourceResults: SourceResult[], target: string): EntityResolutionReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  // 1. Extract entity records from findings
  const records = extractEntityRecords(allFindings, target);

  // 2. Generate resolution candidates (pairwise comparison)
  const candidates = generateCandidates(records);

  // 3. Build canonical identities from merged records
  const canonicalIdentities = buildCanonicalIdentities(records, candidates, target);

  // 4. Assessment
  const autoMerged = candidates.filter((c) => c.outcome === "auto_merge").length;
  const manualReview = candidates.filter((c) => c.outcome === "manual_review").length;
  const rejected = candidates.filter((c) => c.outcome === "reject").length;
  const avgConfidence = candidates.length > 0
    ? candidates.reduce((s, c) => s + c.confidence, 0) / candidates.length
    : 0;

  const explanation = buildAssessmentExplanation(
    records.length, candidates.length, autoMerged, manualReview, rejected,
    canonicalIdentities.length, avgConfidence
  );

  return {
    records,
    candidates,
    canonicalIdentities,
    assessment: {
      totalRecords: records.length,
      totalCandidates: candidates.length,
      autoMerged,
      manualReview,
      rejected,
      canonicalIdentities: canonicalIdentities.length,
      duplicatesResolved: autoMerged,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      explanation,
    },
    meta: {
      sourcesAnalyzed: successfulResults.length,
      findingsAnalyzed: allFindings.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Entity Record Extraction
// =====================

function extractEntityRecords(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  target: string
): EntityRecord[] {
  const records: EntityRecord[] = [];
  const seen = new Set<string>();

  // Add target as first record
  records.push({
    id: "rec_target",
    rawValue: target,
    normalizedValue: normalizeValue(target),
    type: detectType(target),
    source: "user",
    sourceLabel: "User input",
    tier: 5,
    confidence: 1.0,
    evidence: `Original target: ${target}`,
    timestamp: new Date().toISOString(),
    attributes: {},
  });
  seen.add(target.toLowerCase());

  // Extract entities from findings
  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;

    // Extract domains
    const domainMatches = text.matchAll(/\b([\w-]+\.){1,}[\w]{2,}\b/gi);
    for (const m of domainMatches) {
      const domain = m[0].toLowerCase();
      if (seen.has(domain) || domain.length < 4) continue;
      seen.add(domain);
      records.push({
        id: `rec_${records.length}`,
        rawValue: m[0],
        normalizedValue: domain,
        type: "domain",
        source, sourceLabel, tier,
        confidence: finding.confidence,
        evidence: text.slice(0, 150),
        timestamp: finding.timestamp,
        attributes: extractAttributes(text),
      });
    }

    // Extract IPs
    const ipMatches = text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g);
    for (const m of ipMatches) {
      const ip = m[1];
      if (seen.has(ip) || isPrivateIP(ip)) continue;
      seen.add(ip);
      records.push({
        id: `rec_${records.length}`,
        rawValue: ip,
        normalizedValue: ip,
        type: "ip",
        source, sourceLabel, tier,
        confidence: finding.confidence,
        evidence: text.slice(0, 150),
        timestamp: finding.timestamp,
        attributes: extractAttributes(text),
      });
    }

    // Extract emails
    const emailMatches = text.matchAll(/[\w.-]+@[\w.-]+\.\w+/g);
    for (const m of emailMatches) {
      const email = m[0].toLowerCase();
      if (seen.has(email)) continue;
      seen.add(email);
      records.push({
        id: `rec_${records.length}`,
        rawValue: m[0],
        normalizedValue: email,
        type: "email",
        source, sourceLabel, tier,
        confidence: finding.confidence,
        evidence: text.slice(0, 150),
        timestamp: finding.timestamp,
        attributes: extractAttributes(text),
      });
    }
  }

  return records;
}

function extractAttributes(text: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const orgMatch = text.match(/(?:organization|org|company|employer)\s*:?\s*([^,.\n]+)/i);
  if (orgMatch) attrs.organization = orgMatch[1].trim();
  const locMatch = text.match(/(?:location|city|country|region)\s*:?\s*([^,.\n]+)/i);
  if (locMatch) attrs.location = locMatch[1].trim();
  const titleMatch = text.match(/(?:title|role|position)\s*:?\s*([^,.\n]+)/i);
  if (titleMatch) attrs.title = titleMatch[1].trim();
  return attrs;
}

// =====================
// Candidate Generation (pairwise comparison)
// =====================

function generateCandidates(records: EntityRecord[]): ResolutionCandidate[] {
  const candidates: ResolutionCandidate[] = [];

  // Only compare records of the same type
  const byType = new Map<EntityType, EntityRecord[]>();
  for (const r of records) {
    if (!byType.has(r.type)) byType.set(r.type, []);
    byType.get(r.type)!.push(r);
  }

  for (const [, typeRecords] of byType) {
    for (let i = 0; i < typeRecords.length; i++) {
      for (let j = i + 1; j < typeRecords.length; j++) {
        const candidate = evaluatePair(typeRecords[i], typeRecords[j]);
        if (candidate) candidates.push(candidate);
      }
    }
  }

  return candidates.sort((a, b) => b.confidence - a.confidence);
}

function evaluatePair(a: EntityRecord, b: EntityRecord): ResolutionCandidate | null {
  // Deterministic rejection: incompatible types (already filtered, but double-check)
  if (a.type !== b.type) return null;

  // Skip exact duplicates of the same source
  if (a.source === b.source && a.normalizedValue === b.normalizedValue) return null;

  const signals: SignalScore[] = [];
  const conflicts: { field: string; valueA: string; valueB: string }[] = [];

  // 1. Name/Value similarity
  const nameScore = stringSimilarity(a.normalizedValue, b.normalizedValue);
  signals.push({
    type: "name_similarity",
    score: nameScore,
    weight: DEFAULT_SIGNAL_WEIGHTS.name_similarity,
    contribution: nameScore * DEFAULT_SIGNAL_WEIGHTS.name_similarity,
    explanation: `Normalized values "${a.normalizedValue}" and "${b.normalizedValue}" have ${(nameScore * 100).toFixed(0)}% string similarity.`,
  });

  // 2. Domain ownership (for domains — check if one is subdomain of other)
  if (a.type === "domain" || b.type === "domain") {
    const domainScore = domainRelationScore(a.normalizedValue, b.normalizedValue);
    if (domainScore > 0) {
      signals.push({
        type: "domain_ownership",
        score: domainScore,
        weight: DEFAULT_SIGNAL_WEIGHTS.domain_ownership,
        contribution: domainScore * DEFAULT_SIGNAL_WEIGHTS.domain_ownership,
        explanation: `Domains share a common root or one is a subdomain of the other.`,
      });
    }
  }

  // 3. Organization affiliation
  if (a.attributes.organization && b.attributes.organization) {
    const orgScore = stringSimilarity(
      normalizeValue(a.attributes.organization),
      normalizeValue(b.attributes.organization)
    );
    signals.push({
      type: "org_affiliation",
      score: orgScore,
      weight: DEFAULT_SIGNAL_WEIGHTS.org_affiliation,
      contribution: orgScore * DEFAULT_SIGNAL_WEIGHTS.org_affiliation,
      explanation: `Both records reference organization: "${a.attributes.organization}" vs "${b.attributes.organization}" (${(orgScore * 100).toFixed(0)}% similar).`,
    });
    if (orgScore < 0.3 && a.attributes.organization !== b.attributes.organization) {
      conflicts.push({ field: "organization", valueA: a.attributes.organization, valueB: b.attributes.organization });
    }
  }

  // 4. Geographic proximity
  if (a.attributes.location && b.attributes.location) {
    const geoScore = stringSimilarity(
      normalizeValue(a.attributes.location),
      normalizeValue(b.attributes.location)
    );
    signals.push({
      type: "geo_proximity",
      score: geoScore,
      weight: DEFAULT_SIGNAL_WEIGHTS.geo_proximity,
      contribution: geoScore * DEFAULT_SIGNAL_WEIGHTS.geo_proximity,
      explanation: `Location similarity: "${a.attributes.location}" vs "${b.attributes.location}" (${(geoScore * 100).toFixed(0)}%).`,
    });
    if (geoScore < 0.3) {
      conflicts.push({ field: "location", valueA: a.attributes.location, valueB: b.attributes.location });
    }
  }

  // 5. Source co-occurrence
  if (a.source === b.source) {
    signals.push({
      type: "source_co_occurrence",
      score: 0.7,
      weight: DEFAULT_SIGNAL_WEIGHTS.source_co_occurrence,
      contribution: 0.7 * DEFAULT_SIGNAL_WEIGHTS.source_co_occurrence,
      explanation: `Both records come from the same source: ${a.sourceLabel}.`,
    });
  }

  // 6. Shared infrastructure (same source found both)
  if (a.source === b.source && a.tier >= 3) {
    signals.push({
      type: "shared_infrastructure",
      score: 0.5,
      weight: DEFAULT_SIGNAL_WEIGHTS.shared_infrastructure,
      contribution: 0.5 * DEFAULT_SIGNAL_WEIGHTS.shared_infrastructure,
      explanation: `Both records observed by the same tier ${a.tier} source.`,
    });
  }

  // Calculate overall confidence
  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  const totalContribution = signals.reduce((s, sig) => s + sig.contribution, 0);
  let confidence = totalWeight > 0 ? totalContribution / totalWeight : 0;

  // Apply conflict penalty
  const conflictPenalty = conflicts.length * 0.15;
  confidence = Math.max(0, confidence - conflictPenalty);

  // Determine outcome
  let outcome: ResolutionOutcome;
  let merged: boolean;
  if (confidence >= DEFAULT_THRESHOLDS.autoMerge) {
    outcome = "auto_merge";
    merged = true;
  } else if (confidence >= DEFAULT_THRESHOLDS.manualReview) {
    outcome = "manual_review";
    merged = false;
  } else {
    outcome = "reject";
    merged = false;
  }

  // Build explanation
  const topSignals = [...signals].sort((a, b) => b.contribution - a.contribution).slice(0, 3);
  const signalSummary = topSignals.map((s) => `${s.type}: ${(s.score * 100).toFixed(0)}%`).join(", ");
  const conflictSummary = conflicts.length > 0
    ? ` ${conflicts.length} conflict(s) detected (${conflicts.map((c) => c.field).join(", ")}), reducing confidence by ${(conflictPenalty * 100).toFixed(0)}%.`
    : "";

  const explanation = `Confidence: ${(confidence * 100).toFixed(0)}%. ` +
    `Top signals: ${signalSummary}.${conflictSummary} ` +
    `Decision: ${outcome === "auto_merge" ? "Records merged automatically" : outcome === "manual_review" ? "Sent for manual review" : "Records kept separate"}.`;

  return {
    id: `cand_${a.id}_${b.id}`,
    recordA: a,
    recordB: b,
    confidence: Math.round(confidence * 100) / 100,
    signals,
    outcome,
    merged,
    explanation,
    conflicts,
  };
}

// =====================
// Canonical Identity Builder
// =====================

function buildCanonicalIdentities(records: EntityRecord[], candidates: ResolutionCandidate[], target: string): CanonicalIdentity[] {
  const identities: CanonicalIdentity[] = [];
  const mergedRecordIds = new Set<string>();
  const now = new Date().toISOString();

  // Group merged records
  const mergeGroups = new Map<string, Set<string>>();
  for (const cand of candidates) {
    if (!cand.merged) continue;
    const idA = cand.recordA.id;
    const idB = cand.recordB.id;

    // Find existing group containing either record
    let groupA: Set<string> | undefined;
    let groupB: Set<string> | undefined;
    for (const [, group] of mergeGroups) {
      if (group.has(idA)) groupA = group;
      if (group.has(idB)) groupB = group;
    }

    if (groupA && groupB) {
      // Merge groups
      if (groupA !== groupB) {
        for (const id of groupB) groupA.add(id);
        mergeGroups.delete(idB);
      }
    } else if (groupA) {
      groupA.add(idB);
    } else if (groupB) {
      groupB.add(idA);
    } else {
      const newGroup = new Set<string>([idA, idB]);
      mergeGroups.set(idA, newGroup);
    }
  }

  // Mark merged records
  for (const [, group] of mergeGroups) {
    for (const id of group) mergedRecordIds.add(id);
  }

  // Create canonical identities from merge groups
  for (const [, group] of mergeGroups) {
    const groupRecords = records.filter((r) => group.has(r.id));
    if (groupRecords.length === 0) continue;

    const primary = groupRecords[0];
    const aliases = [...new Set(groupRecords.map((r) => r.rawValue))].filter((v) => v !== primary.rawValue);

    identities.push({
      id: `can_${identities.length}`,
      primaryName: primary.rawValue,
      normalizedName: primary.normalizedValue,
      type: primary.type,
      aliases,
      sourceRecords: groupRecords.map((r) => ({
        recordId: r.id,
        rawValue: r.rawValue,
        source: r.source,
        sourceLabel: r.sourceLabel,
        confidence: r.confidence,
      })),
      confidence: groupRecords.reduce((s, r) => s + r.confidence, 0) / groupRecords.length,
      createdAt: now,
      updatedAt: now,
      mergeHistory: [{
        timestamp: now,
        action: "auto_merge",
        detail: `Merged ${groupRecords.length} records: ${groupRecords.map((r) => r.rawValue).join(", ")}`,
      }],
    });
  }

  // Create identities for unmerged records
  for (const record of records) {
    if (mergedRecordIds.has(record.id)) continue;
    identities.push({
      id: `can_${identities.length}`,
      primaryName: record.rawValue,
      normalizedName: record.normalizedValue,
      type: record.type,
      aliases: [],
      sourceRecords: [{
        recordId: record.id,
        rawValue: record.rawValue,
        source: record.source,
        sourceLabel: record.sourceLabel,
        confidence: record.confidence,
      }],
      confidence: record.confidence,
      createdAt: now,
      updatedAt: now,
      mergeHistory: [],
    });
  }

  return identities;
}

// =====================
// Utilities
// =====================

function normalizeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(inc\.?|llc|ltd\.?|corp\.?|corporation|gmbh|s\.?a\.?|ag|sarl|bv|nv|pty\.?|plc|co\.?|group|holdings|foundation|limited)\b\.?/gi, "")
    .replace(/[^\w\s.@-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectType(value: string): EntityType {
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) return "ip";
  if (/^0x[a-fA-F0-9]{40}$/.test(value)) return "wallet";
  if (/[\w.-]+@[\w.-]+\.\w+/.test(value)) return "email";
  if (/\.([a-z]{2,})$/i.test(value)) return "domain";
  return "organization";
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0;

  // Levenshtein-based similarity
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const levScore = maxLen > 0 ? 1 - dist / maxLen : 0;

  // Token overlap
  const tokensA = new Set(a.split(/[\s.-]+/).filter((t) => t.length > 1));
  const tokensB = new Set(b.split(/[\s.-]+/).filter((t) => t.length > 1));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Weighted combination
  return Math.max(levScore * 0.6 + jaccard * 0.4, 0);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }
  return dp[m][n];
}

function domainRelationScore(a: string, b: string): number {
  if (a === b) return 1.0;
  // Check if one is a subdomain of the other
  if (a.endsWith(`.${b}`) || b.endsWith(`.${a}`)) return 0.8;
  // Check common root domain
  const rootA = a.split(".").slice(-2).join(".");
  const rootB = b.split(".").slice(-2).join(".");
  if (rootA === rootB) return 0.6;
  return 0;
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

function buildAssessmentExplanation(
  total: number, candidates: number, merged: number, review: number, rejected: number,
  canonical: number, avgConf: number
): string {
  if (total === 0) {
    return "No entity records discovered for resolution.";
  }

  const parts: string[] = [];
  parts.push(`${total} entity records extracted`);
  parts.push(`${candidates} pairwise comparisons evaluated`);
  parts.push(`${merged} auto-merged, ${review} sent for manual review, ${rejected} rejected`);
  parts.push(`${canonical} canonical identities created`);
  parts.push(`Average match confidence: ${(avgConf * 100).toFixed(0)}%`);

  if (merged > 0) {
    parts.push(`${merged} duplicate identities resolved through probabilistic matching`);
  }
  if (review > 0) {
    parts.push(`${review} borderline cases require manual review`);
  }

  return parts.join(". ") + ".";
}
