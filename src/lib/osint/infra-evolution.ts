// Infrastructure Evolution Engine — domain models and tracker.
// Tracks DNS history, hosting history, ASN changes, SSL evolution, CDN evolution,
// IP migration, and technology evolution from collected evidence.
//
// 7 dimensions tracked:
// 1. DNS History — A/AAAA/MX/NS/TXT/CNAME records discovered
// 2. IP Migration — IPs associated with the target
// 3. ASN Evolution — ASN/organization changes for discovered IPs
// 4. SSL/TLS Evolution — Certificate data, SANs, issuers
// 5. CDN/Hosting Evolution — Hosting providers, CDNs, server tech
// 6. Technology Evolution — Server software, frameworks, security headers
// 7. Security Posture Evolution — Security headers present/missing

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// DNS History
// =====================

export interface DNSRecord {
  type: "A" | "AAAA" | "MX" | "NS" | "TXT" | "CNAME" | "SPF" | "DMARC";
  value: string;
  ttl?: number;
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  timestamp: string;
}

export interface DNSHistory {
  records: DNSRecord[];
  recordTypes: string[];
  uniqueValues: number;
  summary: string;
}

// =====================
// IP Migration
// =====================

export interface IPEntry {
  ip: string;
  version: "IPv4" | "IPv6";
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  timestamp: string;
  associatedDomain?: string;
}

export interface IPMigration {
  ips: IPEntry[];
  ipv4Count: number;
  ipv6Count: number;
  uniqueIPs: number;
  summary: string;
}

// =====================
// ASN Evolution
// =====================

export interface ASNEntry {
  asn: string;
  organization: string;
  ip: string;
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
}

export interface ASNEvolution {
  entries: ASNEntry[];
  uniqueASNs: number;
  uniqueOrganizations: string[];
  summary: string;
}

// =====================
// SSL/TLS Evolution
// =====================

export interface CertificateEntry {
  issuer?: string;
  subject?: string;
  sanDomains: string[];
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  timestamp: string;
}

export interface SSLEvolution {
  certificates: CertificateEntry[];
  totalCerts: number;
  uniqueSANs: string[];
  uniqueIssuers: string[];
  summary: string;
}

// =====================
// CDN/Hosting Evolution
// =====================

export interface HostingEntry {
  provider: string;
  type: "hosting" | "cdn" | "cloud" | "registrar" | "dns_provider" | "cache" | "server";
  detail: string;
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
}

export interface HostingEvolution {
  entries: HostingEntry[];
  uniqueProviders: string[];
  summary: string;
}

// =====================
// Technology Evolution
// =====================

export interface TechEntry {
  technology: string;
  category: "server" | "framework" | "cms" | "analytics" | "security" | "cache" | "proxy" | "other";
  detail: string;
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
}

export interface TechEvolution {
  entries: TechEntry[];
  uniqueTechnologies: string[];
  byCategory: Record<string, number>;
  summary: string;
}

// =====================
// Security Posture
// =====================

export interface SecurityHeader {
  name: string;
  present: boolean;
  value?: string;
  source: string;
  sourceLabel: string;
}

export interface SecurityPosture {
  headers: SecurityHeader[];
  presentCount: number;
  missingCount: number;
  score: number;
  summary: string;
}

// =====================
// Complete Infrastructure Evolution Report
// =====================

export interface InfraEvolutionReport {
  dns: DNSHistory;
  ipMigration: IPMigration;
  asnEvolution: ASNEvolution;
  sslEvolution: SSLEvolution;
  hostingEvolution: HostingEvolution;
  techEvolution: TechEvolution;
  securityPosture: SecurityPosture;
  summary: {
    totalDataPoints: number;
    dnsRecords: number;
    uniqueIPs: number;
    uniqueASNs: number;
    certificates: number;
    technologies: number;
    securityScore: number;
  };
  assessment: {
    infrastructureComplexity: "low" | "medium" | "high";
    securityGrade: "A" | "B" | "C" | "D" | "F";
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

export interface InfraEvolutionApiResponse {
  investigation_id: string;
  report: InfraEvolutionReport;
}

// =====================
// Infrastructure Evolution Tracker
// =====================

export function generateInfraEvolution(sourceResults: SourceResult[]): InfraEvolutionReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  const dns = extractDNSHistory(allFindings);
  const ipMigration = extractIPMigration(allFindings);
  const asnEvolution = extractASNEvolution(allFindings);
  const sslEvolution = extractSSLEvolution(allFindings);
  const hostingEvolution = extractHostingEvolution(allFindings);
  const techEvolution = extractTechEvolution(allFindings);
  const securityPosture = extractSecurityPosture(allFindings);

  const totalDataPoints =
    dns.records.length + ipMigration.ips.length + asnEvolution.entries.length +
    sslEvolution.certificates.length + hostingEvolution.entries.length +
    techEvolution.entries.length + securityPosture.headers.length;

  const securityScore = securityPosture.score;
  const securityGrade = securityScore >= 80 ? "A" : securityScore >= 60 ? "B" : securityScore >= 40 ? "C" : securityScore >= 20 ? "D" : "F";
  const infraComplexity: "low" | "medium" | "high" =
    totalDataPoints > 30 ? "high" : totalDataPoints > 10 ? "medium" : "low";

  const explanation = buildAssessmentExplanation(
    dns.records.length, ipMigration.uniqueIPs, asnEvolution.uniqueASNs,
    sslEvolution.totalCerts, techEvolution.uniqueTechnologies.length,
    securityScore, securityGrade, infraComplexity
  );

  return {
    dns,
    ipMigration,
    asnEvolution,
    sslEvolution,
    hostingEvolution,
    techEvolution,
    securityPosture,
    summary: {
      totalDataPoints,
      dnsRecords: dns.records.length,
      uniqueIPs: ipMigration.uniqueIPs,
      uniqueASNs: asnEvolution.uniqueASNs,
      certificates: sslEvolution.totalCerts,
      technologies: techEvolution.uniqueTechnologies.length,
      securityScore,
    },
    assessment: {
      infrastructureComplexity: infraComplexity,
      securityGrade,
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
// DNS History Extraction
// =====================

function extractDNSHistory(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): DNSHistory {
  const records: DNSRecord[] = [];
  const recordTypes = new Set<string>();
  const values = new Set<string>();

  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // A record: "DNS A record for X: Y (TTL: Zs)"
    let m = text.match(/DNS\s+(A|AAAA|MX|NS|TXT|CNAME|SPF|DMARC)\s+record\s+for\s+[\w.-]+:\s*(.+?)(?:\s+\(TTL:\s*(\d+)s\))?$/im);
    if (m) {
      const type = m[1].toUpperCase() as DNSRecord["type"];
      const value = m[2].trim();
      const ttl = m[3] ? parseInt(m[3]) : undefined;
      records.push({ type, value, ttl, source, sourceLabel, tier, timestamp: finding.timestamp });
      recordTypes.add(type);
      values.add(value.toLowerCase());
    }
    // Generic: "DNS X record for Y: Z"
    m = text.match(/DNS\s+(A|AAAA|MX|NS|TXT|CNAME)\s+record\s+for\s+[\w.-]+:\s*(.+)/i);
    if (m) {
      const type = m[1].toUpperCase() as DNSRecord["type"];
      const value = m[2].trim();
      if (!records.some((r) => r.type === type && r.value === value)) {
        records.push({ type, value, source, sourceLabel, tier, timestamp: finding.timestamp });
        recordTypes.add(type);
        values.add(value.toLowerCase());
      }
    }
  }

  const summary = `${records.length} DNS records discovered across ${recordTypes.size} record types (${[...recordTypes].join(", ")}). ${values.size} unique values.`;
  return { records, recordTypes: [...recordTypes], uniqueValues: values.size, summary };
}

// =====================
// IP Migration Extraction
// =====================

function extractIPMigration(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): IPMigration {
  const ips: IPEntry[] = [];
  const seenIPs = new Set<string>();

  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // IPv4
    const ipv4Matches = text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g);
    for (const m of ipv4Matches) {
      const ip = m[1];
      if (isPrivateIP(ip)) continue;
      if (!seenIPs.has(ip)) {
        seenIPs.add(ip);
        ips.push({ ip, version: "IPv4", source, sourceLabel, tier, timestamp: finding.timestamp });
      }
    }
    // IPv6
    const ipv6Matches = text.matchAll(/\b([0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){7})\b/g);
    for (const m of ipv6Matches) {
      const ip = m[1];
      if (!seenIPs.has(ip)) {
        seenIPs.add(ip);
        ips.push({ ip, version: "IPv6", source, sourceLabel, tier, timestamp: finding.timestamp });
      }
    }
  }

  const ipv4Count = ips.filter((e) => e.version === "IPv4").length;
  const ipv6Count = ips.filter((e) => e.version === "IPv6").length;
  const summary = `${ips.length} unique IP addresses discovered (${ipv4Count} IPv4, ${ipv6Count} IPv6). Multiple IPs may indicate load balancing, CDN, or IP migration.`;
  return { ips, ipv4Count, ipv6Count, uniqueIPs: ips.length, summary };
}

// =====================
// ASN Evolution Extraction
// =====================

function extractASNEvolution(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): ASNEvolution {
  const entries: ASNEntry[] = [];
  const seenASNs = new Set<string>();
  const organizations = new Set<string>();

  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // ASN: "ASN: AS12345" or "AS12345 — Organization Name"
    let m = text.match(/ASN:?\s*(AS\d+)\s*[:—-]?\s*([^,.\n]+)/i);
    if (m) {
      const asn = m[1].toUpperCase();
      const org = m[2].trim();
      if (!seenASNs.has(asn)) {
        seenASNs.add(asn);
        entries.push({ asn, organization: org, ip: "", source, sourceLabel, tier });
        organizations.add(org);
      }
    }
    // "organization: X" or "ISP: X"
    m = text.match(/(?:organization|ISP|org):\s*([^,.\n]+)/i);
    if (m) {
      const org = m[1].trim();
      if (!organizations.has(org) && org.length > 2) {
        organizations.add(org);
      }
    }
  }

  const summary = `${entries.length} ASN entries discovered across ${organizations.size} organizations. ASNs: ${[...seenASNs].join(", ") || "none"}.`;
  return { entries, uniqueASNs: seenASNs.size, uniqueOrganizations: [...organizations], summary };
}

// =====================
// SSL/TLS Evolution Extraction
// =====================

function extractSSLEvolution(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): SSLEvolution {
  const certificates: CertificateEntry[] = [];
  const allSANs = new Set<string>();
  const issuers = new Set<string>();

  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // crt.sh findings: often contain domain names that are SANs
    if (source === "crtsh" || /certificate|ssl|tls|cert\s+transparency/i.test(text)) {
      const sans: string[] = [];
      // Extract domain names from certificate findings
      const domainMatches = text.matchAll(/\b([\w.-]+\.[a-z]{2,})\b/gi);
      for (const m of domainMatches) {
        const domain = m[1].toLowerCase();
        if (!sans.includes(domain)) sans.push(domain);
        allSANs.add(domain);
      }
      // Look for issuer
      let m = text.match(/issuer:?\s*([^,.\n]+)/i);
      const issuer = m ? m[1].trim() : undefined;
      if (issuer) issuers.add(issuer);

      if (sans.length > 0 || issuer) {
        certificates.push({ issuer, sanDomains: sans, source, sourceLabel, tier, timestamp: finding.timestamp });
      }
    }
  }

  const summary = `${certificates.length} certificate entries discovered. ${allSANs.size} unique SAN domains, ${issuers.size} issuers. Certificate transparency reveals related domains and infrastructure.`;
  return { certificates, totalCerts: certificates.length, uniqueSANs: [...allSANs], uniqueIssuers: [...issuers], summary };
}

// =====================
// CDN/Hosting Evolution Extraction
// =====================

function extractHostingEvolution(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): HostingEvolution {
  const entries: HostingEntry[] = [];
  const providers = new Set<string>();

  const providerPatterns: { regex: RegExp; provider: string; type: HostingEntry["type"] }[] = [
    { regex: /cloudflare/i, provider: "Cloudflare", type: "cdn" },
    { regex: /amazon|aws|ec2|s3/i, provider: "Amazon AWS", type: "cloud" },
    { regex: /google\s*cloud|gcp/i, provider: "Google Cloud", type: "cloud" },
    { regex: /azure|microsoft/i, provider: "Microsoft Azure", type: "cloud" },
    { regex: /akamai/i, provider: "Akamai", type: "cdn" },
    { regex: /fastly/i, provider: "Fastly", type: "cdn" },
    { regex: /varnish/i, provider: "Varnish", type: "cache" },
    { regex: /nginx/i, provider: "Nginx", type: "hosting" },
    { regex: /apache/i, provider: "Apache", type: "hosting" },
    { regex: /wikimedia/i, provider: "Wikimedia Foundation", type: "hosting" },
    { regex: /godaddy/i, provider: "GoDaddy", type: "registrar" },
    { regex: /namecheap/i, provider: "Namecheap", type: "registrar" },
    { regex: /markmonitor/i, provider: "MarkMonitor", type: "registrar" },
    { regex: /cloudns|nsone|awsdns|wikimedia\.org.*ns/i, provider: "DNS Provider", type: "dns_provider" },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    for (const p of providerPatterns) {
      if (p.regex.test(text)) {
        if (!providers.has(p.provider)) {
          providers.add(p.provider);
          entries.push({
            provider: p.provider,
            type: p.type,
            detail: text.slice(0, 100),
            source, sourceLabel, tier,
          });
        }
      }
    }
    // Server header
    const serverMatch = text.match(/Server:?\s*([^,.\n]+)/i);
    if (serverMatch) {
      const server = serverMatch[1].trim();
      if (!providers.has(server)) {
        providers.add(server);
        entries.push({ provider: server, type: "server", detail: "Server header", source, sourceLabel, tier });
      }
    }
  }

  const summary = `${entries.length} hosting/CDN providers identified: ${[...providers].join(", ") || "none"}.`;
  return { entries, uniqueProviders: [...providers], summary };
}

// =====================
// Technology Evolution Extraction
// =====================

function extractTechEvolution(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): TechEvolution {
  const entries: TechEntry[] = [];
  const technologies = new Set<string>();
  const byCategory: Record<string, number> = {};

  const techPatterns: { regex: RegExp; tech: string; category: TechEntry["category"] }[] = [
    { regex: /\bnginx\b/i, tech: "Nginx", category: "server" },
    { regex: /\bapache\b/i, tech: "Apache", category: "server" },
    { regex: /\bvarnish\b/i, tech: "Varnish Cache", category: "cache" },
    { regex: /\bwordpress\b/i, tech: "WordPress", category: "cms" },
    { regex: /\bjoomla\b/i, tech: "Joomla", category: "cms" },
    { regex: /\bdrupal\b/i, tech: "Drupal", category: "cms" },
    { regex: /\bmediawiki\b/i, tech: "MediaWiki", category: "cms" },
    { regex: /\bphp\b/i, tech: "PHP", category: "framework" },
    { regex: /\bnode\.?js\b/i, tech: "Node.js", category: "framework" },
    { regex: /\bpython\b/i, tech: "Python", category: "framework" },
    { regex: /\breact\b/i, tech: "React", category: "framework" },
    { regex: /\bcloudflare\b/i, tech: "Cloudflare", category: "proxy" },
    { regex: /\bgoogle\s*analytics\b/i, tech: "Google Analytics", category: "analytics" },
    { regex: /\bmatomo\b/i, tech: "Matomo", category: "analytics" },
    { regex: /\bhsts\b/i, tech: "HSTS", category: "security" },
    { regex: /\bcsp\b|content-security-policy/i, tech: "CSP", category: "security" },
    { regex: /\bx-frame-options\b/i, tech: "X-Frame-Options", category: "security" },
    { regex: /\bx-content-type-options\b/i, tech: "X-Content-Type-Options", category: "security" },
    { regex: /\bstrict-transport-security\b/i, tech: "Strict-Transport-Security", category: "security" },
    { regex: /\breferrer-policy\b/i, tech: "Referrer-Policy", category: "security" },
    { regex: /\bpermissions-policy\b/i, tech: "Permissions-Policy", category: "security" },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    for (const p of techPatterns) {
      if (p.regex.test(text)) {
        if (!technologies.has(p.tech)) {
          technologies.add(p.tech);
          entries.push({
            technology: p.tech,
            category: p.category,
            detail: text.slice(0, 100),
            source, sourceLabel, tier,
          });
          byCategory[p.category] = (byCategory[p.category] || 0) + 1;
        }
      }
    }
  }

  const summary = `${entries.length} technologies identified across ${Object.keys(byCategory).length} categories. Technologies: ${[...technologies].join(", ") || "none"}.`;
  return { entries, uniqueTechnologies: [...technologies], byCategory, summary };
}

// =====================
// Security Posture Extraction
// =====================

function extractSecurityPosture(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): SecurityPosture {
  const securityHeaders = [
    "content-security-policy",
    "strict-transport-security",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "x-xss-protection",
  ];

  const headers: SecurityHeader[] = [];
  let presentCount = 0;
  let missingCount = 0;

  // Combine all finding text to check for header presence
  const allText = findings.map((f) => f.finding.data).join("\n").toLowerCase();

  for (const header of securityHeaders) {
    const isPresent = allText.includes(header);
    if (isPresent) {
      presentCount++;
      // Try to extract value
      const valueMatch = allText.match(new RegExp(`${header}:?\\s*([^,\\n]+)`, "i"));
      headers.push({
        name: header,
        present: true,
        value: valueMatch ? valueMatch[1].trim() : undefined,
        source: "httpheaders",
        sourceLabel: "HTTP Headers",
      });
    } else {
      missingCount++;
      headers.push({
        name: header,
        present: false,
        source: "httpheaders",
        sourceLabel: "HTTP Headers",
      });
    }
  }

  const score = Math.round((presentCount / securityHeaders.length) * 100);
  const summary = `Security score: ${score}/100 (${presentCount}/${securityHeaders.length} security headers present, ${missingCount} missing). ${missingCount > 0 ? "Missing headers may expose the site to security risks." : "All security headers are present."}`;
  return { headers, presentCount, missingCount, score, summary };
}

// =====================
// Utilities
// =====================

function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

function buildAssessmentExplanation(
  dnsRecords: number, uniqueIPs: number, uniqueASNs: number,
  certs: number, technologies: number, securityScore: number,
  securityGrade: string, complexity: string
): string {
  const parts: string[] = [];
  parts.push(`Infrastructure complexity is ${complexity.toUpperCase()}`);
  parts.push(`${dnsRecords} DNS records, ${uniqueIPs} unique IPs, ${uniqueASNs} ASNs, ${certs} certificates, ${technologies} technologies detected`);
  parts.push(`Security posture grade: ${securityGrade} (${securityScore}/100)`);
  if (securityScore >= 80) {
    parts.push("Strong security posture with comprehensive header coverage");
  } else if (securityScore >= 60) {
    parts.push("Moderate security posture — some headers missing");
  } else {
    parts.push("Weak security posture — multiple critical headers missing");
  }
  return parts.join(". ") + ".";
}
