// Contradiction Detection Engine — domain models and detector.
// Automatically identifies conflicting evidence across sources.
//
// Detection methods:
// 1. Entity-level conflicts: same entity described differently (different IPs, different names)
// 2. Value-level conflicts: different attribute values for the same entity
// 3. Semantic conflicts: findings that make contradictory claims about the same topic
// 4. Negation detection: findings that explicitly negate others ("not", "no", "denied")
//
// Each contradiction includes: topic, claim A + source A, claim B + source B,
// confidence assessment, and recommended resolution.

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, getTierLabel, type ReliabilityTier } from "./confidence-engine";

// =====================
// Conflict Types
// =====================

/** The type of contradiction detected. */
export type ConflictType =
  | "entity_value"      // Same entity has different values (e.g., different IPs for a domain)
  | "attribute_conflict" // Different attributes (e.g., different registrant names)
  | "semantic_conflict"  // Contradictory claims about the same topic
  | "negation_conflict"  // One finding negates another
  | "temporal_conflict"  // Conflicting timestamps
  | "status_conflict";   // Conflicting status (e.g., "malicious" vs "benign")

/** Severity of a contradiction. */
export type ConflictSeverity = "low" | "medium" | "high" | "critical";

// =====================
// Contradiction Entry
// =====================

/** A single detected contradiction between two findings. */
export interface ContradictionEntry {
  /** Unique ID for this contradiction. */
  id: string;
  /** The type of conflict. */
  type: ConflictType;
  /** Severity level. */
  severity: ConflictSeverity;
  /** The topic being contradicted (e.g., "IP address for example.com"). */
  topic: string;
  /** The entity or value in question. */
  entity: string;
  /** Claim A (from source A). */
  claimA: string;
  /** Source A label. */
  sourceA: string;
  /** Source A tier. */
  tierA: ReliabilityTier;
  /** Source A URL. */
  urlA: string;
  /** Claim B (from source B). */
  claimB: string;
  /** Source B label. */
  sourceB: string;
  /** Source B tier. */
  tierB: ReliabilityTier;
  /** Source B URL. */
  urlB: string;
  /** The conflicting values extracted. */
  valueA: string;
  valueB: string;
  /** Confidence in this being a real contradiction (0-1). */
  contradictionConfidence: number;
  /** Recommended resolution. */
  resolution: ResolutionRecommendation;
  /** Which source is more likely correct (based on tier + corroboration). */
  preferredSource: "A" | "B" | "neither" | "inconclusive";
  /** Explanation of why this is a contradiction. */
  explanation: string;
}

/** Resolution recommendation for a contradiction. */
export interface ResolutionRecommendation {
  /** The recommended action. */
  action: string;
  /** The reasoning behind the recommendation. */
  reasoning: string;
  /** Whether manual verification is needed. */
  requiresManualVerification: boolean;
}

// =====================
// Contradiction Report
// =====================

/** The complete contradiction report for an investigation. */
export interface ContradictionReport {
  /** All detected contradictions. */
  contradictions: ContradictionEntry[];
  /** Summary statistics. */
  summary: {
    totalContradictions: number;
    byType: Record<ConflictType, number>;
    bySeverity: Record<ConflictSeverity, number>;
    resolved: number;
    unresolved: number;
  };
  /** Overall conflict assessment. */
  assessment: {
    /** Overall conflict level (0-100, higher = more conflicts). */
    conflictLevel: number;
    /** Whether the evidence base has significant contradictions. */
    hasSignificantConflicts: boolean;
    /** Explanation of the assessment. */
    explanation: string;
  };
  /** Metadata. */
  meta: {
    sourcesCompared: number;
    findingsAnalyzed: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface ContradictionApiResponse {
  investigation_id: string;
  report: ContradictionReport;
}

// =====================
// Detector
// =====================

/**
 * Detect contradictions in an investigation's source results.
 * @param sourceResults All source results from the investigation.
 * @returns The complete contradiction report.
 */
export function detectContradictions(sourceResults: SourceResult[]): ContradictionReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; sourceUrl: string; tier: ReliabilityTier }[] = [];

  // Collect all findings with source metadata
  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({
        finding: f,
        source: sr.source,
        sourceLabel: sr.source_label,
        sourceUrl: f.source_url,
        tier,
      });
    }
  }

  const contradictions: ContradictionEntry[] = [];

  // 1. Entity value conflicts: same entity, different values
  contradictions.push(...detectEntityValueConflicts(allFindings));

  // 2. Status conflicts: malicious vs benign
  contradictions.push(...detectStatusConflicts(allFindings));

  // 3. Negation conflicts: one finding negates another
  contradictions.push(...detectNegationConflicts(allFindings));

  // 4. Semantic conflicts: similar topics, contradictory claims
  contradictions.push(...detectSemanticConflicts(allFindings));

  // Deduplicate contradictions (same pair of findings)
  const seen = new Set<string>();
  const uniqueContradictions = contradictions.filter((c) => {
    const key = [c.claimA.slice(0, 50), c.claimB.slice(0, 50)].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Build summary
  const byType = {} as Record<ConflictType, number>;
  const bySeverity = {} as Record<ConflictSeverity, number>;
  for (const c of uniqueContradictions) {
    byType[c.type] = (byType[c.type] || 0) + 1;
    bySeverity[c.severity] = (bySeverity[c.severity] || 0) + 1;
  }

  const resolved = uniqueContradictions.filter((c) => c.preferredSource !== "inconclusive").length;
  const unresolved = uniqueContradictions.length - resolved;

  const conflictLevel = Math.min(100, uniqueContradictions.length * 15);
  const hasSignificantConflicts = uniqueContradictions.length >= 3 || (bySeverity.critical || 0) > 0;

  const explanation = buildAssessmentExplanation(
    uniqueContradictions.length,
    byType,
    bySeverity,
    conflictLevel,
    hasSignificantConflicts
  );

  return {
    contradictions: uniqueContradictions.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    summary: {
      totalContradictions: uniqueContradictions.length,
      byType,
      bySeverity,
      resolved,
      unresolved,
    },
    assessment: {
      conflictLevel,
      hasSignificantConflicts,
      explanation,
    },
    meta: {
      sourcesCompared: successfulResults.length,
      findingsAnalyzed: allFindings.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Detection: Entity Value Conflicts
// =====================

/** Extract entity-value pairs from finding text (e.g., "domain X resolves to IP Y"). */
interface EntityValue {
  entity: string;
  attribute: string;
  value: string;
  findingText: string;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: ReliabilityTier;
  confidence: number;
}

function detectEntityValueConflicts(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; sourceUrl: string; tier: ReliabilityTier }[]
): ContradictionEntry[] {
  const contradictions: ContradictionEntry[] = [];

  // Extract entity-value pairs
  const entityValues = extractEntityValues(findings);
  if (entityValues.length === 0) return contradictions;

  // Group by entity + attribute
  const groups = new Map<string, EntityValue[]>();
  for (const ev of entityValues) {
    const key = `${ev.entity.toLowerCase()}|${ev.attribute.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ev);
  }

  // Find groups with conflicting values
  for (const [key, values] of groups) {
    const uniqueValues = new Set(values.map((v) => v.value.toLowerCase()));
    if (uniqueValues.size < 2) continue; // No conflict

    const [entity, attribute] = key.split("|");

    // Take the first two conflicting values
    const v1 = values[0];
    const v2 = values.find((v) => v.value.toLowerCase() !== v1.value.toLowerCase()) || values[1];
    if (!v2) continue;

    const preferredSource = determinePreferredSource(v1, v2);
    const severity = determineSeverity(v1.tier, v2.tier, attribute);

    contradictions.push({
      id: `contr_${contradictions.length + 1}`,
      type: "entity_value",
      severity,
      topic: `${attribute} for ${entity}`,
      entity,
      claimA: v1.findingText,
      sourceA: v1.sourceLabel,
      tierA: v1.tier,
      urlA: v1.sourceUrl,
      claimB: v2.findingText,
      sourceB: v2.sourceLabel,
      tierB: v2.tier,
      urlB: v2.sourceUrl,
      valueA: v1.value,
      valueB: v2.value,
      contradictionConfidence: 0.8,
      resolution: buildResolution(v1, v2, preferredSource, attribute),
      preferredSource,
      explanation: `Source "${v1.sourceLabel}" reports ${attribute} "${v1.value}" for ${entity}, while source "${v2.sourceLabel}" reports "${v2.value}". These values conflict.`,
    });
  }

  return contradictions;
}

/** Extract entity-value pairs from finding text using pattern matching. */
function extractEntityValues(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; sourceUrl: string; tier: ReliabilityTier }[]
): EntityValue[] {
  const result: EntityValue[] = [];

  // Patterns: "X resolves to Y", "X is located in Y", "X registered by Y", "X has A record Y"
  const patterns: { regex: RegExp; entityGroup: number; attribute: string; valueGroup: number }[] = [
    { regex: /([\w.-]+)\s+(?:resolves?\s+to|points?\s+to)\s+([\d.a-f:]+)/i, entityGroup: 1, attribute: "IP address", valueGroup: 2 },
    { regex: /([\w.-]+)\s+(?:is\s+located\s+in|location:?)\s+([^,.\n]+)/i, entityGroup: 1, attribute: "location", valueGroup: 2 },
    { regex: /([\w.-]+)\s+(?:registered\s+by|registrar:?)\s+([^,.\n]+)/i, entityGroup: 1, attribute: "registrar", valueGroup: 2 },
    { regex: /([\w.-]+)\s+(?:is\s+hosted\s+(?:on|by|at))\s+([^,.\n]+)/i, entityGroup: 1, attribute: "hosting", valueGroup: 2 },
    { regex: /([\w.-]+)\s+(?:is\s+owned\s+by|owner:?)\s+([^,.\n]+)/i, entityGroup: 1, attribute: "owner", valueGroup: 2 },
  ];

  for (const { finding, source, sourceLabel, sourceUrl, tier } of findings) {
    const text = finding.data;
    for (const p of patterns) {
      const match = text.match(p.regex);
      if (match) {
        result.push({
          entity: match[p.entityGroup].trim(),
          attribute: p.attribute,
          value: match[p.valueGroup].trim(),
          findingText: text,
          source,
          sourceLabel,
          sourceUrl,
          tier,
          confidence: finding.confidence,
        });
      }
    }
  }

  return result;
}

// =====================
// Detection: Status Conflicts
// =====================

function detectStatusConflicts(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; sourceUrl: string; tier: ReliabilityTier }[]
): ContradictionEntry[] {
  const contradictions: ContradictionEntry[] = [];

  // Find findings that classify an entity as malicious vs benign
  const maliciousFindings = findings.filter((f) =>
    /malicious|harmful|dangerous|threat|attack|malware|phishing|scam/i.test(f.finding.data) &&
    !/not\s+(?:malicious|harmful|dangerous)/i.test(f.finding.data)
  );
  const benignFindings = findings.filter((f) =>
    /benign|safe|legitimate|clean|not\s+(?:malicious|harmful|dangerous)/i.test(f.finding.data)
  );

  // Check for pairs that reference the same entity
  for (const mal of maliciousFindings) {
    for (const ben of benignFindings) {
      // Check if they reference the same entity (by finding overlap in entity mentions)
      const malEntities = extractEntityMentions(mal.finding.data);
      const benEntities = extractEntityMentions(ben.finding.data);
      const overlap = malEntities.filter((e) => benEntities.includes(e));

      if (overlap.length > 0) {
        const entity = overlap[0];
        const preferredSource = determinePreferredSource({ tier: mal.tier, confidence: mal.finding.confidence }, { tier: ben.tier, confidence: ben.finding.confidence });
        contradictions.push({
          id: `contr_${contradictions.length + 1}`,
          type: "status_conflict",
          severity: "high",
          topic: `Threat status of ${entity}`,
          entity,
          claimA: mal.finding.data.slice(0, 200),
          sourceA: mal.sourceLabel,
          tierA: mal.tier,
          urlA: mal.sourceUrl,
          claimB: ben.finding.data.slice(0, 200),
          sourceB: ben.sourceLabel,
          tierB: ben.tier,
          urlB: ben.sourceUrl,
          valueA: "malicious/threat",
          valueB: "benign/safe",
          contradictionConfidence: 0.85,
          resolution: buildStatusResolution(mal, ben, preferredSource),
          preferredSource,
          explanation: `Source "${mal.sourceLabel}" identifies ${entity} as malicious/threatening, while source "${ben.sourceLabel}" identifies it as benign/safe. This is a direct status conflict.`,
        });
        break; // Only one contradiction per malicious finding
      }
    }
  }

  return contradictions;
}

// =====================
// Detection: Negation Conflicts
// =====================

function detectNegationConflicts(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; sourceUrl: string; tier: ReliabilityTier }[]
): ContradictionEntry[] {
  const contradictions: ContradictionEntry[] = [];

  // Find findings with negation phrases
  const negatedFindings = findings.filter((f) =>
    /\b(?:not\s+found|no\s+(?:data|results|records)|not\s+(?:listed|present|detected)|not\s+in\s+database|none\s+found)\b/i.test(f.finding.data)
  );

  // Find findings that make positive claims about the same entity
  const positiveFindings = findings.filter((f) =>
    !/\b(?:not\s+found|no\s+(?:data|results|records)|not\s+(?:listed|present|detected)|not\s+in\s+database|none\s+found)\b/i.test(f.finding.data) &&
    /\b(?:found|detected|listed|present|identified|discovered)\b/i.test(f.finding.data)
  );

  // Check for entity overlap
  for (const neg of negatedFindings) {
    for (const pos of positiveFindings) {
      const negEntities = extractEntityMentions(neg.finding.data);
      const posEntities = extractEntityMentions(pos.finding.data);
      const overlap = negEntities.filter((e) => posEntities.includes(e));

      if (overlap.length > 0 && neg.source !== pos.source) {
        const entity = overlap[0];
        const preferredSource = determinePreferredSource({ tier: pos.tier, confidence: pos.finding.confidence }, { tier: neg.tier, confidence: neg.finding.confidence }); // Positive finding preferred if from higher tier
        contradictions.push({
          id: `contr_${contradictions.length + 1}`,
          type: "negation_conflict",
          severity: "medium",
          topic: `Existence of ${entity} in database`,
          entity,
          claimA: pos.finding.data.slice(0, 200),
          sourceA: pos.sourceLabel,
          tierA: pos.tier,
          urlA: pos.sourceUrl,
          claimB: neg.finding.data.slice(0, 200),
          sourceB: neg.sourceLabel,
          tierB: neg.tier,
          urlB: neg.sourceUrl,
          valueA: "found/present",
          valueB: "not found/absent",
          contradictionConfidence: 0.7,
          resolution: buildNegationResolution(pos, neg, preferredSource),
          preferredSource,
          explanation: `Source "${pos.sourceLabel}" reports ${entity} as found/present, while source "${neg.sourceLabel}" reports it as not found. This may be due to timing differences or different detection methods.`,
        });
        break;
      }
    }
  }

  return contradictions;
}

// =====================
// Detection: Semantic Conflicts
// =====================

function detectSemanticConflicts(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; sourceUrl: string; tier: ReliabilityTier }[]
): ContradictionEntry[] {
  const contradictions: ContradictionEntry[] = [];

  // Group findings by entity mentions
  const entityFindings = new Map<string, typeof findings>();
  for (const f of findings) {
    const entities = extractEntityMentions(f.finding.data);
    for (const e of entities) {
      if (!entityFindings.has(e)) entityFindings.set(e, []);
      entityFindings.get(e)!.push(f);
    }
  }

  // For each entity, check if findings from different sources make contradictory claims
  for (const [entity, entityFinds] of entityFindings) {
    if (entityFinds.length < 2) continue;

    // Compare pairs of findings
    for (let i = 0; i < entityFinds.length; i++) {
      for (let j = i + 1; j < entityFinds.length; j++) {
        const f1 = entityFinds[i];
        const f2 = entityFinds[j];
        if (f1.source === f2.source) continue; // Skip same source

        // Check for contradictory sentiment/claims
        const sentiment1 = analyzeSentiment(f1.finding.data);
        const sentiment2 = analyzeSentiment(f2.finding.data);

        if (sentiment1 !== "neutral" && sentiment2 !== "neutral" && sentiment1 !== sentiment2) {
          const preferredSource = determinePreferredSource({ tier: f1.tier, confidence: f1.finding.confidence }, { tier: f2.tier, confidence: f2.finding.confidence });
          contradictions.push({
            id: `contr_${contradictions.length + 1}`,
            type: "semantic_conflict",
            severity: "medium",
            topic: `Assessment of ${entity}`,
            entity,
            claimA: f1.finding.data.slice(0, 200),
            sourceA: f1.sourceLabel,
            tierA: f1.tier,
            urlA: f1.sourceUrl,
            claimB: f2.finding.data.slice(0, 200),
            sourceB: f2.sourceLabel,
            tierB: f2.tier,
            urlB: f2.sourceUrl,
            valueA: sentiment1,
            valueB: sentiment2,
            contradictionConfidence: 0.6,
            resolution: {
              action: `Compare the full context of both findings. Prefer the source with higher reliability tier.`,
              reasoning: `Source A (tier ${f1.tier}) has ${f1.tier >= f2.tier ? "higher or equal" : "lower"} reliability than source B (tier ${f2.tier}).`,
              requiresManualVerification: true,
            },
            preferredSource,
            explanation: `Sources disagree on the assessment of ${entity}: source "${f1.sourceLabel}" has a ${sentiment1} tone, while source "${f2.sourceLabel}" has a ${sentiment2} tone.`,
          });
          break;
        }
      }
    }
  }

  return contradictions;
}

// =====================
// Helper Functions
// =====================

/** Extract entity mentions (domains, IPs, emails) from text. */
function extractEntityMentions(text: string): string[] {
  const entities: string[] = [];
  // IPs
  const ipMatches = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
  if (ipMatches) entities.push(...ipMatches);
  // Domains
  const domainMatches = text.match(/\b[\w-]+(\.[\w-]+)+\b/g);
  if (domainMatches) {
    for (const d of domainMatches) {
      if (!entities.includes(d) && !d.match(/^\d/)) entities.push(d);
    }
  }
  // Emails
  const emailMatches = text.match(/[\w.-]+@[\w.-]+\.\w+/g);
  if (emailMatches) entities.push(...emailMatches);
  return entities;
}

/** Analyze sentiment of finding text (positive/negative/neutral). */
function analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
  const negativeWords = /\b(malicious|dangerous|harmful|threat|attack|vulnerab|breach|compromis|suspicious|fraud|scam|phishing|malware|exploit|abuse|risk|warning|alert|critical)\b/i;
  const positiveWords = /\b(safe|secure|legitimate|verified|trusted|clean|benign|protected|compliant|reputable)\b/i;

  if (negativeWords.test(text)) return "negative";
  if (positiveWords.test(text)) return "positive";
  return "neutral";
}

/** Determine which source is more likely correct based on tier. */
function determinePreferredSource(
  a: { tier: ReliabilityTier; confidence: number },
  b: { tier: ReliabilityTier; confidence: number }
): "A" | "B" | "neither" | "inconclusive" {
  if (a.tier > b.tier) return "A";
  if (b.tier > a.tier) return "B";
  if (a.confidence > b.confidence) return "A";
  if (b.confidence > a.confidence) return "B";
  return "inconclusive";
}

/** Determine severity based on tiers and attribute type. */
function determineSeverity(tierA: ReliabilityTier, tierB: ReliabilityTier, attribute: string): ConflictSeverity {
  // Critical if both sources are high-tier
  if (tierA >= 4 && tierB >= 4) return "critical";
  // High if at least one is tier 4+
  if (tierA >= 4 || tierB >= 4) return "high";
  // Medium for security-relevant attributes
  if (["IP address", "hosting", "owner"].includes(attribute)) return "medium";
  return "low";
}

/** Build resolution recommendation for entity value conflicts. */
function buildResolution(
  a: EntityValue,
  b: EntityValue,
  preferred: "A" | "B" | "neither" | "inconclusive",
  attribute: string
): ResolutionRecommendation {
  if (preferred === "A") {
    return {
      action: `Prefer source "${a.sourceLabel}" (tier ${a.tier}) for ${attribute} value "${a.value}".`,
      reasoning: `Source A has higher reliability tier (${a.tier} vs ${b.tier}). Higher-tier sources are more likely to be accurate.`,
      requiresManualVerification: false,
    };
  }
  if (preferred === "B") {
    return {
      action: `Prefer source "${b.sourceLabel}" (tier ${b.tier}) for ${attribute} value "${b.value}".`,
      reasoning: `Source B has higher reliability tier (${b.tier} vs ${a.tier}). Higher-tier sources are more likely to be accurate.`,
      requiresManualVerification: false,
    };
  }
  return {
    action: `Manual verification required. Both sources have equal reliability.`,
    reasoning: `Sources A (${a.sourceLabel}, tier ${a.tier}) and B (${b.sourceLabel}, tier ${b.tier}) have equal tiers. Cannot automatically determine which is correct.`,
    requiresManualVerification: true,
  };
}

/** Build resolution for status conflicts. */
function buildStatusResolution(
  mal: { sourceLabel: string; tier: ReliabilityTier },
  ben: { sourceLabel: string; tier: ReliabilityTier },
  preferred: "A" | "B" | "neither" | "inconclusive"
): ResolutionRecommendation {
  return {
    action: preferred === "A"
      ? `Treat as potentially malicious based on higher-tier source "${mal.sourceLabel}".`
      : preferred === "B"
      ? `Treat as likely benign based on higher-tier source "${ben.sourceLabel}".`
      : `Investigate further — sources have equal reliability.`,
    reasoning: `Threat status conflicts require careful assessment. Prefer the higher-tier source, but consider that threat intelligence may be time-sensitive.`,
    requiresManualVerification: true,
  };
}

/** Build resolution for negation conflicts. */
function buildNegationResolution(
  pos: { sourceLabel: string; tier: ReliabilityTier },
  neg: { sourceLabel: string; tier: ReliabilityTier },
  preferred: "A" | "B" | "neither" | "inconclusive"
): ResolutionRecommendation {
  return {
    action: `Check if both sources were queried at the same time. If different times, both may be correct.`,
    reasoning: `"Not found" results may indicate the entity was not in the database at query time, not that it doesn't exist. Timing differences are a common cause of negation conflicts.`,
    requiresManualVerification: false,
  };
}

/** Rank severity for sorting (higher = more severe). */
function severityRank(s: ConflictSeverity): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[s];
}

/** Build the overall assessment explanation. */
function buildAssessmentExplanation(
  total: number,
  byType: Record<ConflictType, number>,
  bySeverity: Record<ConflictSeverity, number>,
  conflictLevel: number,
  hasSignificant: boolean
): string {
  if (total === 0) {
    return "No contradictions detected. All sources are consistent with each other.";
  }

  const parts: string[] = [];
  parts.push(`${total} contradiction${total > 1 ? "s" : ""} detected`);

  const severityParts: string[] = [];
  if (bySeverity.critical) severityParts.push(`${bySeverity.critical} critical`);
  if (bySeverity.high) severityParts.push(`${bySeverity.high} high`);
  if (bySeverity.medium) severityParts.push(`${bySeverity.medium} medium`);
  if (bySeverity.low) severityParts.push(`${bySeverity.low} low`);
  if (severityParts.length > 0) parts.push(`(${severityParts.join(", ")})`);

  const typeParts: string[] = [];
  if (byType.entity_value) typeParts.push(`${byType.entity_value} entity value`);
  if (byType.status_conflict) typeParts.push(`${byType.status_conflict} status`);
  if (byType.negation_conflict) typeParts.push(`${byType.negation_conflict} negation`);
  if (byType.semantic_conflict) typeParts.push(`${byType.semantic_conflict} semantic`);
  if (typeParts.length > 0) parts.push(`by type: ${typeParts.join(", ")}`);

  if (hasSignificant) {
    parts.push("Evidence base has SIGNIFICANT contradictions that may affect report reliability.");
  } else {
    parts.push("Contradictions are minor and do not significantly affect report reliability.");
  }

  return parts.join(". ") + ".";
}
