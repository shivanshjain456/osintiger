// Digital Footprint Score Engine — domain models and calculator.
// Calculates a comprehensive exposure score using 6 dimensions:
// 1. Public Exposure — visibility across OSINT sources
// 2. Infrastructure Footprint — DNS, IPs, certificates, ASNs, hosting
// 3. Security Posture — inverse of security header coverage
// 4. Data Leak Exposure — breach/leak/sanctions/threat intel mentions
// 5. Social Presence — social platforms, community sites, archives
// 6. Open Assets — repositories, packages, documents, archives
//
// Higher overall score = more exposed = higher risk.

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Dimension Model
// =====================

export interface FootprintDimension {
  name: string;
  /** Score 0-100 (higher = more exposure/risk). */
  score: number;
  /** Risk level. */
  riskLevel: "minimal" | "low" | "moderate" | "high" | "critical";
  /** Explanation of how the score was computed. */
  explanation: string;
  /** Contributing factors. */
  factors: { label: string; value: string; impact: number }[];
}

// =====================
// Complete Footprint Report
// =====================

export interface FootprintReport {
  /** Overall exposure score (0-100). */
  overall: number;
  /** Overall risk level. */
  overallRiskLevel: FootprintDimension["riskLevel"];
  /** Overall explanation. */
  overallExplanation: string;
  /** Individual dimensions. */
  dimensions: {
    publicExposure: FootprintDimension;
    infrastructureFootprint: FootprintDimension;
    securityPosture: FootprintDimension;
    dataLeakExposure: FootprintDimension;
    socialPresence: FootprintDimension;
    openAssets: FootprintDimension;
  };
  /** Summary of key metrics. */
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
  /** Exposure breakdown by category. */
  exposureBreakdown: { category: string; count: number; percentage: number }[];
  /** Metadata. */
  meta: {
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface FootprintApiResponse {
  investigation_id: string;
  report: FootprintReport;
}

// =====================
// Calculator
// =====================

export function computeFootprint(sourceResults: SourceResult[]): FootprintReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const totalFindings = successfulResults.reduce((s, sr) => s + sr.findings.length, 0);

  // Collect all findings with source metadata
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];
  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  // Compute each dimension
  const publicExposure = computePublicExposure(successfulResults, totalFindings, allFindings);
  const infrastructureFootprint = computeInfrastructureFootprint(allFindings);
  const securityPosture = computeSecurityPosture(allFindings);
  const dataLeakExposure = computeDataLeakExposure(allFindings);
  const socialPresence = computeSocialPresence(allFindings);
  const openAssets = computeOpenAssets(allFindings);

  // Overall = weighted combination
  const weights = {
    publicExposure: 0.20,
    infrastructureFootprint: 0.20,
    securityPosture: 0.20,
    dataLeakExposure: 0.20,
    socialPresence: 0.10,
    openAssets: 0.10,
  };

  const overall = Math.round(
    publicExposure.score * weights.publicExposure +
    infrastructureFootprint.score * weights.infrastructureFootprint +
    securityPosture.score * weights.securityPosture +
    dataLeakExposure.score * weights.dataLeakExposure +
    socialPresence.score * weights.socialPresence +
    openAssets.score * weights.openAssets
  );

  const overallRiskLevel = getRiskLevel(overall);
  const overallExplanation = buildOverallExplanation(overall, overallRiskLevel, [
    publicExposure, infrastructureFootprint, securityPosture,
    dataLeakExposure, socialPresence, openAssets,
  ]);

  // Compute key metrics
  const uniqueIPs = countUniqueIPs(allFindings);
  const dnsRecords = countDNSRecords(allFindings);
  const certificates = countCertificates(allFindings);
  const technologies = countTechnologies(allFindings);
  const securityHeaders = countSecurityHeaders(allFindings);
  const leakMentions = countLeakMentions(allFindings);
  const socialMentions = countSocialMentions(allFindings);
  const openAssetCount = countOpenAssets(allFindings);

  const exposureBreakdown = buildExposureBreakdown(allFindings);

  return {
    overall,
    overallRiskLevel,
    overallExplanation,
    dimensions: {
      publicExposure,
      infrastructureFootprint,
      securityPosture,
      dataLeakExposure,
      socialPresence,
      openAssets,
    },
    metrics: {
      totalSources: sourceResults.length,
      successfulSources: successfulResults.length,
      totalFindings,
      uniqueIPs,
      dnsRecords,
      certificates,
      technologies,
      securityHeadersPresent: securityHeaders.present,
      securityHeadersMissing: securityHeaders.missing,
      leakMentions,
      socialMentions,
      openAssets: openAssetCount,
    },
    exposureBreakdown,
    meta: {
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Dimension: Public Exposure
// =====================

function computePublicExposure(
  results: SourceResult[],
  totalFindings: number,
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]
): FootprintDimension {
  const sourceCount = results.length;
  // Score based on source count + finding volume
  const sourceScore = Math.min(sourceCount * 5, 50);
  const findingScore = Math.min(totalFindings * 0.5, 50);
  const score = Math.min(sourceScore + findingScore, 100);

  const factors = [
    { label: "Sources queried", value: `${sourceCount}`, impact: sourceScore },
    { label: "Findings collected", value: `${totalFindings}`, impact: findingScore },
    { label: "Mentions in search results", value: `${findings.filter((f) => f.source === "web_search" || f.source === "duckduckgo").length}`, impact: Math.min(findings.filter((f) => f.source === "web_search" || f.source === "duckduckgo").length * 2, 20) },
  ];

  const explanation = `${sourceCount} sources queried, ${totalFindings} findings collected. ` +
    `Higher source count and finding volume indicate greater public visibility.`;

  return { name: "Public Exposure", score, riskLevel: getRiskLevel(score), explanation, factors };
}

// =====================
// Dimension: Infrastructure Footprint
// =====================

function computeInfrastructureFootprint(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]
): FootprintDimension {
  const uniqueIPs = countUniqueIPs(findings);
  const dnsRecords = countDNSRecords(findings);
  const certificates = countCertificates(findings);
  const technologies = countTechnologies(findings);

  const ipScore = Math.min(uniqueIPs * 8, 30);
  const dnsScore = Math.min(dnsRecords * 4, 25);
  const certScore = Math.min(certificates * 10, 20);
  const techScore = Math.min(technologies * 5, 25);
  const score = Math.min(ipScore + dnsScore + certScore + techScore, 100);

  const factors = [
    { label: "Unique IP addresses", value: `${uniqueIPs}`, impact: ipScore },
    { label: "DNS records", value: `${dnsRecords}`, impact: dnsScore },
    { label: "Certificates", value: `${certificates}`, impact: certScore },
    { label: "Technologies detected", value: `${technologies}`, impact: techScore },
  ];

  const explanation = `${uniqueIPs} IPs, ${dnsRecords} DNS records, ${certificates} certificates, ${technologies} technologies. ` +
    `More infrastructure assets = larger attack surface.`;

  return { name: "Infrastructure Footprint", score, riskLevel: getRiskLevel(score), explanation, factors };
}

// =====================
// Dimension: Security Posture (inverse — lower security = higher exposure)
// =====================

function computeSecurityPosture(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]
): FootprintDimension {
  const securityHeaders = ["content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "x-xss-protection"];
  const allText = findings.map((f) => f.finding.data).join("\n").toLowerCase();

  let present = 0;
  let missing = 0;
  for (const header of securityHeaders) {
    if (allText.includes(header)) present++;
    else missing++;
  }

  // Exposure = inverse of security (100 - coverage%)
  const coverage = (present / securityHeaders.length) * 100;
  const score = Math.round(100 - coverage);

  const factors = [
    { label: "Security headers present", value: `${present}/${securityHeaders.length}`, impact: -Math.round(coverage) },
    { label: "Security headers missing", value: `${missing}`, impact: score },
  ];

  const explanation = `${present}/${securityHeaders.length} security headers present (${coverage.toFixed(0)}% coverage). ` +
    `Missing headers increase exposure to attacks. ` +
    `${missing > 0 ? `Missing: ${securityHeaders.filter((h) => !allText.includes(h)).join(", ")}` : "All headers present."}`;

  return { name: "Security Posture", score, riskLevel: getRiskLevel(score), explanation, factors };
}

// =====================
// Dimension: Data Leak Exposure
// =====================

function computeDataLeakExposure(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]
): FootprintDimension {
  // Count findings from leak/breach/sanctions/threat sources
  const leakSources = ["ofac", "opensanctions", "interpol", "icij", "abuseipdb", "virustotal", "threatfox", "urlhaus", "malwarebazaar", "otx", "greynoise", "bitcoinabuse", "hashrep"];
  const leakFindings = findings.filter((f) => leakSources.includes(f.source));
  const leakCount = leakFindings.length;

  // Also check for keywords
  const leakKeywords = findings.filter((f) =>
    /\b(?:breach|leak|compromis|exposed|stolen|dumped|malicious|threat|abuse|sanction|wanted|fraud|scam)\b/i.test(f.finding.data)
  );

  const totalLeakIndicators = leakCount + leakKeywords.length;
  const score = Math.min(totalLeakIndicators * 10, 100);

  const factors = [
    { label: "Threat intel findings", value: `${leakCount}`, impact: Math.min(leakCount * 10, 60) },
    { label: "Risk keyword mentions", value: `${leakKeywords.length}`, impact: Math.min(leakKeywords.length * 5, 40) },
  ];

  const explanation = `${leakCount} findings from threat/leak/sanctions sources, ${leakKeywords.length} findings with risk keywords. ` +
    `${totalLeakIndicators > 0 ? "Entity has exposure to data leaks or threat intelligence." : "No leak or threat exposure detected."}`;

  return { name: "Data Leak Exposure", score, riskLevel: getRiskLevel(score), explanation, factors };
}

// =====================
// Dimension: Social Presence
// =====================

function computeSocialPresence(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]
): FootprintDimension {
  const socialSources = ["github", "gitlab", "reddit", "wikipedia", "hackernews", "duckduckgo", "web_search", "whatsmyname", "usernamesearch", "stackexchange"];
  const socialFindings = findings.filter((f) => socialSources.includes(f.source));
  const count = socialFindings.length;

  const score = Math.min(count * 5, 100);

  const factors = [
    { label: "Social/community sources", value: `${new Set(socialFindings.map((f) => f.source)).size}`, impact: Math.min(new Set(socialFindings.map((f) => f.source)).size * 10, 50) },
    { label: "Social findings", value: `${count}`, impact: Math.min(count * 3, 50) },
  ];

  const explanation = `${count} findings from ${new Set(socialFindings.map((f) => f.source)).size} social/community sources. ` +
    `Greater social presence increases digital footprint visibility.`;

  return { name: "Social Presence", score, riskLevel: getRiskLevel(score), explanation, factors };
}

// =====================
// Dimension: Open Assets
// =====================

function computeOpenAssets(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]
): FootprintDimension {
  const assetSources = ["github", "gitlab", "npm", "pypi", "archiveorg", "wayback"];
  const assetFindings = findings.filter((f) => assetSources.includes(f.source));
  const count = assetFindings.length;

  const score = Math.min(count * 8, 100);

  const factors = [
    { label: "Repository/package sources", value: `${new Set(assetFindings.map((f) => f.source)).size}`, impact: Math.min(new Set(assetFindings.map((f) => f.source)).size * 15, 60) },
    { label: "Open asset findings", value: `${count}`, impact: Math.min(count * 4, 40) },
  ];

  const explanation = `${count} findings from ${new Set(assetFindings.map((f) => f.source)).size} open asset sources (repositories, packages, archives). ` +
    `Publicly accessible assets increase exposure.`;

  return { name: "Open Assets", score, riskLevel: getRiskLevel(score), explanation, factors };
}

// =====================
// Helper Functions
// =====================

function getRiskLevel(score: number): FootprintDimension["riskLevel"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "moderate";
  if (score >= 20) return "low";
  return "minimal";
}

function countUniqueIPs(findings: { finding: NormalizedFinding }[]): number {
  const ips = new Set<string>();
  for (const { finding } of findings) {
    const matches = finding.data.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g);
    for (const m of matches) {
      if (!isPrivateIP(m[1])) ips.add(m[1]);
    }
  }
  return ips.size;
}

function countDNSRecords(findings: { finding: NormalizedFinding }[]): number {
  let count = 0;
  for (const { finding } of findings) {
    if (/DNS\s+(A|AAAA|MX|NS|TXT|CNAME)\s+record/i.test(finding.data)) count++;
  }
  return count;
}

function countCertificates(findings: { finding: NormalizedFinding; source: string }[]): number {
  return findings.filter((f) => f.source === "crtsh" || /certificate|ssl|tls/i.test(f.finding.data)).length;
}

function countTechnologies(findings: { finding: NormalizedFinding }[]): number {
  const techKeywords = /\b(nginx|apache|varnish|wordpress|cloudflare|php|node\.?js|python|react|hsts|csp|x-frame-options)\b/i;
  const techs = new Set<string>();
  for (const { finding } of findings) {
    const matches = finding.data.matchAll(/\b(nginx|apache|varnish|wordpress|cloudflare|php|node\.?js|python|react|hsts|csp|x-frame-options)\b/gi);
    for (const m of matches) techs.add(m[1].toLowerCase());
  }
  return techs.size;
}

function countSecurityHeaders(findings: { finding: NormalizedFinding }[]): { present: number; missing: number } {
  const headers = ["content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "x-xss-protection"];
  const allText = findings.map((f) => f.finding.data).join("\n").toLowerCase();
  let present = 0;
  for (const h of headers) if (allText.includes(h)) present++;
  return { present, missing: headers.length - present };
}

function countLeakMentions(findings: { finding: NormalizedFinding; source: string }[]): number {
  const leakSources = ["ofac", "opensanctions", "interpol", "icij", "abuseipdb", "virustotal", "threatfox", "urlhaus", "malwarebazaar", "otx", "greynoise", "bitcoinabuse", "hashrep"];
  return findings.filter((f) => leakSources.includes(f.source)).length;
}

function countSocialMentions(findings: { finding: NormalizedFinding; source: string }[]): number {
  const socialSources = ["github", "gitlab", "reddit", "wikipedia", "hackernews", "duckduckgo", "web_search", "whatsmyname", "usernamesearch", "stackexchange"];
  return findings.filter((f) => socialSources.includes(f.source)).length;
}

function countOpenAssets(findings: { finding: NormalizedFinding; source: string }[]): number {
  const assetSources = ["github", "gitlab", "npm", "pypi", "archiveorg", "wayback"];
  return findings.filter((f) => assetSources.includes(f.source)).length;
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

function buildExposureBreakdown(findings: { finding: NormalizedFinding; source: string }[]): { category: string; count: number; percentage: number }[] {
  const categories: Record<string, number> = {};
  const total = findings.length;
  for (const { source } of findings) {
    const cat = categorizeSource(source);
    categories[cat] = (categories[cat] || 0) + 1;
  }
  return Object.entries(categories)
    .map(([category, count]) => ({ category, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

function categorizeSource(source: string): string {
  if (["crtsh", "doh", "dns_google", "openrdap", "domainsdb"].includes(source)) return "DNS/Cert";
  if (["ipinfo", "ipquery", "ipwhois", "ipapico", "freeipapi", "bgpview", "peeringdb"].includes(source)) return "Network";
  if (["nvd", "osv", "cveorg", "cisa_kev", "shodan_cvedb", "epss"].includes(source)) return "Vulnerability";
  if (["otx", "abuseipdb", "virustotal", "greynoise", "threatfox", "urlhaus", "malwarebazaar"].includes(source)) return "Threat Intel";
  if (["ofac", "opensanctions", "interpol", "icij"].includes(source)) return "Sanctions";
  if (["edgar", "opencorporates", "gleif", "fec", "usaspending"].includes(source)) return "Corporate";
  if (["github", "gitlab", "reddit", "wikipedia", "stackexchange", "whatsmyname"].includes(source)) return "Social/Dev";
  if (["gdelt", "googlenews", "wikinews", "hackernews", "duckduckgo"].includes(source)) return "News/Search";
  if (["wayback", "archiveorg"].includes(source)) return "Archive";
  if (["mailcheck", "gravatar", "emailmx"].includes(source)) return "Email";
  return "Other";
}

function buildOverallExplanation(
  overall: number,
  riskLevel: FootprintDimension["riskLevel"],
  dimensions: FootprintDimension[]
): string {
  const level = riskLevel.toUpperCase();
  const dimSummary = dimensions.map((d) => `${d.name}: ${d.score}/100 (${d.riskLevel})`).join(", ");
  return `Overall digital footprint exposure is ${level} (${overall}/100). ` +
    `Dimension breakdown: ${dimSummary}. ` +
    `${overall >= 60 ? "This entity has a significant digital footprint that may require attention." : "The digital footprint is manageable but monitoring is recommended."}`;
}
