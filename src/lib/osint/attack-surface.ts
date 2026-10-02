// Attack Surface Mapper — domain models and mapper.
// Automatically discovers and categorizes all externally reachable assets.
//
// 8 asset categories:
// 1. Subdomains — all discovered hostnames
// 2. Ports — open/filtered network ports
// 3. Services — fingerprinted services and protocols
// 4. Storage — exposed storage assets (buckets, file shares)
// 5. APIs — discovered API endpoints
// 6. Admin Portals — admin/management interfaces
// 7. Development Systems — dev/CI-CD environments
// 8. Staging Systems — pre-prod/QA/UAT environments

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Asset Types
// =====================

export type AssetCategory =
  | "subdomain"
  | "port"
  | "service"
  | "storage"
  | "api"
  | "admin_portal"
  | "development"
  | "staging";

/** Risk level for an asset. */
export type AssetRisk = "info" | "low" | "medium" | "high" | "critical";

/** A single discovered asset in the attack surface. */
export interface AssetEntry {
  /** Unique ID. */
  id: string;
  /** Asset value (hostname, port number, URL, service name). */
  value: string;
  /** Asset category. */
  category: AssetCategory;
  /** Asset subtype (e.g., "wildcard_cert", "rest_api", "admin_dashboard"). */
  subtype: string;
  /** Source that discovered this asset. */
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  /** Confidence (0-1). */
  confidence: number;
  /** Risk level. */
  risk: AssetRisk;
  /** Evidence text. */
  evidence: string;
  /** Whether the asset is active/verified. */
  active: boolean;
  /** Additional metadata. */
  metadata: Record<string, string>;
}

/** Port entry with service info. */
export interface PortEntry extends AssetEntry {
  category: "port";
  portNumber: number;
  protocol: "tcp" | "udp";
  serviceName: string;
}

/** Service entry with fingerprint. */
export interface ServiceEntry extends AssetEntry {
  category: "service";
  serviceName: string;
  version?: string;
  port?: number;
}

// =====================
// Category Summary
// =====================

export interface CategorySummary {
  category: AssetCategory;
  label: string;
  count: number;
  activeCount: number;
  riskCounts: Record<AssetRisk, number>;
  topRisk: AssetRisk;
}

// =====================
// Attack Surface Report
// =====================

export interface AttackSurfaceReport {
  /** All discovered assets. */
  assets: AssetEntry[];
  /** Assets grouped by category. */
  byCategory: Record<AssetCategory, AssetEntry[]>;
  /** Category summaries. */
  summaries: CategorySummary[];
  /** Overall assessment. */
  assessment: {
    totalAssets: number;
    activeAssets: number;
    highRiskAssets: number;
    criticalRiskAssets: number;
    attackSurfaceScore: number;
    riskLevel: "minimal" | "low" | "moderate" | "high" | "critical";
    explanation: string;
  };
  /** Key findings. */
  keyFindings: string[];
  /** Metadata. */
  meta: {
    sourcesAnalyzed: number;
    findingsAnalyzed: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface AttackSurfaceApiResponse {
  investigation_id: string;
  report: AttackSurfaceReport;
}

// =====================
// Category Labels
// =====================

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  subdomain: "Subdomains",
  port: "Open Ports",
  service: "Services",
  storage: "Storage Assets",
  api: "API Endpoints",
  admin_portal: "Admin Portals",
  development: "Development Systems",
  staging: "Staging Systems",
};

export const CATEGORY_RISK_DEFAULTS: Record<AssetCategory, AssetRisk> = {
  subdomain: "info",
  port: "medium",
  service: "info",
  storage: "high",
  api: "medium",
  admin_portal: "critical",
  development: "high",
  staging: "high",
};

// =====================
// Mapper
// =====================

export function mapAttackSurface(sourceResults: SourceResult[]): AttackSurfaceReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  const assets: AssetEntry[] = [];

  // 1. Extract subdomains
  assets.push(...extractSubdomains(allFindings));

  // 2. Extract ports
  assets.push(...extractPorts(allFindings));

  // 3. Extract services
  assets.push(...extractServices(allFindings));

  // 4. Extract storage assets
  assets.push(...extractStorage(allFindings));

  // 5. Extract APIs
  assets.push(...extractAPIs(allFindings));

  // 6. Extract admin portals
  assets.push(...extractAdminPortals(allFindings));

  // 7. Extract development systems
  assets.push(...extractDevSystems(allFindings));

  // 8. Extract staging systems
  assets.push(...extractStagingSystems(allFindings));

  // Deduplicate by value + category
  const seen = new Set<string>();
  const uniqueAssets = assets.filter((a) => {
    const key = `${a.category}|${a.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Group by category
  const byCategory = {} as Record<AssetCategory, AssetEntry[]>;
  for (const cat of Object.keys(CATEGORY_LABELS) as AssetCategory[]) {
    byCategory[cat] = uniqueAssets.filter((a) => a.category === cat);
  }

  // Build summaries
  const summaries = (Object.keys(CATEGORY_LABELS) as AssetCategory[])
    .filter((cat) => byCategory[cat].length > 0)
    .map((cat) => buildCategorySummary(cat, byCategory[cat]));

  // Assessment
  const totalAssets = uniqueAssets.length;
  const activeAssets = uniqueAssets.filter((a) => a.active).length;
  const highRiskAssets = uniqueAssets.filter((a) => a.risk === "high" || a.risk === "critical").length;
  const criticalRiskAssets = uniqueAssets.filter((a) => a.risk === "critical").length;

  const attackSurfaceScore = Math.min(
    (totalAssets * 2) + (highRiskAssets * 10) + (criticalRiskAssets * 20),
    100
  );
  const riskLevel: AttackSurfaceReport["assessment"]["riskLevel"] =
    attackSurfaceScore >= 80 ? "critical" :
    attackSurfaceScore >= 60 ? "high" :
    attackSurfaceScore >= 40 ? "moderate" :
    attackSurfaceScore >= 20 ? "low" : "minimal";

  const keyFindings = buildKeyFindings(uniqueAssets, summaries);
  const explanation = buildAssessmentExplanation(
    totalAssets, activeAssets, highRiskAssets, criticalRiskAssets, attackSurfaceScore, riskLevel, summaries
  );

  return {
    assets: uniqueAssets,
    byCategory,
    summaries,
    assessment: {
      totalAssets,
      activeAssets,
      highRiskAssets,
      criticalRiskAssets,
      attackSurfaceScore,
      riskLevel,
      explanation,
    },
    keyFindings,
    meta: {
      sourcesAnalyzed: successfulResults.length,
      findingsAnalyzed: allFindings.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Extractors
// =====================

function extractSubdomains(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): AssetEntry[] {
  const assets: AssetEntry[] = [];
  const seen = new Set<string>();
  const domainRe = /\b([\w-]+\.){1,}[\w]{2,}\b/gi;

  for (const { finding, source, sourceLabel, tier } of findings) {
    const matches = finding.data.matchAll(domainRe);
    for (const m of matches) {
      const domain = m[0].toLowerCase();
      if (seen.has(domain)) continue;
      if (domain.length < 4 || domain.length > 253) continue;
      // Skip common non-subdomain matches
      if (["example.com", "example.org", "example.net"].includes(domain)) continue;
      seen.add(domain);

      // Determine subtype
      let subtype = "discovered";
      if (source === "crtsh") subtype = "certificate_transparency";
      else if (source === "doh" || source === "dns_google") subtype = "dns_record";
      else if (source === "openrdap") subtype = "rdap";

      assets.push({
        id: `sub_${assets.length}`,
        value: domain,
        category: "subdomain",
        subtype,
        source, sourceLabel, tier,
        confidence: finding.confidence,
        risk: "info",
        evidence: finding.data.slice(0, 150),
        active: source !== "wayback" && source !== "archiveorg", // Archives may reference old domains
        metadata: {},
      });
    }
  }
  return assets;
}

function extractPorts(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): AssetEntry[] {
  const assets: AssetEntry[] = [];
  const seen = new Set<string>();

  // Common port to service mapping
  const portServices: Record<number, string> = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB",
    993: "IMAPS", 995: "POP3S", 3306: "MySQL", 3389: "RDP",
    5432: "PostgreSQL", 5900: "VNC", 6379: "Redis", 8080: "HTTP-Alt",
    8443: "HTTPS-Alt", 9200: "Elasticsearch", 27017: "MongoDB",
  };

  for (const { finding, source, sourceLabel, tier } of findings) {
    // Pattern: "Open ports: 80, 443, 8080" or "port 443/tcp"
    const portPatterns = [
      /open\s+ports?:?\s*([\d,\s/tcpudp]+)/gi,
      /port\s+(\d{1,5})\/(tcp|udp)/gi,
      /ports?:?\s*(\d{1,5}(?:,\s*\d{1,5})*)/gi,
    ];

    for (const pattern of portPatterns) {
      const matches = finding.data.matchAll(pattern);
      for (const m of matches) {
        const portStr = m[1] || m[0];
        const portNums = portStr.match(/\d{1,5}/g);
        if (!portNums) continue;

        for (const pn of portNums) {
          const port = parseInt(pn);
          if (port < 1 || port > 65535) continue;
          const key = `port_${port}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const serviceName = portServices[port] || "unknown";
          const risk: AssetRisk = [22, 3389, 5900, 23, 21, 445].includes(port) ? "high" :
            [80, 443].includes(port) ? "low" : "medium";

          assets.push({
            id: `port_${assets.length}`,
            value: `${port}`,
            category: "port",
            subtype: serviceName,
            source, sourceLabel, tier,
            confidence: finding.confidence,
            risk,
            evidence: finding.data.slice(0, 150),
            active: true,
            metadata: { portNumber: String(port), protocol: "tcp", service: serviceName },
          });
        }
      }
    }
  }
  return assets;
}

function extractServices(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): AssetEntry[] {
  const assets: AssetEntry[] = [];
  const seen = new Set<string>();

  const servicePatterns: { regex: RegExp; service: string; versionGroup?: number }[] = [
    { regex: /Server:?\s*([^,.\n]+)/i, service: "Web Server", versionGroup: 1 },
    { regex: /\bnginx[/\s]+([\d.]+)/i, service: "Nginx", versionGroup: 1 },
    { regex: /\bapache[/\s]+([\d.]+)/i, service: "Apache", versionGroup: 1 },
    { regex: /\bvarnish[/\s]+([\d.]+)/i, service: "Varnish Cache", versionGroup: 1 },
    { regex: /\bcloudflare\b/i, service: "Cloudflare CDN" },
    { regex: /\bwordpress\b/i, service: "WordPress CMS" },
    { regex: /\bmediawiki\b/i, service: "MediaWiki" },
    { regex: /\bSMTP\b/i, service: "SMTP Mail Server" },
    { regex: /\bSSH\b/i, service: "SSH" },
    { regex: /\bFTP\b/i, service: "FTP" },
    { regex: /\bRDP\b/i, service: "Remote Desktop" },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const p of servicePatterns) {
      const m = finding.data.match(p.regex);
      if (m) {
        const serviceName = p.service;
        const version = p.versionGroup ? m[p.versionGroup]?.trim() : undefined;
        const key = `${serviceName}|${version || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);

        assets.push({
          id: `svc_${assets.length}`,
          value: version ? `${serviceName} ${version}` : serviceName,
          category: "service",
          subtype: "fingerprinted",
          source, sourceLabel, tier,
          confidence: finding.confidence,
          risk: ["SSH", "FTP", "RDP", "SMTP Mail Server"].includes(serviceName) ? "medium" : "info",
          evidence: finding.data.slice(0, 150),
          active: true,
          metadata: version ? { version } : {},
        });
      }
    }
  }
  return assets;
}

function extractStorage(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): AssetEntry[] {
  const assets: AssetEntry[] = [];
  const seen = new Set<string>();

  const storagePatterns: { regex: RegExp; type: string }[] = [
    { regex: /\b(s3|amazonaws|bucket|object\s*store)\b/i, type: "S3 Bucket" },
    { regex: /\b(google\s*cloud\s*storage|gcs|storage\.googleapis)\b/i, type: "GCS Bucket" },
    { regex: /\b(azure\s*blob|blob\.core\.windows)\b/i, type: "Azure Blob" },
    { regex: /\b(ftp\s*server|file\s*share|smb|samba)\b/i, type: "File Share" },
    { regex: /\b(backup|snapshot|dump)\b/i, type: "Backup/Snapshot" },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const p of storagePatterns) {
      if (p.regex.test(finding.data)) {
        const key = `${p.type}|${finding.data.slice(0, 50)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        assets.push({
          id: `stor_${assets.length}`,
          value: p.type,
          category: "storage",
          subtype: p.type.toLowerCase().replace(/\s+/g, "_"),
          source, sourceLabel, tier,
          confidence: finding.confidence,
          risk: "high",
          evidence: finding.data.slice(0, 150),
          active: true,
          metadata: {},
        });
      }
    }
  }
  return assets;
}

function extractAPIs(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): AssetEntry[] {
  const assets: AssetEntry[] = [];
  const seen = new Set<string>();

  const apiPatterns: { regex: RegExp; type: string }[] = [
    { regex: /\/api\/v?\d*\//i, type: "REST API" },
    { regex: /\/graphql/i, type: "GraphQL API" },
    { regex: /\/grpc\b/i, type: "gRPC API" },
    { regex: /websocket|wss?:\/\//i, type: "WebSocket API" },
    { regex: /\/api\//i, type: "API Endpoint" },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    // Check URLs in findings
    const urlMatches = finding.data.matchAll(/(https?:\/\/[^\s,]+)/gi);
    for (const m of urlMatches) {
      const url = m[1];
      for (const p of apiPatterns) {
        if (p.regex.test(url)) {
          if (seen.has(url)) continue;
          seen.add(url);
          assets.push({
            id: `api_${assets.length}`,
            value: url,
            category: "api",
            subtype: p.type.toLowerCase().replace(/\s+/g, "_"),
            source, sourceLabel, tier,
            confidence: finding.confidence,
            risk: "medium",
            evidence: finding.data.slice(0, 150),
            active: true,
            metadata: {},
          });
          break;
        }
      }
    }

    // Also check sitemap/robots.txt references
    if (source === "robotssitemap" && /\/api\//i.test(finding.data)) {
      const apiPaths = finding.data.matchAll(/(\/api\/[^\s,]+)/gi);
      for (const m of apiPaths) {
        const path = m[1];
        if (seen.has(path)) continue;
        seen.add(path);
        assets.push({
          id: `api_${assets.length}`,
          value: path,
          category: "api",
          subtype: "sitemap_discovered",
          source, sourceLabel, tier,
          confidence: finding.confidence,
          risk: "medium",
          evidence: finding.data.slice(0, 150),
          active: true,
          metadata: {},
        });
      }
    }
  }
  return assets;
}

function extractAdminPortals(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): AssetEntry[] {
  const assets: AssetEntry[] = [];
  const seen = new Set<string>();

  const adminPatterns = [
    /\/admin\b/i, /\/administrator\b/i, /\/manage\b/i, /\/dashboard\b/i,
    /\/console\b/i, /\/cp\b/i, /\/control\b/i, /\/panel\b/i,
    /\/wp-admin\b/i, /\/phpmyadmin\b/i,
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const pattern of adminPatterns) {
      const m = finding.data.match(pattern);
      if (m) {
        const match = m[0];
        if (seen.has(match)) continue;
        seen.add(match);
        assets.push({
          id: `adm_${assets.length}`,
          value: match,
          category: "admin_portal",
          subtype: "admin_path",
          source, sourceLabel, tier,
          confidence: finding.confidence,
          risk: "critical",
          evidence: finding.data.slice(0, 150),
          active: true,
          metadata: {},
        });
      }
    }
  }
  return assets;
}

function extractDevSystems(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): AssetEntry[] {
  const assets: AssetEntry[] = [];
  const seen = new Set<string>();

  const devPatterns = [
    /\b(dev|develop|development)\.[\w.-]+\b/i,
    /\b(ci|cd|jenkins|gitlab-ci|circleci|build)\.[\w.-]+\b/i,
    /\b(test|testing|sandbox)\.[\w.-]+\b/i,
    /\b(staging|stage|preprod|pre-prod)\.[\w.-]+\b/i,
    /\b(qa|uat|preview)\.[\w.-]+\b/i,
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const pattern of devPatterns) {
      const m = finding.data.match(pattern);
      if (m) {
        const hostname = m[0];
        if (seen.has(hostname)) continue;
        seen.add(hostname);
        const isStaging = /stag|preprod|qa|uat|preview/i.test(hostname);
        assets.push({
          id: `dev_${assets.length}`,
          value: hostname,
          category: isStaging ? "staging" : "development",
          subtype: isStaging ? "staging_environment" : "dev_environment",
          source, sourceLabel, tier,
          confidence: finding.confidence,
          risk: "high",
          evidence: finding.data.slice(0, 150),
          active: true,
          metadata: {},
        });
      }
    }
  }
  return assets;
}

function extractStagingSystems(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): AssetEntry[] {
  // Staging systems are extracted as part of devSystems (isStaging flag)
  // This function returns empty — staging assets are already captured
  return [];
}

// =====================
// Helpers
// =====================

function buildCategorySummary(category: AssetCategory, assets: AssetEntry[]): CategorySummary {
  const riskCounts: Record<AssetRisk, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  let activeCount = 0;
  for (const a of assets) {
    riskCounts[a.risk]++;
    if (a.active) activeCount++;
  }
  const topRisk: AssetRisk =
    riskCounts.critical > 0 ? "critical" :
    riskCounts.high > 0 ? "high" :
    riskCounts.medium > 0 ? "medium" :
    riskCounts.low > 0 ? "low" : "info";

  return {
    category,
    label: CATEGORY_LABELS[category],
    count: assets.length,
    activeCount,
    riskCounts,
    topRisk,
  };
}

function buildKeyFindings(assets: AssetEntry[], summaries: CategorySummary[]): string[] {
  const findings: string[] = [];

  const criticalAssets = assets.filter((a) => a.risk === "critical");
  if (criticalAssets.length > 0) {
    findings.push(`${criticalAssets.length} critical-risk assets discovered: ${criticalAssets.slice(0, 3).map((a) => a.value).join(", ")}`);
  }

  const adminPortals = assets.filter((a) => a.category === "admin_portal");
  if (adminPortals.length > 0) {
    findings.push(`${adminPortals.length} admin/management portals detected — verify access controls`);
  }

  const devSystems = assets.filter((a) => a.category === "development" || a.category === "staging");
  if (devSystems.length > 0) {
    findings.push(`${devSystems.length} development/staging systems exposed — may have weaker controls`);
  }

  const storageAssets = assets.filter((a) => a.category === "storage");
  if (storageAssets.length > 0) {
    findings.push(`${storageAssets.length} storage assets detected — verify public access restrictions`);
  }

  const openPorts = assets.filter((a) => a.category === "port");
  if (openPorts.length > 0) {
    const highRiskPorts = openPorts.filter((a) => a.risk === "high");
    if (highRiskPorts.length > 0) {
      findings.push(`${highRiskPorts.length} high-risk open ports: ${highRiskPorts.map((a) => `${a.value} (${a.subtype})`).join(", ")}`);
    }
  }

  const subdomains = assets.filter((a) => a.category === "subdomain");
  if (subdomains.length > 0) {
    findings.push(`${subdomains.length} subdomains discovered — each is a potential attack vector`);
  }

  if (findings.length === 0) {
    findings.push("No significant attack surface assets identified from available evidence.");
  }

  return findings;
}

function buildAssessmentExplanation(
  total: number, active: number, high: number, critical: number,
  score: number, level: string, summaries: CategorySummary[]
): string {
  const parts: string[] = [];
  parts.push(`Attack surface score: ${score}/100 (${level.toUpperCase()})`);
  parts.push(`${total} total assets discovered (${active} active)`);
  if (high > 0) parts.push(`${high} high-risk assets`);
  if (critical > 0) parts.push(`${critical} critical-risk assets`);

  const catSummary = summaries
    .map((s) => `${s.label}: ${s.count}`)
    .join(", ");
  if (catSummary) parts.push(`Categories: ${catSummary}`);

  if (score >= 60) {
    parts.push("Attack surface is SIGNIFICANT — multiple exposed assets require attention");
  } else if (score >= 30) {
    parts.push("Attack surface is MODERATE — some exposed assets should be reviewed");
  } else {
    parts.push("Attack surface is MINIMAL — limited exposure detected");
  }

  return parts.join(". ") + ".";
}
