// Certificate Intelligence Engine — domain models and analyzer.
// Analyzes digital certificates as first-class investigative artifacts across 7 dimensions:
// 1. Issuers — CA identification, chain normalization, issuer reuse
// 2. SANs — Subject Alternative Name extraction, domain correlation
// 3. Historical certificates — temporal record, issuance/expiration tracking
// 4. Reuse — certificate reuse across domains, shared fingerprints
// 5. Wildcards — wildcard cert detection, scope analysis
// 6. Shared infrastructure — infrastructure inference from cert metadata
// 7. Certificate graph — graph representation linking certs to domains/IPs/issuers

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Certificate Entry
// =====================

export interface CertificateEntry {
  id: string;
  /** Domains covered by this certificate (from SANs or CN). */
  domains: string[];
  /** Wildcard domains (e.g., *.example.com). */
  wildcardDomains: string[];
  /** Issuer (CA name). */
  issuer: string;
  /** Issuer type. */
  issuerType: "public_ca" | "private_ca" | "self_signed" | "unknown";
  /** Whether this is a wildcard certificate. */
  isWildcard: boolean;
  /** Source. */
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  /** Evidence text. */
  evidence: string;
  /** Confidence. */
  confidence: number;
}

// =====================
// Issuer Analysis
// =====================

export interface IssuerInfo {
  name: string;
  type: CertificateEntry["issuerType"];
  certCount: number;
  domainsCovered: string[];
  /** Whether this issuer is used across multiple assets (reuse). */
  reusedAcrossAssets: boolean;
}

export interface IssuerAnalysis {
  issuers: IssuerInfo[];
  uniqueIssuers: number;
  publicCACount: number;
  privateCACount: number;
  selfSignedCount: number;
  topIssuer: string | null;
  summary: string;
}

// =====================
// SAN Analysis
// =====================

export interface SANInfo {
  domain: string;
  isWildcard: boolean;
  isIP: boolean;
  certCount: number;
  isNewDiscovery: boolean;
}

export interface SANAnalysis {
  sans: SANInfo[];
  uniqueDomains: number;
  wildcardCount: number;
  ipCount: number;
  newDiscoveries: string[];
  summary: string;
}

// =====================
// Historical Analysis
// =====================

export interface HistoricalEntry {
  domain: string;
  issuer: string;
  source: string;
  sourceLabel: string;
  timestamp: string;
}

export interface HistoricalAnalysis {
  entries: HistoricalEntry[];
  totalObservations: number;
  uniqueDomains: number;
  earliestObservation: string | null;
  latestObservation: string | null;
  summary: string;
}

// =====================
// Reuse Analysis
// =====================

export interface ReuseCluster {
  issuer: string;
  domains: string[];
  certCount: number;
  inferredRelationship: string;
}

export interface ReuseAnalysis {
  clusters: ReuseCluster[];
  reusedIssuers: number;
  crossDomainCerts: number;
  summary: string;
}

// =====================
// Wildcard Analysis
// =====================

export interface WildcardInfo {
  pattern: string;
  coveredDomains: string[];
  potentialSubdomains: string;
  riskLevel: "info" | "low" | "medium" | "high";
}

export interface WildcardAnalysis {
  wildcards: WildcardInfo[];
  totalWildcards: number;
  coveredDomainCount: number;
  summary: string;
}

// =====================
// Shared Infrastructure
// =====================

export interface SharedInfraCluster {
  sharedAttribute: string;
  attributeValue: string;
  domains: string[];
  inferredRelationship: string;
}

export interface SharedInfraAnalysis {
  clusters: SharedInfraCluster[];
  totalClusters: number;
  summary: string;
}

// =====================
// Certificate Graph
// =====================

export interface CertGraphNode {
  id: string;
  label: string;
  type: "certificate" | "domain" | "issuer" | "wildcard";
}

export interface CertGraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface CertGraph {
  nodes: CertGraphNode[];
  edges: CertGraphEdge[];
}

// =====================
// Expiration Analysis
// =====================

export interface ExpirationInfo {
  domain: string;
  status: "active" | "expiring_soon" | "expired" | "unknown";
  detail: string;
}

export interface ExpirationAnalysis {
  entries: ExpirationInfo[];
  activeCount: number;
  expiringCount: number;
  expiredCount: number;
  summary: string;
}

// =====================
// Complete Certificate Intelligence Report
// =====================

export interface CertIntelligenceReport {
  certificates: CertificateEntry[];
  issuerAnalysis: IssuerAnalysis;
  sanAnalysis: SANAnalysis;
  historicalAnalysis: HistoricalAnalysis;
  reuseAnalysis: ReuseAnalysis;
  wildcardAnalysis: WildcardAnalysis;
  sharedInfraAnalysis: SharedInfraAnalysis;
  expirationAnalysis: ExpirationAnalysis;
  graph: CertGraph;
  assessment: {
    totalCertificates: number;
    uniqueDomains: number;
    uniqueIssuers: number;
    wildcardCerts: number;
    newDiscoveries: number;
    securityPosture: "strong" | "moderate" | "weak" | "unknown";
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

export interface CertIntelligenceApiResponse {
  investigation_id: string;
  report: CertIntelligenceReport;
}

// =====================
// Analyzer
// =====================

export function analyzeCertificates(sourceResults: SourceResult[], knownTarget: string): CertIntelligenceReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  // Extract certificates
  const certificates = extractCertificates(allFindings, knownTarget);

  // Run analyses
  const issuerAnalysis = analyzeIssuers(certificates);
  const sanAnalysis = analyzeSANs(certificates, knownTarget);
  const historicalAnalysis = analyzeHistorical(allFindings);
  const reuseAnalysis = analyzeReuse(certificates);
  const wildcardAnalysis = analyzeWildcards(certificates);
  const sharedInfraAnalysis = analyzeSharedInfra(certificates);
  const expirationAnalysis = analyzeExpiration(certificates, allFindings);
  const graph = buildCertGraph(certificates, issuerAnalysis);

  // Assessment
  const totalCerts = certificates.length;
  const uniqueDomains = new Set(certificates.flatMap((c) => c.domains)).size;
  const uniqueIssuers = issuerAnalysis.uniqueIssuers;
  const wildcardCerts = certificates.filter((c) => c.isWildcard).length;
  const newDiscoveries = sanAnalysis.newDiscoveries.length;

  const securityPosture: "strong" | "moderate" | "weak" | "unknown" =
    totalCerts === 0 ? "unknown" :
    issuerAnalysis.selfSignedCount > 0 ? "weak" :
    wildcardCerts > totalCerts * 0.5 ? "moderate" :
    "strong";

  const explanation = buildAssessmentExplanation(
    totalCerts, uniqueDomains, uniqueIssuers, wildcardCerts,
    newDiscoveries, securityPosture, issuerAnalysis, sanAnalysis
  );

  return {
    certificates,
    issuerAnalysis,
    sanAnalysis,
    historicalAnalysis,
    reuseAnalysis,
    wildcardAnalysis,
    sharedInfraAnalysis,
    expirationAnalysis,
    graph,
    assessment: {
      totalCertificates: totalCerts,
      uniqueDomains,
      uniqueIssuers,
      wildcardCerts,
      newDiscoveries,
      securityPosture,
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
// Certificate Extraction
// =====================

function extractCertificates(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  knownTarget: string
): CertificateEntry[] {
  const certs: CertificateEntry[] = [];
  const seen = new Set<string>();

  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // Check if this finding is certificate-related
    const isCertRelated = source === "crtsh" || /certificate|ssl|tls|cert\s+transparency|SAN|issuer/i.test(text);
    if (!isCertRelated) continue;

    // Extract domains from the finding
    const domains = extractDomainsFromText(text);
    if (domains.length === 0) continue;

    // Extract issuer
    let issuer = "Unknown";
    const issuerMatch = text.match(/issuer:?\s*([^,.\n]+)/i);
    if (issuerMatch) issuer = issuerMatch[1].trim();

    // Determine issuer type
    let issuerType: CertificateEntry["issuerType"] = "unknown";
    if (/let'?s encrypt|digicert|globalsign|comodo|sectigo|godaddy|cloudflare|amazon|google\s*trust|entrust|thawte|geotrust|rapidssl|certum|quovadis/i.test(issuer)) {
      issuerType = "public_ca";
    } else if (/self[- ]?signed|self[- ]?issued/i.test(issuer)) {
      issuerType = "self_signed";
    } else if (issuer !== "Unknown" && issuerType === "unknown") {
      issuerType = "private_ca";
    }

    // Identify wildcard domains
    const wildcardDomains = domains.filter((d) => d.startsWith("*."));

    // Create a key for dedup
    const key = `${[...domains].sort().join(",")}|${issuer}`;
    if (seen.has(key)) continue;
    seen.add(key);

    certs.push({
      id: `cert_${certs.length}`,
      domains,
      wildcardDomains,
      issuer,
      issuerType,
      isWildcard: wildcardDomains.length > 0,
      source, sourceLabel, tier,
      evidence: text.slice(0, 200),
      confidence: finding.confidence,
    });
  }

  return certs;
}

function extractDomainsFromText(text: string): string[] {
  const domains = new Set<string>();
  // Standard domain pattern
  const matches = text.matchAll(/\b([\w*-]+\.){1,}[\w]{2,}\b/gi);
  for (const m of matches) {
    const domain = m[0].toLowerCase();
    if (domain.length >= 4 && domain.length <= 253) {
      domains.add(domain);
    }
  }
  return [...domains];
}

// =====================
// Issuer Analysis
// =====================

function analyzeIssuers(certs: CertificateEntry[]): IssuerAnalysis {
  const issuerMap = new Map<string, IssuerInfo>();

  for (const cert of certs) {
    if (!issuerMap.has(cert.issuer)) {
      issuerMap.set(cert.issuer, {
        name: cert.issuer,
        type: cert.issuerType,
        certCount: 0,
        domainsCovered: [],
        reusedAcrossAssets: false,
      });
    }
    const info = issuerMap.get(cert.issuer)!;
    info.certCount++;
    for (const d of cert.domains) {
      if (!info.domainsCovered.includes(d)) info.domainsCovered.push(d);
    }
  }

  // Check for reuse across assets (multiple distinct root domains)
  for (const info of issuerMap.values()) {
    const rootDomains = new Set(info.domainsCovered.map((d) => d.split(".").slice(-2).join(".")));
    info.reusedAcrossAssets = rootDomains.size > 1;
  }

  const issuers = [...issuerMap.values()].sort((a, b) => b.certCount - a.certCount);
  const publicCACount = issuers.filter((i) => i.type === "public_ca").length;
  const privateCACount = issuers.filter((i) => i.type === "private_ca").length;
  const selfSignedCount = issuers.filter((i) => i.type === "self_signed").length;
  const topIssuer = issuers.length > 0 ? issuers[0].name : null;

  const summary = `${issuers.length} unique issuers identified: ${publicCACount} public CA, ${privateCACount} private CA, ${selfSignedCount} self-signed. ` +
    `Top issuer: ${topIssuer || "none"}. ${issuers.filter((i) => i.reusedAcrossAssets).length} issuers reused across multiple assets.`;

  return { issuers, uniqueIssuers: issuers.length, publicCACount, privateCACount, selfSignedCount, topIssuer, summary };
}

// =====================
// SAN Analysis
// =====================

function analyzeSANs(certs: CertificateEntry[], knownTarget: string): SANAnalysis {
  const sanMap = new Map<string, SANInfo>();
  const knownRoot = knownTarget.split(".").slice(-2).join(".").toLowerCase();

  for (const cert of certs) {
    for (const domain of cert.domains) {
      const lower = domain.toLowerCase();
      if (!sanMap.has(lower)) {
        sanMap.set(lower, {
          domain: lower,
          isWildcard: lower.startsWith("*."),
          isIP: /^\d+\.\d+\.\d+\.\d+$/.test(lower),
          certCount: 0,
          isNewDiscovery: false,
        });
      }
      sanMap.get(lower)!.certCount++;
    }
  }

  // Mark new discoveries (domains not matching the known target root)
  const newDiscoveries: string[] = [];
  for (const san of sanMap.values()) {
    const root = san.domain.replace(/^\*\./, "").split(".").slice(-2).join(".");
    if (root !== knownRoot && !san.isIP) {
      san.isNewDiscovery = true;
      newDiscoveries.push(san.domain);
    }
  }

  const sans = [...sanMap.values()];
  const uniqueDomains = sans.filter((s) => !s.isWildcard && !s.isIP).length;
  const wildcardCount = sans.filter((s) => s.isWildcard).length;
  const ipCount = sans.filter((s) => s.isIP).length;

  const summary = `${sans.length} SAN entries: ${uniqueDomains} domains, ${wildcardCount} wildcards, ${ipCount} IPs. ` +
    `${newDiscoveries.length} new domain discoveries beyond the original target.`;

  return { sans, uniqueDomains, wildcardCount, ipCount, newDiscoveries, summary };
}

// =====================
// Historical Analysis
// =====================

function analyzeHistorical(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): HistoricalAnalysis {
  const entries: HistoricalEntry[] = [];
  const seen = new Set<string>();

  for (const { finding, source, sourceLabel } of findings) {
    if (source !== "crtsh" && !/certificate|ssl|tls/i.test(finding.data)) continue;
    const domains = extractDomainsFromText(finding.data);
    if (domains.length === 0) continue;

    const key = `${domains.sort().join(",")}|${finding.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);

    entries.push({
      domain: domains[0],
      issuer: "Unknown",
      source, sourceLabel,
      timestamp: finding.timestamp,
    });
  }

  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const uniqueDomains = new Set(entries.map((e) => e.domain)).size;
  const timestamps = entries.map((e) => new Date(e.timestamp).getTime()).filter((t) => !isNaN(t));
  const earliest = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : null;
  const latest = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : null;

  const spanText = earliest && latest ? `Span: ${new Date(earliest).toLocaleDateString()} to ${new Date(latest).toLocaleDateString()}.` : "";
  const summary = `${entries.length} historical certificate observations across ${uniqueDomains} domains. ${spanText}`;

  return { entries, totalObservations: entries.length, uniqueDomains, earliestObservation: earliest, latestObservation: latest, summary };
}

// =====================
// Reuse Analysis
// =====================

function analyzeReuse(certs: CertificateEntry[]): ReuseAnalysis {
  const issuerGroups = new Map<string, CertificateEntry[]>();

  for (const cert of certs) {
    if (!issuerGroups.has(cert.issuer)) issuerGroups.set(cert.issuer, []);
    issuerGroups.get(cert.issuer)!.push(cert);
  }

  const clusters: ReuseCluster[] = [];
  for (const [issuer, certGroup] of issuerGroups) {
    const allDomains = new Set(certGroup.flatMap((c) => c.domains));
    const rootDomains = new Set([...allDomains].map((d) => d.replace(/^\*\./, "").split(".").slice(-2).join(".")));
    if (rootDomains.size > 1) {
      clusters.push({
        issuer,
        domains: [...allDomains],
        certCount: certGroup.length,
        inferredRelationship: `Same issuer "${issuer}" used across ${rootDomains.size} distinct root domains — may indicate shared ownership or centralized certificate management.`,
      });
    }
  }

  const reusedIssuers = clusters.length;
  const crossDomainCerts = clusters.reduce((s, c) => s + c.certCount, 0);

  const summary = `${clusters.length} issuer reuse patterns detected across multiple domains. ` +
    `${crossDomainCerts} certificates share issuers across domain boundaries — may indicate shared infrastructure or ownership.`;

  return { clusters, reusedIssuers, crossDomainCerts, summary };
}

// =====================
// Wildcard Analysis
// =====================

function analyzeWildcards(certs: CertificateEntry[]): WildcardAnalysis {
  const wildcardMap = new Map<string, WildcardInfo>();

  for (const cert of certs) {
    for (const wd of cert.wildcardDomains) {
      const lower = wd.toLowerCase();
      if (!wildcardMap.has(lower)) {
        const baseDomain = lower.replace(/^\*\./, "");
        const covered = cert.domains.filter((d) => d.toLowerCase().endsWith(baseDomain) && d.toLowerCase() !== lower);
        const riskLevel: WildcardInfo["riskLevel"] =
          covered.length > 5 ? "high" : covered.length > 2 ? "medium" : covered.length > 0 ? "low" : "info";
        wildcardMap.set(lower, {
          pattern: lower,
          coveredDomains: covered,
          potentialSubdomains: `*.${baseDomain}`,
          riskLevel,
        });
      }
    }
  }

  const wildcards = [...wildcardMap.values()];
  const coveredDomainCount = wildcards.reduce((s, w) => s + w.coveredDomains.length, 0);

  const summary = `${wildcards.length} wildcard certificates detected covering ${coveredDomainCount} domains. ` +
    `Wildcards implicitly protect all subdomains of the base domain — may indicate broad administrative control.`;

  return { wildcards, totalWildcards: wildcards.length, coveredDomainCount, summary };
}

// =====================
// Shared Infrastructure Analysis
// =====================

function analyzeSharedInfra(certs: CertificateEntry[]): SharedInfraAnalysis {
  const clusters: SharedInfraCluster[] = [];

  // Group by issuer
  const issuerGroups = new Map<string, string[]>();
  for (const cert of certs) {
    if (!issuerGroups.has(cert.issuer)) issuerGroups.set(cert.issuer, []);
    for (const d of cert.domains) {
      if (!issuerGroups.get(cert.issuer)!.includes(d)) issuerGroups.get(cert.issuer)!.push(d);
    }
  }

  for (const [issuer, domains] of issuerGroups) {
    if (domains.length > 1) {
      clusters.push({
        sharedAttribute: "issuer",
        attributeValue: issuer,
        domains,
        inferredRelationship: `Domains ${domains.slice(0, 3).join(", ")}${domains.length > 3 ? "..." : ""} share issuer "${issuer}" — likely on the same hosting stack or managed by the same organization.`,
      });
    }
  }

  // Group by shared SAN sets
  const sanSetGroups = new Map<string, string[]>();
  for (const cert of certs) {
    const sanKey = [...cert.domains].sort().join(",");
    if (!sanSetGroups.has(sanKey)) sanSetGroups.set(sanKey, []);
    sanSetGroups.get(sanKey)!.push(cert.issuer);
  }
  for (const [sanKey, issuers] of sanSetGroups) {
    if (issuers.length > 1) {
      clusters.push({
        sharedAttribute: "SAN set",
        attributeValue: sanKey.slice(0, 50),
        domains: sanKey.split(","),
        inferredRelationship: `Multiple certificates (${issuers.length}) cover the same SAN set — may indicate certificate rotation or multi-CA deployment.`,
      });
    }
  }

  const summary = `${clusters.length} shared infrastructure clusters inferred from certificate metadata. ` +
    `Shared issuers and SAN sets suggest common hosting, operational control, or managed platform usage.`;

  return { clusters, totalClusters: clusters.length, summary };
}

// =====================
// Expiration Analysis
// =====================

function analyzeExpiration(certs: CertificateEntry[], findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): ExpirationAnalysis {
  const entries: ExpirationInfo[] = [];
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  for (const cert of certs) {
    for (const domain of cert.domains) {
      // Try to find expiration date in evidence
      const expMatch = cert.evidence.match(/(?:expires?|expiration)[:\s]+(\d{4}-\d{2}-\d{2})/i);
      if (expMatch) {
        const expDate = new Date(expMatch[1]);
        const timeUntil = expDate.getTime() - now;
        const status: ExpirationInfo["status"] =
          timeUntil < 0 ? "expired" :
          timeUntil < thirtyDays ? "expiring_soon" : "active";
        entries.push({
          domain,
          status,
          detail: `Expires: ${expMatch[1]} (${status === "expired" ? "EXPIRED" : status === "expiring_soon" ? "EXPIRING SOON" : "active"})`,
        });
      } else {
        entries.push({
          domain,
          status: "unknown",
          detail: "Expiration date not available in evidence",
        });
      }
    }
  }

  const activeCount = entries.filter((e) => e.status === "active").length;
  const expiringCount = entries.filter((e) => e.status === "expiring_soon").length;
  const expiredCount = entries.filter((e) => e.status === "expired").length;

  const expiredText = expiredCount > 0 ? `${expiredCount} expired certificates require immediate attention.` : "All tracked certificates are current.";
  const summary = `${entries.length} certificate expiration entries: ${activeCount} active, ${expiringCount} expiring soon, ${expiredCount} expired. ${expiredText}`;

  return { entries, activeCount, expiringCount, expiredCount, summary };
}

// =====================
// Certificate Graph
// =====================

function buildCertGraph(certs: CertificateEntry[], issuerAnalysis: IssuerAnalysis): CertGraph {
  const nodes: CertGraphNode[] = [];
  const edges: CertGraphEdge[] = [];
  const nodeIds = new Set<string>();

  function addNode(id: string, label: string, type: CertGraphNode["type"]) {
    if (!nodeIds.has(id)) {
      nodeIds.add(id);
      nodes.push({ id, label, type });
    }
  }

  function addEdge(from: string, to: string, label: string) {
    edges.push({ from, to, label });
  }

  // Add issuer nodes
  for (const issuer of issuerAnalysis.issuers) {
    addNode(`issuer_${issuer.name}`, issuer.name, "issuer");
  }

  // Add cert nodes + domain nodes + edges
  for (const cert of certs) {
    addNode(cert.id, `Cert: ${cert.domains.slice(0, 2).join(", ")}${cert.domains.length > 2 ? "..." : ""}`, "certificate");

    // Edge: issuer → cert
    addEdge(`issuer_${cert.issuer}`, cert.id, "issued_by");

    // Edge: cert → domain
    for (const domain of cert.domains) {
      const domainId = `domain_${domain}`;
      const nodeType: CertGraphNode["type"] = domain.startsWith("*.") ? "wildcard" : "domain";
      addNode(domainId, domain, nodeType);
      addEdge(cert.id, domainId, "covers");
    }
  }

  return { nodes, edges };
}

// =====================
// Assessment
// =====================

function buildAssessmentExplanation(
  total: number, domains: number, issuers: number, wildcards: number,
  newDisc: number, posture: string, issuerAnalysis: IssuerAnalysis, sanAnalysis: SANAnalysis
): string {
  if (total === 0) {
    return "No certificate data available. The target may not have certificates discoverable through collected evidence (crt.sh, SSL/TLS sources).";
  }

  const parts: string[] = [];
  parts.push(`${total} certificates analyzed covering ${domains} unique domains`);
  parts.push(`${issuers} unique issuers (${issuerAnalysis.publicCACount} public CA, ${issuerAnalysis.selfSignedCount} self-signed)`);
  parts.push(`${wildcards} wildcard certificates`);
  if (newDisc > 0) parts.push(`${newDisc} new domain discoveries from SAN analysis`);
  parts.push(`Security posture: ${posture.toUpperCase()}`);

  if (posture === "weak") {
    parts.push("Self-signed certificates detected — may indicate development environments or misconfigured infrastructure");
  } else if (posture === "moderate") {
    parts.push("High wildcard usage — broad certificate scope may expose unintended subdomains");
  } else if (posture === "strong") {
    parts.push("Certificates from trusted public CAs with appropriate scoping");
  }

  return parts.join(". ") + ".";
}
