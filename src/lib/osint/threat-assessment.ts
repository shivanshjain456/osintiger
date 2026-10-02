// AI Threat Assessment Engine — domain models and assessor.
// Produces explainable, evidence-grounded threat assessments with 7 components:
// 1. Risk drivers — factors that increase/reduce threat likelihood and severity
// 2. Evidence — primary, corroborating, indirect with provenance
// 3. Likelihood — probability estimation with reasoning
// 4. Impact — potential consequences (operational, financial, reputational, legal, etc.)
// 5. Confidence — transparent confidence evaluation
// 6. Unknowns — explicit enumeration of what's not known
// 7. Mitigations — prioritized, actionable recommendations

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Risk Driver
// =====================

export type RiskDriverType =
  | "exposed_infrastructure" | "weak_security" | "suspicious_registration"
  | "leaked_credentials" | "anomalous_activity" | "hostile_indicators"
  | "historical_incidents" | "attack_surface" | "third_party_risk"
  | "behavioral_pattern" | "positive_signal";

export type DriverRole = "direct_indicator" | "supporting_signal" | "contextual_factor" | "mitigating_factor";

export interface RiskDriver {
  id: string;
  type: RiskDriverType;
  description: string;
  role: DriverRole;
  /** Impact on threat likelihood (-1 to +1, negative = reduces). */
  impact: number;
  /** Evidence text. */
  evidence: string;
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  confidence: number;
  explanation: string;
}

// =====================
// Threat Scenario
// =====================

export type Likelihood = "very_low" | "low" | "moderate" | "high" | "very_high";
export type ImpactLevel = "negligible" | "low" | "moderate" | "high" | "critical";
export type ConfidenceLevel = "very_low" | "low" | "moderate" | "high" | "very_high";

export interface ThreatScenario {
  id: string;
  name: string;
  description: string;
  likelihood: Likelihood;
  likelihoodReasoning: string;
  impact: ImpactLevel;
  impactDescription: string;
  impactCategories: string[];
  confidence: ConfidenceLevel;
  confidenceReasoning: string;
  driverIds: string[];
  alternativeInterpretations: string[];
}

// =====================
// Evidence Reference
// =====================

export interface EvidenceRef {
  type: "primary" | "corroborating" | "indirect";
  description: string;
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  confidence: number;
  timestamp: string;
}

// =====================
// Unknown Gap
// =====================

export interface UnknownGap {
  area: string;
  description: string;
  impact: string;
  whatWouldHelp: string;
  priority: "low" | "medium" | "high";
}

// =====================
// Mitigation
// =====================

export type MitigationPriority = "immediate" | "short_term" | "medium_term" | "monitoring";
export type MitigationType = "containment" | "investigation" | "hardening" | "monitoring" | "escalation";

export interface Mitigation {
  id: string;
  action: string;
  priority: MitigationPriority;
  type: MitigationType;
  rationale: string;
  driverIds: string[];
  expectedEffectiveness: string;
}

// =====================
// Complete Threat Assessment
// =====================

export interface ThreatAssessment {
  riskDrivers: RiskDriver[];
  scenarios: ThreatScenario[];
  evidence: EvidenceRef[];
  unknowns: UnknownGap[];
  mitigations: Mitigation[];
  overall: {
    threatLevel: "minimal" | "low" | "moderate" | "high" | "critical";
    threatScore: number;
    overallConfidence: ConfidenceLevel;
    overallLikelihood: Likelihood;
    overallImpact: ImpactLevel;
    summary: string;
    explanation: string;
  };
  meta: {
    sourcesAnalyzed: number;
    findingsAnalyzed: number;
    driversIdentified: number;
    scenariosEvaluated: number;
    unknownsIdentified: number;
    mitigationsRecommended: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface ThreatAssessmentApiResponse {
  investigation_id: string;
  assessment: ThreatAssessment;
}

// =====================
// Assessor
// =====================

export function assessThreats(sourceResults: SourceResult[], target: string): ThreatAssessment {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  // 1. Extract risk drivers
  const riskDrivers = extractRiskDrivers(allFindings);

  // 2. Build threat scenarios
  const scenarios = buildScenarios(riskDrivers, allFindings, target);

  // 3. Collect evidence references
  const evidence = collectEvidence(allFindings);

  // 4. Identify unknowns
  const unknowns = identifyUnknowns(riskDrivers, allFindings, successfulResults);

  // 5. Generate mitigations
  const mitigations = generateMitigations(riskDrivers, scenarios);

  // 6. Overall assessment
  const overall = buildOverallAssessment(riskDrivers, scenarios, allFindings);

  return {
    riskDrivers,
    scenarios,
    evidence,
    unknowns,
    mitigations,
    overall,
    meta: {
      sourcesAnalyzed: successfulResults.length,
      findingsAnalyzed: allFindings.length,
      driversIdentified: riskDrivers.length,
      scenariosEvaluated: scenarios.length,
      unknownsIdentified: unknowns.length,
      mitigationsRecommended: mitigations.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Risk Driver Extraction
// =====================

function extractRiskDrivers(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): RiskDriver[] {
  const drivers: RiskDriver[] = [];

  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    const lower = text.toLowerCase();

    // Exposed infrastructure
    if (/\b(?:open\s+port|exposed|publicly\s+accessible|unprotected|unauthenticated)\b/i.test(text)) {
      drivers.push({
        id: `drv_${drivers.length}`,
        type: "exposed_infrastructure",
        description: `Exposed infrastructure detected: ${text.slice(0, 80)}`,
        role: "direct_indicator",
        impact: 0.7,
        evidence: text.slice(0, 150),
        source, sourceLabel, tier,
        confidence: finding.confidence,
        explanation: "Exposed infrastructure increases attack surface and provides direct entry points for adversaries.",
      });
    }

    // Weak security
    if (/\b(?:missing\s+security\s+header|no\s+hsts|no\s+csp|weak\s+ssl|expired\s+cert|self[- ]signed|vulnerable|outdated)\b/i.test(text)) {
      drivers.push({
        id: `drv_${drivers.length}`,
        type: "weak_security",
        description: `Security weakness detected: ${text.slice(0, 80)}`,
        role: "direct_indicator",
        impact: 0.6,
        evidence: text.slice(0, 150),
        source, sourceLabel, tier,
        confidence: finding.confidence,
        explanation: "Security weaknesses can be exploited by attackers to compromise systems or data.",
      });
    }

    // Hostile indicators
    if (/\b(?:malicious|malware|phishing|scam|fraud|abuse|threat|attack|exploit|suspicious)\b/i.test(text)) {
      drivers.push({
        id: `drv_${drivers.length}`,
        type: "hostile_indicators",
        description: `Hostile indicator detected: ${text.slice(0, 80)}`,
        role: "direct_indicator",
        impact: 0.8,
        evidence: text.slice(0, 150),
        source, sourceLabel, tier,
        confidence: finding.confidence,
        explanation: "Direct hostile indicators suggest active or potential threat activity targeting the entity.",
      });
    }

    // Suspicious registration
    if (/\b(?:recently\s+registered|newly\s+created|short\s+registration|privacy\s+protected|whois\s+hidden)\b/i.test(text)) {
      drivers.push({
        id: `drv_${drivers.length}`,
        type: "suspicious_registration",
        description: `Suspicious registration pattern: ${text.slice(0, 80)}`,
        role: "supporting_signal",
        impact: 0.5,
        evidence: text.slice(0, 150),
        source, sourceLabel, tier,
        confidence: finding.confidence,
        explanation: "Suspicious registration patterns are commonly associated with malicious infrastructure setup.",
      });
    }

    // Attack surface
    if (/\b(?:subdomain|admin\s+portal|api\s+endpoint|development\s+server|staging)\b/i.test(text)) {
      drivers.push({
        id: `drv_${drivers.length}`,
        type: "attack_surface",
        description: `Attack surface expansion: ${text.slice(0, 80)}`,
        role: "contextual_factor",
        impact: 0.4,
        evidence: text.slice(0, 150),
        source, sourceLabel, tier,
        confidence: finding.confidence,
        explanation: "Additional attack surface assets provide more potential entry points for adversaries.",
      });
    }

    // Positive signals (mitigating factors)
    if (/\b(?:secure|protected|encrypted|hsts|csp|security\s+header|firewall|waf|ddos\s+protection)\b/i.test(text)) {
      drivers.push({
        id: `drv_${drivers.length}`,
        type: "positive_signal",
        description: `Positive security signal: ${text.slice(0, 80)}`,
        role: "mitigating_factor",
        impact: -0.3,
        evidence: text.slice(0, 150),
        source, sourceLabel, tier,
        confidence: finding.confidence,
        explanation: "Security measures reduce threat likelihood by implementing defensive controls.",
      });
    }
  }

  // Deduplicate by type + description prefix
  const seen = new Set<string>();
  return drivers.filter((d) => {
    const key = `${d.type}|${d.description.slice(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =====================
// Scenario Builder
// =====================

function buildScenarios(drivers: RiskDriver[], findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[], target: string): ThreatScenario[] {
  const scenarios: ThreatScenario[] = [];

  // Calculate aggregate impact
  const positiveDrivers = drivers.filter((d) => d.impact < 0);
  const negativeDrivers = drivers.filter((d) => d.impact > 0);
  const totalImpact = negativeDrivers.reduce((s, d) => s + d.impact, 0) + positiveDrivers.reduce((s, d) => s + d.impact, 0);

  // Scenario 1: Active threat (if hostile indicators present)
  const hostileDrivers = drivers.filter((d) => d.type === "hostile_indicators");
  if (hostileDrivers.length > 0) {
    const likelihood: Likelihood = hostileDrivers.length >= 3 ? "high" : hostileDrivers.length >= 1 ? "moderate" : "low";
    scenarios.push({
      id: "scn_active_threat",
      name: "Active Threat Activity",
      description: `${target} shows indicators of active or recent threat activity based on ${hostileDrivers.length} hostile indicator(s) from intelligence sources.`,
      likelihood,
      likelihoodReasoning: `${hostileDrivers.length} hostile indicators detected from ${new Set(hostileDrivers.map((d) => d.sourceLabel)).size} source(s). ` +
        `Indicators include: ${hostileDrivers.slice(0, 3).map((d) => d.description.slice(0, 40)).join("; ")}. ` +
        `Higher indicator count and source diversity increase confidence in active threat assessment.`,
      impact: "high",
      impactDescription: "Active threat activity could result in data compromise, service disruption, or further exploitation if not contained.",
      impactCategories: ["security_compromise", "operational_disruption", "data_loss"],
      confidence: hostileDrivers[0].tier >= 4 ? "high" : hostileDrivers[0].tier >= 3 ? "moderate" : "low",
      confidenceReasoning: `Assessment based on tier ${hostileDrivers[0].tier} sources. ` +
        `${hostileDrivers.length} corroborating indicators from ${new Set(hostileDrivers.map((d) => d.source)).size} distinct sources.`,
      driverIds: hostileDrivers.map((d) => d.id),
      alternativeInterpretations: [
        "Indicators may be historical rather than currently active",
        "Indicators may represent scan noise rather than targeted activity",
        "Domain/IP may be shared with other entities, attributing threat to wrong target",
      ],
    });
  }

  // Scenario 2: Infrastructure exposure (if exposed infrastructure or attack surface)
  const exposureDrivers = drivers.filter((d) => d.type === "exposed_infrastructure" || d.type === "attack_surface");
  if (exposureDrivers.length > 0) {
    const likelihood: Likelihood = exposureDrivers.length >= 3 ? "moderate" : "low";
    scenarios.push({
      id: "scn_infra_exposure",
      name: "Infrastructure Exploitation Risk",
      description: `${target} has ${exposureDrivers.length} exposed infrastructure asset(s) that could be exploited by adversaries.`,
      likelihood,
      likelihoodReasoning: `${exposureDrivers.length} exposed assets identified. While exposure doesn't guarantee exploitation, each asset represents an attack vector. ` +
        `The risk increases with the number and sensitivity of exposed assets.`,
      impact: "moderate",
      impactDescription: "Infrastructure exploitation could lead to unauthorized access, data exfiltration, or service disruption.",
      impactCategories: ["security_compromise", "operational_disruption"],
      confidence: exposureDrivers[0].tier >= 3 ? "moderate" : "low",
      confidenceReasoning: `Based on ${exposureDrivers.length} infrastructure findings from tier ${exposureDrivers[0].tier}+ sources.`,
      driverIds: exposureDrivers.map((d) => d.id),
      alternativeInterpretations: [
        "Exposed assets may have additional access controls not visible in OSINT",
        "Assets may be honeypots or intentionally exposed for legitimate purposes",
      ],
    });
  }

  // Scenario 3: Security weakness exploitation
  const weakDrivers = drivers.filter((d) => d.type === "weak_security");
  if (weakDrivers.length > 0) {
    scenarios.push({
      id: "scn_security_weakness",
      name: "Security Weakness Exploitation",
      description: `${target} has ${weakDrivers.length} security weakness(es) that could be exploited.`,
      likelihood: weakDrivers.length >= 2 ? "moderate" : "low",
      likelihoodReasoning: `${weakDrivers.length} security weaknesses detected. ` +
        `Known weaknesses are commonly targeted by both opportunistic and targeted attackers.`,
      impact: "moderate",
      impactDescription: "Exploitation of security weaknesses could lead to compromise of confidentiality, integrity, or availability.",
      impactCategories: ["security_compromise", "privacy_harm"],
      confidence: weakDrivers[0].tier >= 3 ? "moderate" : "low",
      confidenceReasoning: `Based on ${weakDrivers.length} security findings. Weaknesses are directly observable, increasing confidence.`,
      driverIds: weakDrivers.map((d) => d.id),
      alternativeInterpretations: [
        "Weaknesses may have been remediated since data collection",
        "Compensating controls may mitigate the risk",
      ],
    });
  }

  // Scenario 4: Low threat (if mostly positive signals)
  if (scenarios.length === 0 && positiveDrivers.length > negativeDrivers.length) {
    scenarios.push({
      id: "scn_low_threat",
      name: "Low Threat Profile",
      description: `${target} shows predominantly positive security signals with minimal risk indicators.`,
      likelihood: "very_low",
      likelihoodReasoning: `No direct threat indicators detected. ${positiveDrivers.length} positive security signals observed. ` +
        `The target appears to maintain reasonable security posture based on available evidence.`,
      impact: "negligible",
      impactDescription: "No significant threats identified based on current evidence.",
      impactCategories: [],
      confidence: positiveDrivers.length >= 3 ? "moderate" : "low",
      confidenceReasoning: `Based on ${positiveDrivers.length} positive signals. However, absence of evidence is not evidence of absence.`,
      driverIds: positiveDrivers.map((d) => d.id),
      alternativeInterpretations: [
        "Threat indicators may exist but were not captured by available sources",
        "Novel attack vectors may not be reflected in collected evidence",
      ],
    });
  }

  return scenarios;
}

// =====================
// Evidence Collection
// =====================

function collectEvidence(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): EvidenceRef[] {
  const evidence: EvidenceRef[] = [];
  const seen = new Set<string>();

  for (const { finding, source, sourceLabel, tier } of findings) {
    const key = `${source}|${finding.data.slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    evidence.push({
      type: tier >= 4 ? "primary" : tier >= 3 ? "corroborating" : "indirect",
      description: finding.data.slice(0, 120),
      source, sourceLabel, tier,
      confidence: finding.confidence,
      timestamp: finding.timestamp,
    });
  }

  return evidence.slice(0, 30); // Cap for tractability
}

// =====================
// Unknown Identification
// =====================

function identifyUnknowns(
  drivers: RiskDriver[],
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  results: SourceResult[]
): UnknownGap[] {
  const unknowns: UnknownGap[] = [];
  const sourcesUsed = new Set(results.map((r) => r.source));

  // Check for missing source categories
  if (!sourcesUsed.has("abuseipdb") && !sourcesUsed.has("virustotal")) {
    unknowns.push({
      area: "Threat intelligence coverage",
      description: "No dedicated threat intelligence sources (AbuseIPDB, VirusTotal) were queried or returned data.",
      impact: "Threat assessment may underestimate active threat indicators.",
      whatWouldHelp: "Query AbuseIPDB and VirusTotal for reputation data on the target's IPs and domains.",
      priority: "high",
    });
  }

  if (!sourcesUsed.has("shodan_internetdb") && !sourcesUsed.has("threat_intel")) {
    unknowns.push({
      area: "Port and service intelligence",
      description: "No Shodan or threat intel port scanning data available.",
      impact: "Cannot assess open ports and services that may be exploitable.",
      whatWouldHelp: "Query Shodan InternetDB for the target's IP addresses to identify open ports.",
      priority: "medium",
    });
  }

  // Check for stale data
  const oldFindings = findings.filter((f) => {
    const age = Date.now() - new Date(f.finding.timestamp).getTime();
    return age > 90 * 24 * 60 * 60 * 1000; // > 90 days
  });
  if (oldFindings.length > findings.length * 0.5) {
    unknowns.push({
      area: "Data freshness",
      description: `${oldFindings.length} of ${findings.length} findings are older than 90 days.`,
      impact: "Assessment may not reflect current state of the target.",
      whatWouldHelp: "Re-run the investigation to collect fresh data.",
      priority: "medium",
    });
  }

  // Check for low-confidence drivers
  const lowConfDrivers = drivers.filter((d) => d.confidence < 0.5);
  if (lowConfDrivers.length > 0) {
    unknowns.push({
      area: "Risk driver confidence",
      description: `${lowConfDrivers.length} risk drivers have low confidence (<50%).`,
      impact: "Low-confidence drivers may represent false positives or incomplete evidence.",
      whatWouldHelp: "Cross-verify low-confidence findings with additional sources.",
      priority: "low",
    });
  }

  // General unknown
  if (drivers.length === 0) {
    unknowns.push({
      area: "Threat assessment coverage",
      description: "No risk drivers were identified from available evidence.",
      impact: "Cannot produce a meaningful threat assessment without risk indicators.",
      whatWouldHelp: "Expand source coverage and re-run the investigation.",
      priority: "high",
    });
  }

  return unknowns;
}

// =====================
// Mitigation Generation
// =====================

function generateMitigations(drivers: RiskDriver[], scenarios: ThreatScenario[]): Mitigation[] {
  const mitigations: Mitigation[] = [];

  // Immediate mitigations for hostile indicators
  const hostileDrivers = drivers.filter((d) => d.type === "hostile_indicators");
  if (hostileDrivers.length > 0) {
    mitigations.push({
      id: "mit_immediate_threat",
      action: "Investigate and respond to hostile indicators immediately",
      priority: "immediate",
      type: "containment",
      rationale: `${hostileDrivers.length} hostile indicators detected — potential active threat requires immediate attention.`,
      driverIds: hostileDrivers.map((d) => d.id),
      expectedEffectiveness: "High — direct investigation can confirm or rule out active threats.",
    });
  }

  // Short-term: address exposed infrastructure
  const exposedDrivers = drivers.filter((d) => d.type === "exposed_infrastructure");
  if (exposedDrivers.length > 0) {
    mitigations.push({
      id: "mit_exposed_infra",
      action: "Review and restrict access to exposed infrastructure assets",
      priority: "short_term",
      type: "hardening",
      rationale: `${exposedDrivers.length} exposed assets should be assessed for necessity and access controls.`,
      driverIds: exposedDrivers.map((d) => d.id),
      expectedEffectiveness: "Medium — restricting access reduces attack surface significantly.",
    });
  }

  // Short-term: address security weaknesses
  const weakDrivers = drivers.filter((d) => d.type === "weak_security");
  if (weakDrivers.length > 0) {
    mitigations.push({
      id: "mit_security_weak",
      action: "Remediate identified security weaknesses (missing headers, expired certs, etc.)",
      priority: "short_term",
      type: "hardening",
      rationale: `${weakDrivers.length} security weaknesses should be remediated to reduce exploitation risk.`,
      driverIds: weakDrivers.map((d) => d.id),
      expectedEffectiveness: "High — direct remediation eliminates the weakness.",
    });
  }

  // Medium-term: monitoring
  if (drivers.length > 0) {
    mitigations.push({
      id: "mit_monitoring",
      action: "Establish continuous monitoring for changes in the target's attack surface",
      priority: "medium_term",
      type: "monitoring",
      rationale: "Continuous monitoring ensures new risks are detected promptly.",
      driverIds: drivers.map((d) => d.id),
      expectedEffectiveness: "Medium — early detection enables faster response to emerging threats.",
    });
  }

  // Escalation if critical scenario
  const criticalScenario = scenarios.find((s) => s.likelihood === "high" || s.likelihood === "very_high");
  if (criticalScenario) {
    mitigations.push({
      id: "mit_escalation",
      action: "Escalate to security leadership and initiate incident response procedures",
      priority: "immediate",
      type: "escalation",
      rationale: `High-likelihood threat scenario detected: ${criticalScenario.name}`,
      driverIds: criticalScenario.driverIds,
      expectedEffectiveness: "Critical — ensures organizational awareness and resource allocation.",
    });
  }

  return mitigations;
}

// =====================
// Overall Assessment
// =====================

function buildOverallAssessment(
  drivers: RiskDriver[],
  scenarios: ThreatScenario[],
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]
): ThreatAssessment["overall"] {
  const positiveDrivers = drivers.filter((d) => d.impact < 0);
  const negativeDrivers = drivers.filter((d) => d.impact > 0);
  const totalImpact = negativeDrivers.reduce((s, d) => s + d.impact, 0) + positiveDrivers.reduce((s, d) => s + d.impact, 0);

  // Threat score: 0-100
  const threatScore = Math.max(0, Math.min(100, Math.round(totalImpact * 30 + negativeDrivers.length * 5)));

  const threatLevel: ThreatAssessment["overall"]["threatLevel"] =
    threatScore >= 80 ? "critical" :
    threatScore >= 60 ? "high" :
    threatScore >= 40 ? "moderate" :
    threatScore >= 20 ? "low" : "minimal";

  // Overall likelihood: highest scenario likelihood
  const likelihoodOrder: Likelihood[] = ["very_low", "low", "moderate", "high", "very_high"];
  const overallLikelihood = scenarios.length > 0
    ? scenarios.reduce((max, s) => {
        return likelihoodOrder.indexOf(s.likelihood) > likelihoodOrder.indexOf(max) ? s.likelihood : max;
      }, "very_low" as Likelihood)
    : "very_low";

  // Overall impact: highest scenario impact
  const impactOrder: ImpactLevel[] = ["negligible", "low", "moderate", "high", "critical"];
  const overallImpact = scenarios.length > 0
    ? scenarios.reduce((max, s) => {
        return impactOrder.indexOf(s.impact) > impactOrder.indexOf(max) ? s.impact : max;
      }, "negligible" as ImpactLevel)
    : "negligible";

  // Overall confidence
  const avgConfidence = findings.length > 0
    ? findings.reduce((s, f) => s + f.finding.confidence, 0) / findings.length
    : 0;
  const overallConfidence: ConfidenceLevel =
    avgConfidence >= 0.8 ? "high" :
    avgConfidence >= 0.6 ? "moderate" :
    avgConfidence >= 0.4 ? "low" : "very_low";

  const summary = `Threat level: ${threatLevel.toUpperCase()} (${threatScore}/100). ` +
    `${negativeDrivers.length} risk-increasing drivers, ${positiveDrivers.length} mitigating factors. ` +
    `${scenarios.length} threat scenario(s) evaluated. ` +
    `Overall likelihood: ${overallLikelihood.toUpperCase()}, impact: ${overallImpact.toUpperCase()}, confidence: ${overallConfidence.toUpperCase()}.`;

  const explanation = `Threat assessment based on ${findings.length} findings from ${new Set(findings.map((f) => f.source)).size} sources. ` +
    `${drivers.length} risk drivers identified (${negativeDrivers.length} increasing, ${positiveDrivers.length} mitigating). ` +
    `The assessment considers source credibility, evidence freshness, cross-source corroboration, and alternative interpretations. ` +
    `${threatScore >= 60 ? "This target requires immediate attention due to significant threat indicators." : "Threat level is manageable but monitoring is recommended."}`;

  return {
    threatLevel,
    threatScore,
    overallConfidence,
    overallLikelihood,
    overallImpact,
    summary,
    explanation,
  };
}
