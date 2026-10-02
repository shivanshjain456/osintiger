// Intelligence Gap Analysis Engine (Feature 23)
//
// Identifies missing intelligence across the investigation lifecycle by comparing
// the current evidence base against the investigation objective, active hypotheses,
// known entities, and expected evidence patterns.
//
// The engine reasons about:
//   - What is NOT yet known (gaps)
//   - What is only PARTIALLY known (partial coverage)
//   - What is CONTRADICTORY (conflicting evidence)
//   - What is STALE (outdated evidence)
//   - What is HIGH-VALUE if collected next (next actions)
//
// It ranks candidate next actions by expected utility, confidence gain, coverage
// improvement, contradiction resolution potential, freshness improvement, and
// relevance to the current objective.
//
// 16 gap dimensions analyzed:
//   identity, infrastructure, dns, certificates, social, organizational, tech_stack,
//   public_records, historical, relationship, source_credibility, provenance,
//   contradiction, recency, coverage, verification

import ZAI from "z-ai-web-dev-sdk";
import type { ReportData, SourceResult, KeyFinding, Contradiction, SourceConsulted } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export type GapDimension =
  | "identity_attribution"
  | "infrastructure_hosting"
  | "domain_dns"
  | "certificate_tls"
  | "social_professional"
  | "organizational_hierarchy"
  | "technical_stack"
  | "public_records"
  | "historical_evolution"
  | "relationship"
  | "source_credibility"
  | "provenance"
  | "contradiction"
  | "recency"
  | "coverage"
  | "verification";

export type GapClass =
  | "critical"      // blocks meaningful conclusions
  | "high_value"    // materially improves confidence
  | "opportunistic" // inexpensive to close
  | "low_value"     // can be deferred
  | "redundant"     // already sufficiently covered
  | "speculative";  // only if higher-priority leads fail

export type GapSeverity = "critical" | "high" | "medium" | "low" | "minimal";

export interface IntelligenceGap {
  id: string;
  dimension: GapDimension;
  title: string;
  description: string;
  gapClass: GapClass;
  severity: GapSeverity;
  severityScore: number;          // 0-1 (higher = more severe)
  whatIsKnown: string;            // what evidence currently exists
  whatIsMissing: string;          // what's absent
  whyItMatters: string;           // investigative significance
  howToObtain: string;            // practical collection method
  expectedEvidence: string;       // what evidence would be produced
  expectedImpact: string;         // how it improves confidence/completeness
  dependencies: string[];         // prerequisite gaps that must be closed first
  downstreamBranches: string[];   // what new investigative branches it unlocks
  recommendedSources: string[];   // source keys that could fill this gap
  actionType: "exploratory" | "confirmatory" | "contradiction_resolving";
  automation: "automated" | "manual" | "deferred";
  confidenceInAssessment: number; // 0-1 — how confident we are this is a real gap
}

export interface NextAction {
  id: string;
  rank: number;                   // 1 = highest priority
  action: string;                 // what to do
  targetGapIds: string[];         // which gaps this addresses
  actionType: "exploratory" | "confirmatory" | "contradiction_resolving";
  automation: "automated" | "manual" | "deferred";
  expectedUtility: number;        // 0-1 — overall expected value
  confidenceGain: number;         // 0-1 — how much confidence improves
  coverageImprovement: number;    // 0-1 — how much coverage expands
  contradictionResolution: number; // 0-1 — potential to resolve contradictions
  freshnessImprovement: number;   // 0-1 — how much it improves recency
  relevanceToObjective: number;   // 0-1 — alignment with investigation objective
  expectedEvidence: string;       // what evidence it produces
  reasoning: string;              // why this is prioritized
  alternativesConsidered: string[]; // other actions considered
  alternativesRejectedReason: string; // why alternatives were ranked lower
  assumptions: string[];          // what assumptions are being made
  downstreamBranches: string[];   // what branches it unlocks
  isPrimary: boolean;             // primary recommendation
  isFallback: boolean;            // fallback option
}

export interface EvidenceCoverage {
  dimension: GapDimension;
  coveragePercent: number;        // 0-100
  sourcesConsulted: string[];
  findingsCount: number;
  hasContradictions: boolean;
  isStale: boolean;
  lastEvidenceAge: string;        // human-readable age
  assessment: "well_covered" | "partially_covered" | "minimally_covered" | "not_covered" | "contradictory";
}

export interface GapAnalysisReport {
  investigationId: string;
  objective: string;
  target: string;
  inputType: string;
  generatedAt: string;
  knownEvidenceSummary: string;
  gaps: IntelligenceGap[];
  nextActions: NextAction[];
  coverage: EvidenceCoverage[];
  unresolvedContradictions: { topic: string; sources: string[]; description: string }[];
  staleEvidence: { area: string; lastSeen: string; age: string; significance: string }[];
  analysisStats: {
    totalGaps: number;
    criticalGaps: number;
    highValueGaps: number;
    opportunisticGaps: number;
    dimensionsCovered: number;
    dimensionsNotCovered: number;
    avgCoverage: number;
    primaryAction: string | null;
  };
  strategicAssessment: string;    // LLM-synthesized strategic overview
  confidenceInAnalysis: number;   // 0-1
  analysisDurationMs: number;
}

export interface GapAnalysisApiResponse {
  investigation_id: string;
  report: GapAnalysisReport;
}

// ============================================================================
// GAP DIMENSION DEFINITIONS
// ============================================================================

export const GAP_DIMENSIONS: Record<GapDimension, { label: string; description: string; expectedSources: string[] }> = {
  identity_attribution: {
    label: "Identity & Attribution",
    description: "Who owns/operates the target, real-world identity, attribution confidence",
    expectedSources: ["openrdap", "edgar", "opencorporates", "gleif", "wikipedia", "web_search"],
  },
  infrastructure_hosting: {
    label: "Infrastructure & Hosting",
    description: "IP addresses, hosting provider, ASN, server infrastructure, cloud provider",
    expectedSources: ["ipinfo", "ipquery", "bgpview", "shodan_internetdb", "peeringdb", "dns_google"],
  },
  domain_dns: {
    label: "Domain & DNS",
    description: "DNS records (A, AAAA, MX, NS, TXT, CNAME), domain registration, DNS history",
    expectedSources: ["dns_google", "doh", "openrdap", "domainsdb"],
  },
  certificate_tls: {
    label: "Certificate & TLS",
    description: "SSL/TLS certificates, certificate transparency, CA, expiry, SANs",
    expectedSources: ["crtsh"],
  },
  social_professional: {
    label: "Social & Professional Presence",
    description: "Social media accounts, professional profiles, username presence",
    expectedSources: ["github", "gitlab", "reddit", "whatsmyname", "usernamesearch", "gravatar", "hackernews"],
  },
  organizational_hierarchy: {
    label: "Organizational Hierarchy",
    description: "Company structure, executives, subsidiaries, parent company, leadership",
    expectedSources: ["edgar", "opencorporates", "gleif", "wikipedia", "web_search"],
  },
  technical_stack: {
    label: "Technical Stack",
    description: "Technology stack, frameworks, CMS, server software, programming languages",
    expectedSources: ["httpheaders", "urlscan", "web_search", "robotssitemap"],
  },
  public_records: {
    label: "Public Records",
    description: "Government filings, court records, regulatory filings, public registries",
    expectedSources: ["edgar", "opencorporates", "usaspending", "fec", "icij"],
  },
  historical_evolution: {
    label: "Historical Evolution",
    description: "How the target has changed over time, historical snapshots, past infrastructure",
    expectedSources: ["wayback", "archiveorg", "urlscan"],
  },
  relationship: {
    label: "Relationships",
    description: "Connections between entities, networks, affiliations, ownership links",
    expectedSources: ["web_search", "edgar", "opencorporates", "gleif", "icij"],
  },
  source_credibility: {
    label: "Source Credibility",
    description: "Reliability of sources used, tier distribution, source diversity",
    expectedSources: [], // meta-dimension — assessed from source analysis
  },
  provenance: {
    label: "Provenance",
    description: "Chain of custody for evidence, traceability, source attribution",
    expectedSources: [], // meta-dimension
  },
  contradiction: {
    label: "Contradictions",
    description: "Conflicting evidence between sources, unresolved disputes",
    expectedSources: [], // meta-dimension
  },
  recency: {
    label: "Recency",
    description: "Freshness of evidence, staleness, temporal currency",
    expectedSources: [], // meta-dimension
  },
  coverage: {
    label: "Coverage",
    description: "Breadth of source coverage, which source types have been consulted",
    expectedSources: [], // meta-dimension
  },
  verification: {
    label: "Verification",
    description: "Cross-source verification, corroboration, single-source claims",
    expectedSources: [], // meta-dimension
  },
};

// ============================================================================
// ZAI CLIENT
// ============================================================================

let zaiPromise: Promise<unknown> | null = null;
async function getZai() {
  if (!zaiPromise) zaiPromise = ZAI.create();
  return zaiPromise as Promise<{
    chat: {
      completions: {
        create: (args: {
          messages: { role: string; content: string }[];
          thinking?: { type: string };
        }) => Promise<{ choices: { message: { content: string } }[] }>;
      };
    };
  }>;
}

const GAP_AI_TIMEOUT_MS = 45_000;
async function withGapTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Gap analysis AI call timed out after 45s")), GAP_AI_TIMEOUT_MS);
    }),
  ]);
}

// ============================================================================
// EVIDENCE ANALYZER — builds evidence profile from investigation
// ============================================================================

interface EvidenceProfile {
  totalFindings: number;
  totalSources: number;
  successfulSources: string[];
  failedSources: string[];
  skippedSources: string[];
  sourcesByType: Map<string, number>;
  findingsByDimension: Map<GapDimension, { count: number; sources: string[]; latestTimestamp: number; hasContradiction: boolean }>;
  contradictions: Contradiction[];
  keyFindings: KeyFinding[];
  sourceConsulted: SourceConsulted[];
  oldestEvidenceAge: number;       // ms
  newestEvidenceAge: number;       // ms
  avgConfidence: number;
  lowConfidenceFindings: number;   // findings with confidence < 0.4
  singleSourceFindings: number;    // claims from only 1 source
  report: ReportData | null;
}

function analyzeEvidence(
  sourceResults: SourceResult[],
  report: ReportData | null,
  target: string,
  inputType: string
): EvidenceProfile {
  const profile: EvidenceProfile = {
    totalFindings: 0,
    totalSources: 0,
    successfulSources: [],
    failedSources: [],
    skippedSources: [],
    sourcesByType: new Map(),
    findingsByDimension: new Map(),
    contradictions: report?.contradictions || [],
    keyFindings: report?.key_findings || [],
    sourceConsulted: report?.sources_consulted || [],
    oldestEvidenceAge: Date.now(),
    newestEvidenceAge: 0,
    avgConfidence: 0,
    lowConfidenceFindings: 0,
    singleSourceFindings: 0,
    report,
  };

  const now = Date.now();
  const allConfidences: number[] = [];

  for (const sr of sourceResults) {
    profile.totalSources++;
    if (sr.status === "success") {
      profile.successfulSources.push(sr.source);
      profile.sourcesByType.set(sr.source, (profile.sourcesByType.get(sr.source) || 0) + sr.findings.length);
      profile.totalFindings += sr.findings.length;

      for (const f of sr.findings) {
        allConfidences.push(f.confidence);
        if (f.confidence < 0.4) profile.lowConfidenceFindings++;

        const dim = classifyFindingToDimension(f.data, sr.source);
        const existing = profile.findingsByDimension.get(dim) || { count: 0, sources: [], latestTimestamp: 0, hasContradiction: false };
        existing.count++;
        if (!existing.sources.includes(sr.source)) existing.sources.push(sr.source);
        const ts = new Date(f.timestamp).getTime();
        if (ts > existing.latestTimestamp) existing.latestTimestamp = ts;
        if (now - ts < profile.oldestEvidenceAge) profile.oldestEvidenceAge = now - ts;
        if (now - ts > profile.newestEvidenceAge) profile.newestEvidenceAge = now - ts;
        profile.findingsByDimension.set(dim, existing);
      }
    } else if (sr.status === "error") {
      profile.failedSources.push(sr.source);
    } else if (sr.status === "skipped") {
      profile.skippedSources.push(sr.source);
    }
  }

  // Check for contradictions in each dimension
  if (report?.contradictions) {
    for (const c of report.contradictions) {
      const dim = classifyContradictionToDimension(c);
      const existing = profile.findingsByDimension.get(dim);
      if (existing) {
        existing.hasContradiction = true;
        profile.findingsByDimension.set(dim, existing);
      }
    }
  }

  // Count single-source findings (claims from only 1 source)
  for (const [, data] of profile.findingsByDimension) {
    if (data.sources.length === 1) {
      profile.singleSourceFindings += data.count;
    }
  }

  profile.avgConfidence = allConfidences.length > 0
    ? allConfidences.reduce((s, c) => s + c, 0) / allConfidences.length
    : 0;

  return profile;
}

function classifyFindingToDimension(text: string, source: string): GapDimension {
  const lower = text.toLowerCase();

  // Certificate sources
  if (source === "crtsh" || /certificate|ssl|tls|x509|cert\./i.test(text)) return "certificate_tls";

  // DNS sources
  if (["dns_google", "doh"].includes(source) || /\b(dns|a record|aaaa|mx record|ns record|txt record|cname|soa)\b/i.test(text)) return "domain_dns";

  // Domain registration
  if (source === "openrdap" || /registrant|registrar|whois|registration|domain (name|status)/i.test(text)) return "identity_attribution";

  // Infrastructure
  if (["ipinfo", "ipquery", "bgpview", "shodan_internetdb", "peeringdb", "ipwhois", "ipapico", "freeipapi"].includes(source)
      || /\b(ip address|asn|hosting|server|cloud|datacenter|infrastructure)\b/i.test(text)) return "infrastructure_hosting";

  // Social/professional
  if (["github", "gitlab", "reddit", "whatsmyname", "usernamesearch", "gravatar", "hackernews", "stackexchange"].includes(source)
      || /\b(github|gitlab|reddit|twitter|linkedin|facebook|instagram|social|profile|username)\b/i.test(text)) return "social_professional";

  // Organizational
  if (["edgar", "opencorporates", "gleif"].includes(source)
      || /\b(company|corporation|subsidiary|parent|ceo|cfo|cto|executive|board|director|officer)\b/i.test(text)) return "organizational_hierarchy";

  // Technical stack
  if (["httpheaders", "urlscan", "robotssitemap"].includes(source)
      || /\b(server:|x-powered-by|wordpress|drupal|nginx|apache|framework|cms|technology stack)\b/i.test(text)) return "technical_stack";

  // Public records
  if (["edgar", "usaspending", "fec", "icij"].includes(source)
      || /\b(filing|sec form|10-k|10-q|8-k|court|regulatory|public record|government)\b/i.test(text)) return "public_records";

  // Historical
  if (["wayback", "archiveorg"].includes(source)
      || /\b(archived|historical|snapshot|past|previous|former|wayback)\b/i.test(text)) return "historical_evolution";

  // Relationship
  if (/\b(related to|connected to|owned by|subsidiary of|partner of|links to|associated with)\b/i.test(text)) return "relationship";

  // Default to identity/attribution
  return "identity_attribution";
}

function classifyContradictionToDimension(c: Contradiction): GapDimension {
  const text = (c.topic + " " + c.claim_a + " " + c.claim_b).toLowerCase();
  if (/dns|record|resolve/.test(text)) return "domain_dns";
  if (/ip|hosting|server/.test(text)) return "infrastructure_hosting";
  if (/cert|ssl|tls/.test(text)) return "certificate_tls";
  if (/owner|registrant|company/.test(text)) return "identity_attribution";
  return "contradiction";
}

// ============================================================================
// GAP DETECTION — 16 dimensions
// ============================================================================

export function detectGaps(
  profile: EvidenceProfile,
  target: string,
  inputType: string,
  objective: string
): IntelligenceGap[] {
  const gaps: IntelligenceGap[] = [];
  const gapIdCounter = { n: 0 };
  const now = Date.now();

  // Analyze each dimension
  for (const [dim, defn] of Object.entries(GAP_DIMENSIONS)) {
    const dimension = dim as GapDimension;
    const evidence = profile.findingsByDimension.get(dimension);
    const findingsCount = evidence?.count || 0;
    const sources = evidence?.sources || [];
    const hasContradiction = evidence?.hasContradiction || false;
    const latestTimestamp = evidence?.latestTimestamp || 0;
    const ageMs = latestTimestamp > 0 ? now - latestTimestamp : 0;

    // Determine coverage
    let coverage: EvidenceCoverage["assessment"];
    let coveragePercent: number;
    if (findingsCount === 0) {
      coverage = "not_covered";
      coveragePercent = 0;
    } else if (hasContradiction) {
      coverage = "contradictory";
      coveragePercent = 40;
    } else if (findingsCount < 3 || sources.length < 2) {
      coverage = "minimally_covered";
      coveragePercent = 30;
    } else if (findingsCount < 8 || sources.length < 4) {
      coverage = "partially_covered";
      coveragePercent = 60;
    } else {
      coverage = "well_covered";
      coveragePercent = 90;
    }

    // Determine gap class and severity
    let gapClass: GapClass;
    let severity: GapSeverity;
    let severityScore: number;

    if (coverage === "not_covered") {
      // Check if this dimension is relevant to the target type
      const relevance = isDimensionRelevant(dimension, inputType);
      if (relevance === "critical") {
        gapClass = "critical";
        severity = "critical";
        severityScore = 0.95;
      } else if (relevance === "high") {
        gapClass = "high_value";
        severity = "high";
        severityScore = 0.75;
      } else if (relevance === "medium") {
        gapClass = "opportunistic";
        severity = "medium";
        severityScore = 0.5;
      } else {
        gapClass = "speculative";
        severity = "low";
        severityScore = 0.25;
      }
    } else if (coverage === "contradictory") {
      gapClass = "high_value";
      severity = "high";
      severityScore = 0.8;
    } else if (coverage === "minimally_covered") {
      gapClass = "high_value";
      severity = "high";
      severityScore = 0.7;
    } else if (coverage === "partially_covered") {
      gapClass = "opportunistic";
      severity = "medium";
      severityScore = 0.45;
    } else {
      // well_covered — check for staleness
      if (ageMs > 90 * 24 * 60 * 60 * 1000) {
        gapClass = "opportunistic";
        severity = "medium";
        severityScore = 0.4;
      } else {
        gapClass = "redundant";
        severity = "minimal";
        severityScore = 0.1;
      }
    }

    // Skip redundant gaps (well-covered, fresh, no contradictions)
    if (gapClass === "redundant") continue;

    // Determine what's known vs missing
    const whatIsKnown = findingsCount > 0
      ? `${findingsCount} findings from ${sources.length} source(s): ${sources.slice(0, 3).join(", ")}${sources.length > 3 ? "..." : ""}`
      : "No evidence collected for this dimension.";

    const whatIsMissing = buildMissingDescription(dimension, coverage, inputType);
    const whyItMatters = buildWhyItMatters(dimension, inputType);
    const howToObtain = buildHowToObtain(dimension, defn.expectedSources, inputType);
    const expectedEvidence = buildExpectedEvidence(dimension, target);
    const expectedImpact = buildExpectedImpact(dimension, coverage);
    const actionType: IntelligenceGap["actionType"] =
      coverage === "contradictory" ? "contradiction_resolving"
      : coverage === "not_covered" ? "exploratory"
      : "confirmatory";

    const automation: IntelligenceGap["automation"] =
      defn.expectedSources.length > 0 ? "automated" : "manual";

    const dependencies = buildDependencies(dimension);
    const downstreamBranches = buildDownstreamBranches(dimension);

    gaps.push({
      id: `gap_${gapIdCounter.n++}`,
      dimension,
      title: `${defn.label} — ${coverage === "not_covered" ? "Not Covered" : coverage === "contradictory" ? "Contradictory Evidence" : coverage === "minimally_covered" ? "Minimally Covered" : "Partially Covered"}`,
      description: whatIsMissing,
      gapClass,
      severity,
      severityScore,
      whatIsKnown,
      whatIsMissing,
      whyItMatters,
      howToObtain,
      expectedEvidence,
      expectedImpact,
      dependencies,
      downstreamBranches,
      recommendedSources: defn.expectedSources,
      actionType,
      automation,
      confidenceInAssessment: findingsCount === 0 ? 0.9 : 0.7,
    });
  }

  // Add meta-gaps: single-source findings (verification gap)
  if (profile.singleSourceFindings > profile.totalFindings * 0.4 && profile.totalFindings > 5) {
    gaps.push({
      id: `gap_${gapIdCounter.n++}`,
      dimension: "verification",
      title: "Verification — High Single-Source Dependency",
      description: `${profile.singleSourceFindings} of ${profile.totalFindings} findings (${Math.round(profile.singleSourceFindings / profile.totalFindings * 100)}%) come from single sources — insufficient cross-source verification.`,
      gapClass: "high_value",
      severity: "high",
      severityScore: 0.7,
      whatIsKnown: `${profile.totalFindings} total findings, ${profile.singleSourceFindings} from single sources`,
      whatIsMissing: "Cross-source corroboration for single-source claims",
      whyItMatters: "Single-source claims are more vulnerable to error, bias, or manipulation. Corroboration strengthens confidence.",
      howToObtain: "Re-query key claims through additional independent sources to verify or contradict.",
      expectedEvidence: "Confirmed or contradicted claims with multi-source attribution",
      expectedImpact: "Reduces single-source dependency, increases overall confidence",
      dependencies: [],
      downstreamBranches: ["May reveal new contradictions", "May confirm key findings"],
      recommendedSources: ["web_search", "wikipedia"],
      actionType: "confirmatory",
      automation: "automated",
      confidenceInAssessment: 0.85,
    });
  }

  // Add meta-gap: low confidence findings
  if (profile.lowConfidenceFindings > profile.totalFindings * 0.3 && profile.totalFindings > 5) {
    gaps.push({
      id: `gap_${gapIdCounter.n++}`,
      dimension: "source_credibility",
      title: "Source Credibility — High Low-Confidence Findings",
      description: `${profile.lowConfidenceFindings} of ${profile.totalFindings} findings (${Math.round(profile.lowConfidenceFindings / profile.totalFindings * 100)}%) have confidence < 40% — evidence quality is weak.`,
      gapClass: "high_value",
      severity: "high",
      severityScore: 0.65,
      whatIsKnown: `${profile.lowConfidenceFindings} low-confidence findings detected`,
      whatIsMissing: "Higher-credibility sources to corroborate or replace low-confidence claims",
      whyItMatters: "Low-confidence findings may be unreliable. Higher-tier sources are needed for defensible conclusions.",
      howToObtain: "Query authoritative sources (tier 4-5) to replace or corroborate low-confidence claims.",
      expectedEvidence: "Higher-confidence findings from authoritative sources",
      expectedImpact: "Improves overall confidence and defensibility",
      dependencies: [],
      downstreamBranches: ["May invalidate some findings", "May strengthen key conclusions"],
      recommendedSources: ["edgar", "gleif", "nvd", "cisa_kev"],
      actionType: "confirmatory",
      automation: "automated",
      confidenceInAssessment: 0.9,
    });
  }

  // Add contradiction gaps
  if (profile.contradictions.length > 0) {
    for (const c of profile.contradictions) {
      gaps.push({
        id: `gap_${gapIdCounter.n++}`,
        dimension: "contradiction",
        title: `Contradiction — ${c.topic}`,
        description: `Sources disagree: ${c.claim_a.slice(0, 100)} vs ${c.claim_b.slice(0, 100)}`,
        gapClass: "critical",
        severity: "critical",
        severityScore: 0.9,
        whatIsKnown: `Source A (${c.source_a}): ${c.claim_a.slice(0, 150)} | Source B (${c.source_b}): ${c.claim_b.slice(0, 150)}`,
        whatIsMissing: "A tie-breaking source or additional evidence to resolve the contradiction",
        whyItMatters: "Unresolved contradictions prevent confident conclusions and may indicate unreliable sources.",
        howToObtain: "Query additional independent sources to determine which claim is correct.",
        expectedEvidence: "A third (or more) source that confirms one side or reveals a nuance",
        expectedImpact: "Resolves the contradiction, improves confidence, identifies unreliable source",
        dependencies: [],
        downstreamBranches: ["May reveal source reliability issues", "May uncover deeper complexity"],
        recommendedSources: ["web_search", "wikipedia"],
        actionType: "contradiction_resolving",
        automation: "automated",
        confidenceInAssessment: 1.0,
      });
    }
  }

  // Add recency gap if evidence is stale
  if (profile.oldestEvidenceAge > 90 * 24 * 60 * 60 * 1000 && profile.totalFindings > 0) {
    const daysOld = Math.floor(profile.oldestEvidenceAge / (24 * 60 * 60 * 1000));
    gaps.push({
      id: `gap_${gapIdCounter.n++}`,
      dimension: "recency",
      title: "Recency — Stale Evidence",
      description: `Oldest evidence is ${daysOld} days old — may not reflect current state.`,
      gapClass: "opportunistic",
      severity: "medium",
      severityScore: 0.45,
      whatIsKnown: `Evidence collected up to ${daysOld} days ago`,
      whatIsMissing: "Fresh evidence to confirm current state",
      whyItMatters: "Infrastructure, ownership, and threat landscape can change rapidly. Stale evidence may lead to outdated conclusions.",
      howToObtain: "Re-run key source queries to get fresh data.",
      expectedEvidence: "Current state confirmation or change detection",
      expectedImpact: "Improves temporal currency of conclusions",
      dependencies: [],
      downstreamBranches: ["May reveal infrastructure changes", "May detect new threats"],
      recommendedSources: ["dns_google", "httpheaders", "urlscan"],
      actionType: "confirmatory",
      automation: "automated",
      confidenceInAssessment: 0.8,
    });
  }

  // Sort gaps by severity score descending
  gaps.sort((a, b) => b.severityScore - a.severityScore);

  return gaps;
}

function isDimensionRelevant(dim: GapDimension, inputType: string): "critical" | "high" | "medium" | "low" {
  // Critical for all types
  if (["identity_attribution", "coverage", "verification"].includes(dim)) return "critical";

  // High relevance based on input type
  if (inputType === "domain" || inputType === "url") {
    if (["domain_dns", "infrastructure_hosting", "certificate_tls", "technical_stack", "historical_evolution"].includes(dim)) return "critical";
    if (["identity_attribution", "relationship", "public_records"].includes(dim)) return "high";
    return "medium";
  }
  if (inputType === "ip") {
    if (["infrastructure_hosting", "domain_dns"].includes(dim)) return "critical";
    if (["identity_attribution", "certificate_tls", "technical_stack"].includes(dim)) return "high";
    return "medium";
  }
  if (inputType === "organization") {
    if (["organizational_hierarchy", "public_records", "identity_attribution", "relationship"].includes(dim)) return "critical";
    if (["infrastructure_hosting", "domain_dns", "social_professional"].includes(dim)) return "high";
    return "medium";
  }
  if (inputType === "person") {
    if (["social_professional", "identity_attribution", "public_records"].includes(dim)) return "critical";
    if (["organizational_hierarchy", "relationship", "historical_evolution"].includes(dim)) return "high";
    return "medium";
  }
  if (inputType === "wallet") {
    if (["identity_attribution", "relationship", "public_records"].includes(dim)) return "critical";
    return "medium";
  }
  if (inputType === "cve") {
    if (["technical_stack", "infrastructure_hosting"].includes(dim)) return "critical";
    return "medium";
  }
  if (inputType === "email") {
    if (["social_professional", "identity_attribution"].includes(dim)) return "critical";
    return "medium";
  }
  return "medium";
}

function buildMissingDescription(dim: GapDimension, coverage: string, inputType: string): string {
  const defn = GAP_DIMENSIONS[dim];
  if (coverage === "not_covered") {
    return `No evidence has been collected for ${defn.label.toLowerCase()}. This dimension is ${isDimensionRelevant(dim, inputType)} relevance for ${inputType} targets. Expected: ${defn.description}.`;
  }
  if (coverage === "contradictory") {
    return `Evidence for ${defn.label.toLowerCase()} is contradictory — sources disagree. Resolution requires additional independent sources.`;
  }
  if (coverage === "minimally_covered") {
    return `Only minimal evidence collected for ${defn.label.toLowerCase()}. Additional sources needed to improve coverage and confidence.`;
  }
  return `Partial coverage for ${defn.label.toLowerCase()}. Additional sources would improve completeness.`;
}

function buildWhyItMatters(dim: GapDimension, inputType: string): string {
  const reasons: Record<GapDimension, string> = {
    identity_attribution: "Without confirmed ownership/attribution, conclusions about the target's nature and intent are speculative.",
    infrastructure_hosting: "Infrastructure details reveal operational patterns, geographic distribution, and potential exposure points.",
    domain_dns: "DNS records are fundamental to understanding the target's online presence, mail handling, and name resolution.",
    certificate_tls: "Certificates reveal subdomains, organizational details, and security posture.",
    social_professional: "Social/professional presence reveals affiliations, interests, and network connections.",
    organizational_hierarchy: "Understanding organizational structure is essential for attribution and relationship analysis.",
    technical_stack: "Technology stack reveals capabilities, vulnerabilities, and operational maturity.",
    public_records: "Public records provide authoritative confirmation of legal and regulatory status.",
    historical_evolution: "Historical context reveals patterns of change, prior infrastructure, and long-term behavior.",
    relationship: "Relationships between entities are often the most valuable intelligence — they reveal networks and influence.",
    source_credibility: "Source credibility determines the defensibility of conclusions.",
    provenance: "Provenance ensures evidence is traceable and admissible.",
    contradiction: "Unresolved contradictions undermine confidence in all related conclusions.",
    recency: "Stale evidence may not reflect current reality, leading to outdated conclusions.",
    coverage: "Incomplete source coverage means the intelligence picture has blind spots.",
    verification: "Single-source claims are inherently less reliable than cross-verified findings.",
  };
  return reasons[dim] || "This gap limits investigative completeness.";
}

function buildHowToObtain(dim: GapDimension, expectedSources: string[], inputType: string): string {
  if (expectedSources.length > 0) {
    return `Query the following sources: ${expectedSources.join(", ")}. These can be collected automatically via the investigation pipeline.`;
  }
  return `Manual analyst review or targeted web search is needed for this dimension.`;
}

function buildExpectedEvidence(dim: GapDimension, target: string): string {
  const defn = GAP_DIMENSIONS[dim];
  return `Fresh evidence about ${defn.label.toLowerCase()} for ${target}, including: ${defn.description}.`;
}

function buildExpectedImpact(dim: GapDimension, coverage: string): string {
  if (coverage === "not_covered") return "Opens an entirely new investigative dimension — high marginal value.";
  if (coverage === "contradictory") return "Resolves contradiction and identifies unreliable source.";
  if (coverage === "minimally_covered") return "Improves coverage from minimal to partial, increasing confidence.";
  return "Improves coverage completeness and cross-source verification.";
}

function buildDependencies(dim: GapDimension): string[] {
  const deps: Record<GapDimension, string[]> = {
    identity_attribution: [],
    infrastructure_hosting: ["domain_dns"],
    domain_dns: [],
    certificate_tls: ["domain_dns"],
    social_professional: ["identity_attribution"],
    organizational_hierarchy: ["identity_attribution"],
    technical_stack: ["infrastructure_hosting"],
    public_records: ["identity_attribution"],
    historical_evolution: ["domain_dns", "infrastructure_hosting"],
    relationship: ["identity_attribution", "organizational_hierarchy"],
    source_credibility: [],
    provenance: [],
    contradiction: [],
    recency: [],
    coverage: [],
    verification: [],
  };
  return deps[dim] || [];
}

function buildDownstreamBranches(dim: GapDimension): string[] {
  const branches: Record<GapDimension, string[]> = {
    identity_attribution: ["Identify real-world owner", "Link to other assets", "Attribution confidence"],
    infrastructure_hosting: ["Map attack surface", "Identify co-hosted services", "Geographic distribution"],
    domain_dns: ["Subdomain enumeration", "DNS history analysis", "Mail server analysis"],
    certificate_tls: ["Subdomain discovery", "Certificate chain analysis", "CA identification"],
    social_professional: ["Network mapping", "Behavioral analysis", "Affiliation discovery"],
    organizational_hierarchy: ["Leadership profiling", "Subsidiary mapping", "Ownership chain"],
    technical_stack: ["Vulnerability assessment", "Technology correlation", "Capability analysis"],
    public_records: ["Legal status confirmation", "Financial health", "Regulatory compliance"],
    historical_evolution: ["Change detection", "Pattern analysis", "Timeline construction"],
    relationship: ["Network graph expansion", "Influence mapping", "Hidden connections"],
    source_credibility: ["Source tier adjustment", "Confidence recalibration"],
    provenance: ["Audit trail", "Evidence chain validation"],
    contradiction: ["Source reliability assessment", "Truth determination"],
    recency: ["Current state confirmation", "Change detection"],
    coverage: ["Blind spot elimination", "Completeness assessment"],
    verification: ["Confidence strengthening", "Single-source risk reduction"],
  };
  return branches[dim] || [];
}

// ============================================================================
// COVERAGE ANALYSIS
// ============================================================================

export function analyzeCoverage(profile: EvidenceProfile): EvidenceCoverage[] {
  const coverages: EvidenceCoverage[] = [];
  const now = Date.now();

  for (const [dim, defn] of Object.entries(GAP_DIMENSIONS)) {
    const dimension = dim as GapDimension;
    const evidence = profile.findingsByDimension.get(dimension);
    const findingsCount = evidence?.count || 0;
    const sources = evidence?.sources || [];
    const hasContradiction = evidence?.hasContradiction || false;
    const latestTimestamp = evidence?.latestTimestamp || 0;
    const ageMs = latestTimestamp > 0 ? now - latestTimestamp : 0;

    let coveragePercent: number;
    let assessment: EvidenceCoverage["assessment"];

    if (findingsCount === 0) {
      coveragePercent = 0;
      assessment = "not_covered";
    } else if (hasContradiction) {
      coveragePercent = 40;
      assessment = "contradictory";
    } else if (findingsCount < 3 || sources.length < 2) {
      coveragePercent = 30;
      assessment = "minimally_covered";
    } else if (findingsCount < 8 || sources.length < 4) {
      coveragePercent = 60;
      assessment = "partially_covered";
    } else {
      coveragePercent = 90;
      assessment = "well_covered";
    }

    const isStale = ageMs > 90 * 24 * 60 * 60 * 1000;
    const lastEvidenceAge = ageMs > 0 ? formatAge(ageMs) : "n/a";

    coverages.push({
      dimension,
      coveragePercent,
      sourcesConsulted: sources,
      findingsCount,
      hasContradictions: hasContradiction,
      isStale,
      lastEvidenceAge,
      assessment,
    });
  }

  return coverages;
}

function formatAge(ageMs: number): string {
  const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ============================================================================
// NEXT ACTION RECOMMENDER
// ============================================================================

export function recommendNextActions(
  gaps: IntelligenceGap[],
  profile: EvidenceProfile,
  target: string,
  inputType: string,
  objective: string
): NextAction[] {
  const actions: NextAction[] = [];

  // Generate one action per non-redundant gap
  for (const gap of gaps) {
    if (gap.gapClass === "redundant") continue;

    const expectedUtility = computeExpectedUtility(gap, profile);
    const confidenceGain = computeConfidenceGain(gap, profile);
    const coverageImprovement = computeCoverageImprovement(gap, profile);
    const contradictionResolution = computeContradictionResolution(gap, profile);
    const freshnessImprovement = computeFreshnessImprovement(gap, profile);
    const relevanceToObjective = computeRelevance(gap, inputType, objective);

    const alternativesConsidered = gaps
      .filter((g) => g.id !== gap.id && g.dimension !== gap.dimension && g.gapClass !== "redundant")
      .slice(0, 3)
      .map((g) => `Collect ${GAP_DIMENSIONS[g.dimension].label} (severity: ${g.severity})`);

    actions.push({
      id: `action_${actions.length}`,
      rank: 0, // will be set after sorting
      action: gap.howToObtain,
      targetGapIds: [gap.id],
      actionType: gap.actionType,
      automation: gap.automation,
      expectedUtility,
      confidenceGain,
      coverageImprovement,
      contradictionResolution,
      freshnessImprovement,
      relevanceToObjective,
      expectedEvidence: gap.expectedEvidence,
      reasoning: `Addresses ${gap.gapClass.replace(/_/g, " ")} gap in ${GAP_DIMITIONS_LABEL(gap.dimension)} (severity: ${gap.severity}). ${gap.whyItMatters} ${gap.expectedImpact}`,
      alternativesConsidered,
      alternativesRejectedReason: `Ranked lower due to lower severity or relevance to the current objective (${inputType} target).`,
      assumptions: [
        `The target (${target}) remains accessible to the recommended sources.`,
        `Sources will return fresh, relevant data.`,
      ],
      downstreamBranches: gap.downstreamBranches,
      isPrimary: false,
      isFallback: false,
    });
  }

  // Sort by expected utility descending
  actions.sort((a, b) => b.expectedUtility - a.expectedUtility);

  // Assign ranks and mark primary/fallback
  for (let i = 0; i < actions.length; i++) {
    actions[i].rank = i + 1;
    actions[i].isPrimary = i === 0;
    actions[i].isFallback = i >= actions.length - 2 && actions.length > 3;
  }

  // Cap at 10 actions
  return actions.slice(0, 10);
}

function GAP_DIMITIONS_LABEL(dim: GapDimension): string {
  return GAP_DIMENSIONS[dim].label;
}

function computeExpectedUtility(gap: IntelligenceGap, profile: EvidenceProfile): number {
  // Weighted combination of all factors
  const severity = gap.severityScore;
  const relevance = 0.8; // base relevance
  const costInverse = gap.automation === "automated" ? 0.9 : gap.automation === "manual" ? 0.4 : 0.6;
  return severity * 0.4 + relevance * 0.3 + costInverse * 0.3;
}

function computeConfidenceGain(gap: IntelligenceGap, profile: EvidenceProfile): number {
  if (gap.dimension === "verification") return 0.8;
  if (gap.dimension === "contradiction") return 0.9;
  if (gap.dimension === "source_credibility") return 0.7;
  if (gap.gapClass === "critical") return 0.8;
  if (gap.gapClass === "high_value") return 0.6;
  if (gap.gapClass === "opportunistic") return 0.4;
  return 0.2;
}

function computeCoverageImprovement(gap: IntelligenceGap, profile: EvidenceProfile): number {
  if (gap.gapClass === "critical") return 0.9; // opens entirely new dimension
  if (gap.gapClass === "high_value") return 0.7;
  if (gap.gapClass === "opportunistic") return 0.5;
  return 0.3;
}

function computeContradictionResolution(gap: IntelligenceGap, profile: EvidenceProfile): number {
  if (gap.dimension === "contradiction") return 1.0;
  if (gap.actionType === "contradiction_resolving") return 0.8;
  if (profile.contradictions.length > 0) return 0.3;
  return 0.1;
}

function computeFreshnessImprovement(gap: IntelligenceGap, profile: EvidenceProfile): number {
  if (gap.dimension === "recency") return 1.0;
  if (profile.oldestEvidenceAge > 90 * 24 * 60 * 60 * 1000) return 0.6;
  return 0.3;
}

function computeRelevance(gap: IntelligenceGap, inputType: string, objective: string): number {
  const relevance = isDimensionRelevant(gap.dimension, inputType);
  if (relevance === "critical") return 1.0;
  if (relevance === "high") return 0.8;
  if (relevance === "medium") return 0.5;
  return 0.3;
}

// ============================================================================
// STRATEGIC ASSESSMENT SYNTHESIS (LLM)
// ============================================================================

export async function synthesizeStrategicAssessment(
  gaps: IntelligenceGap[],
  actions: NextAction[],
  coverage: EvidenceCoverage[],
  profile: EvidenceProfile,
  target: string,
  inputType: string,
  objective: string
): Promise<{ assessment: string; confidence: number }> {
  const gapsSummary = gaps.slice(0, 10).map((g) =>
    `- [${g.gapClass.toUpperCase()}/${g.severity}] ${g.title}: ${g.whatIsMissing.slice(0, 150)}`
  ).join("\n");

  const actionsSummary = actions.slice(0, 5).map((a) =>
    `- Rank ${a.rank}: ${a.action.slice(0, 150)} (utility: ${(a.expectedUtility * 100).toFixed(0)}%)`
  ).join("\n");

  const coverageSummary = coverage.map((c) =>
    `- ${GAP_DIMENSIONS[c.dimension].label}: ${c.assessment} (${c.coveragePercent}%)`
  ).join("\n");

  const systemPrompt = `You are OSINTiger's Intelligence Gap Analysis strategic assessor. Your job is to produce a concise strategic assessment of the investigation's intelligence gaps.

ABSOLUTE RULES:
1. Base your assessment ONLY on the provided gap analysis data.
2. Be concise (3-5 sentences).
3. Identify the TOP priority gap and why it matters.
4. Explain what the investigation should do NEXT and why.
5. Note any critical blockers to reaching a conclusion.
6. Do NOT hallucinate — use only the provided data.

OUTPUT FORMAT — respond with a single valid JSON object:
{
  "assessment": "3-5 sentence strategic assessment",
  "confidence": 0.7
}`;

  const userPrompt = `INVESTIGATION TARGET: ${target} (type: ${inputType})
OBJECTIVE: ${objective}

EVIDENCE PROFILE:
- Total findings: ${profile.totalFindings}
- Sources consulted: ${profile.totalSources} (${profile.successfulSources.length} successful)
- Average confidence: ${(profile.avgConfidence * 100).toFixed(0)}%
- Low-confidence findings: ${profile.lowConfidenceFindings}
- Single-source findings: ${profile.singleSourceFindings}
- Unresolved contradictions: ${profile.contradictions.length}

IDENTIFIED GAPS (${gaps.length}):
${gapsSummary}

RECOMMENDED NEXT ACTIONS (${actions.length}):
${actionsSummary}

COVERAGE BY DIMENSION:
${coverageSummary}

Produce a strategic assessment of where the investigation stands and what it should do next.`;

  try {
    const zai = await getZai();
    const completion = await withGapTimeout(zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      thinking: { type: "disabled" },
    }));
    const raw = completion.choices?.[0]?.message?.content || "";
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return {
        assessment: String(parsed.assessment || raw.slice(0, 1000)),
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.6,
      };
    } catch {
      return {
        assessment: raw.slice(0, 1000),
        confidence: 0.5,
      };
    }
  } catch (e) {
    return {
      assessment: `Strategic assessment unavailable: ${e instanceof Error ? e.message : "LLM call failed"}. ${gaps.length} gaps identified, ${actions.length} actions recommended. Top priority: ${actions[0]?.action || "none"}.`,
      confidence: 0.3,
    };
  }
}

// ============================================================================
// TOP-LEVEL ORCHESTRATION
// ============================================================================

export async function analyzeGaps(
  sourceResults: SourceResult[],
  report: ReportData | null,
  target: string,
  inputType: string,
  objective: string,
  investigationId: string
): Promise<GapAnalysisReport> {
  const startTime = Date.now();

  // 1. Analyze evidence
  const profile = analyzeEvidence(sourceResults, report, target, inputType);

  // 2. Detect gaps across 16 dimensions
  const gaps = detectGaps(profile, target, inputType, objective);

  // 3. Analyze coverage
  const coverage = analyzeCoverage(profile);

  // 4. Recommend next actions
  const actions = recommendNextActions(gaps, profile, target, inputType, objective);

  // 5. Build known evidence summary
  const knownEvidenceSummary = buildKnownEvidenceSummary(profile, target, inputType);

  // 6. Extract unresolved contradictions
  const unresolvedContradictions = (report?.contradictions || []).map((c) => ({
    topic: c.topic,
    sources: [c.source_a, c.source_b],
    description: `${c.claim_a.slice(0, 100)} vs ${c.claim_b.slice(0, 100)} — ${c.resolution}`,
  }));

  // 7. Extract stale evidence
  const staleEvidence = coverage
    .filter((c) => c.isStale && c.findingsCount > 0)
    .map((c) => ({
      area: GAP_DIMENSIONS[c.dimension].label,
      lastSeen: c.lastEvidenceAge,
      age: c.lastEvidenceAge,
      significance: `Evidence in ${GAP_DIMENSIONS[c.dimension].label} is stale and may not reflect current state.`,
    }));

  // 8. Synthesize strategic assessment
  const strategic = await synthesizeStrategicAssessment(gaps, actions, coverage, profile, target, inputType, objective);

  // 9. Build analysis stats
  const analysisStats = {
    totalGaps: gaps.length,
    criticalGaps: gaps.filter((g) => g.gapClass === "critical").length,
    highValueGaps: gaps.filter((g) => g.gapClass === "high_value").length,
    opportunisticGaps: gaps.filter((g) => g.gapClass === "opportunistic").length,
    dimensionsCovered: coverage.filter((c) => c.coveragePercent > 0).length,
    dimensionsNotCovered: coverage.filter((c) => c.coveragePercent === 0).length,
    avgCoverage: coverage.reduce((s, c) => s + c.coveragePercent, 0) / coverage.length,
    primaryAction: actions[0]?.action.slice(0, 100) || null,
  };

  return {
    investigationId,
    objective,
    target,
    inputType,
    generatedAt: new Date().toISOString(),
    knownEvidenceSummary,
    gaps,
    nextActions: actions,
    coverage,
    unresolvedContradictions,
    staleEvidence,
    analysisStats,
    strategicAssessment: strategic.assessment,
    confidenceInAnalysis: strategic.confidence,
    analysisDurationMs: Date.now() - startTime,
  };
}

function buildKnownEvidenceSummary(profile: EvidenceProfile, target: string, inputType: string): string {
  const parts: string[] = [];
  parts.push(`${profile.totalFindings} findings collected from ${profile.successfulSources.length} successful sources (${profile.totalSources} total consulted).`);
  parts.push(`Average confidence: ${(profile.avgConfidence * 100).toFixed(0)}%.`);
  if (profile.lowConfidenceFindings > 0) {
    parts.push(`${profile.lowConfidenceFindings} low-confidence findings (< 40%).`);
  }
  if (profile.singleSourceFindings > 0) {
    parts.push(`${profile.singleSourceFindings} single-source findings (verification risk).`);
  }
  if (profile.contradictions.length > 0) {
    parts.push(`${profile.contradictions.length} unresolved contradiction(s).`);
  }
  const wellCovered = profile.findingsByDimension.size;
  parts.push(`${wellCovered} of 16 intelligence dimensions have some evidence.`);
  return parts.join(" ");
}
