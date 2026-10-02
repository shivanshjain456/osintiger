// Visual Intelligence Dashboard — data aggregator (Feature 28)
//
// Collects entities, relationships, timeline events, geopoints, coverage,
// confidence, and progress data from the investigation + KB into a single
// dashboard data structure that powers all 9 visualization types.

import type { ReportData, SourceResult, SourceConsulted, Geopoint, TimelineEvent } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";
import { db } from "@/lib/db";

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export interface DashboardEntity {
  id: string;
  label: string;
  type: string;
  confidence: number;
  tier: ReliabilityTier;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  weight: number;
  isObserved: boolean;
  isInferred: boolean;
  evidenceCount: number;
  firstSeen: string;
  lastSeen: string;
  attributes: Record<string, string>;
  cluster?: string;
}

export interface DashboardRelationship {
  id: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  type: string;
  label: string;
  confidence: number;
  tier: ReliabilityTier;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  isObserved: boolean;
  isInferred: boolean;
  weight: number;
  timestamp: string;
}

export interface DashboardTimelineEvent {
  id: string;
  timestamp: string;
  date: string;
  event: string;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  confidence: number;
  category: "infrastructure" | "person" | "document" | "alert" | "collection" | "synthesis" | "other";
  entityId?: string;
  evidenceId?: string;
}

export interface DashboardGeopoint {
  id: string;
  label: string;
  country?: string;
  lat?: number;
  lon?: number;
  weight: number;
  confidence: number;
  note?: string;
  source: string;
  sourceLabel: string;
  isApproximate: boolean;
  entityId?: string;
}

export interface DashboardSourceCoverage {
  sourceKey: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  status: "success" | "error" | "skipped" | "timeout" | "loading";
  findingCount: number;
  latencyMs?: number;
  error?: string;
  lastCollected: string;
  category: string;
}

export interface DashboardConfidenceCell {
  rowId: string;
  rowLabel: string;
  rowType: string;
  colId: string;
  colLabel: string;
  confidence: number;
  evidenceCount: number;
  hasContradiction: boolean;
}

export interface DashboardProgress {
  overallPercent: number;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  steps: { id: string; label: string; status: string; detail?: string }[];
  evidenceCollected: number;
  entitiesResolved: number;
  relationshipsFound: number;
  contradictionsDetected: number;
  contradictionsResolved: number;
  coveragePercent: number;
  gapsRemaining: number;
  isComplete: boolean;
  isStalled: boolean;
}

export interface DashboardCluster {
  id: string;
  label: string;
  entityIds: string[];
  entityCount: number;
  dominantType: string;
  avgConfidence: number;
  evidenceDensity: number;
  rationale: string;
}

export interface DashboardSankeyLink {
  source: string;
  target: string;
  value: number;
  sourceType: string;
  targetType: string;
}

export interface DashboardInfrastructureNode {
  id: string;
  label: string;
  type: "domain" | "subdomain" | "ip" | "service" | "certificate" | "cdn" | "proxy";
  parent?: string;
  children: string[];
  confidence: number;
  isExposed: boolean;
  source: string;
  metadata: Record<string, string>;
}

export interface DashboardData {
  investigationId: string;
  target: string;
  inputType: string;
  generatedAt: string;
  entities: DashboardEntity[];
  relationships: DashboardRelationship[];
  timelineEvents: DashboardTimelineEvent[];
  geopoints: DashboardGeopoint[];
  sourceCoverage: DashboardSourceCoverage[];
  confidenceMatrix: DashboardConfidenceCell[];
  progress: DashboardProgress;
  clusters: DashboardCluster[];
  sankeyLinks: DashboardSankeyLink[];
  infrastructureNodes: DashboardInfrastructureNode[];
  stats: {
    totalEntities: number;
    totalRelationships: number;
    totalTimelineEvents: number;
    totalGeopoints: number;
    totalSources: number;
    successfulSources: number;
    avgConfidence: number;
    highConfidenceEntities: number;
    lowConfidenceEntities: number;
    observedEntities: number;
    inferredEntities: number;
    observedRelationships: number;
    inferredRelationships: number;
    contradictionsCount: number;
  };
}

// ============================================================================
// DATA AGGREGATOR
// ============================================================================

export async function buildDashboardData(
  investigationId: string,
  report: ReportData | null,
  sourceResults: SourceResult[],
  target: string,
  inputType: string,
  currentStep: number,
  totalSteps: number,
  steps: { id: string; label: string; status: string; detail?: string }[]
): Promise<DashboardData> {
  const now = new Date().toISOString();

  // 1. Build entities from link graph + source findings
  const entities = buildEntities(report, sourceResults, target);

  // 2. Build relationships from link graph
  const relationships = buildRelationships(report, sourceResults);

  // 3. Build timeline events
  const timelineEvents = buildTimelineEvents(report, sourceResults, investigationId);

  // 4. Build geopoints
  const geopoints = buildGeopoints(report, sourceResults);

  // 5. Build source coverage
  const sourceCoverage = buildSourceCoverage(report, sourceResults);

  // 6. Build confidence matrix (entities × source categories)
  const confidenceMatrix = buildConfidenceMatrix(entities, sourceResults);

  // 7. Build progress
  const progress = buildProgress(report, sourceResults, entities, relationships, currentStep, totalSteps, steps);

  // 8. Build clusters (group entities by type + source overlap)
  const clusters = buildClusters(entities, relationships);

  // 9. Build Sankey links (source → entity type)
  const sankeyLinks = buildSankeyLinks(sourceResults, entities);

  // 10. Build infrastructure nodes
  const infrastructureNodes = buildInfrastructureNodes(entities, relationships, sourceResults);

  // 11. Build stats
  const stats = {
    totalEntities: entities.length,
    totalRelationships: relationships.length,
    totalTimelineEvents: timelineEvents.length,
    totalGeopoints: geopoints.length,
    totalSources: sourceCoverage.length,
    successfulSources: sourceCoverage.filter((s) => s.status === "success").length,
    avgConfidence: entities.length > 0 ? entities.reduce((s, e) => s + e.confidence, 0) / entities.length : 0,
    highConfidenceEntities: entities.filter((e) => e.confidence >= 0.7).length,
    lowConfidenceEntities: entities.filter((e) => e.confidence < 0.4).length,
    observedEntities: entities.filter((e) => e.isObserved).length,
    inferredEntities: entities.filter((e) => e.isInferred).length,
    observedRelationships: relationships.filter((r) => r.isObserved).length,
    inferredRelationships: relationships.filter((r) => r.isInferred).length,
    contradictionsCount: report?.contradictions?.length || 0,
  };

  return {
    investigationId,
    target,
    inputType,
    generatedAt: now,
    entities,
    relationships,
    timelineEvents,
    geopoints,
    sourceCoverage,
    confidenceMatrix,
    progress,
    clusters,
    sankeyLinks,
    infrastructureNodes,
    stats,
  };
}

// ============================================================================
// Entity Builder
// ============================================================================

function buildEntities(
  report: ReportData | null,
  sourceResults: SourceResult[],
  target: string
): DashboardEntity[] {
  const entities: DashboardEntity[] = [];
  const seen = new Set<string>();

  // Add target as first entity
  const targetType = detectEntityType(target);
  entities.push({
    id: "entity_target",
    label: target,
    type: targetType,
    confidence: 1.0,
    tier: 5,
    source: "user",
    sourceLabel: "User input",
    sourceUrl: "",
    weight: 10,
    isObserved: true,
    isInferred: false,
    evidenceCount: 1,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    attributes: {},
  });
  seen.add(target.toLowerCase());

  // Extract from link graph
  if (report?.link_graph) {
    for (const node of report.link_graph.nodes) {
      if (seen.has(node.label.toLowerCase())) continue;
      seen.add(node.label.toLowerCase());
      entities.push({
        id: `entity_${entities.length}`,
        label: node.label,
        type: node.type,
        confidence: 0.6,
        tier: getReliabilityTier(node.source),
        source: node.source,
        sourceLabel: node.source,
        sourceUrl: "",
        weight: node.weight,
        isObserved: true,
        isInferred: false,
        evidenceCount: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        attributes: {},
      });
    }
  }

  // Extract from source findings (domains, IPs, emails)
  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      const text = f.data;
      // Extract domains
      for (const m of text.matchAll(/\b([\w-]+\.){1,}[\w]{2,}\b/gi)) {
        const val = m[0].toLowerCase();
        if (seen.has(val) || val.length < 4) continue;
        seen.add(val);
        entities.push({
          id: `entity_${entities.length}`,
          label: val,
          type: "domain",
          confidence: f.confidence,
          tier,
          source: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          weight: 5,
          isObserved: true,
          isInferred: false,
          evidenceCount: 1,
          firstSeen: f.timestamp,
          lastSeen: f.timestamp,
          attributes: extractAttributes(text),
        });
      }
      // Extract IPs
      for (const m of text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g)) {
        const val = m[1];
        if (seen.has(val) || isPrivateIP(val)) continue;
        seen.add(val);
        entities.push({
          id: `entity_${entities.length}`,
          label: val,
          type: "ip",
          confidence: f.confidence,
          tier,
          source: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          weight: 5,
          isObserved: true,
          isInferred: false,
          evidenceCount: 1,
          firstSeen: f.timestamp,
          lastSeen: f.timestamp,
          attributes: extractAttributes(text),
        });
      }
      // Extract emails
      for (const m of text.matchAll(/[\w.-]+@[\w.-]+\.\w+/g)) {
        const val = m[0].toLowerCase();
        if (seen.has(val)) continue;
        seen.add(val);
        entities.push({
          id: `entity_${entities.length}`,
          label: val,
          type: "email",
          confidence: f.confidence,
          tier,
          source: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          weight: 3,
          isObserved: true,
          isInferred: false,
          evidenceCount: 1,
          firstSeen: f.timestamp,
          lastSeen: f.timestamp,
          attributes: {},
        });
      }
    }
  }

  // Cap at 100 entities for performance
  return entities.slice(0, 100);
}

function detectEntityType(value: string): string {
  const v = value.trim();
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v)) return "ip";
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) return "wallet";
  if (/[\w.-]+@[\w.-]+\.\w+/.test(v)) return "email";
  if (/\.([a-z]{2,})$/i.test(v)) return "domain";
  return "organization";
}

function extractAttributes(text: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const orgMatch = text.match(/(?:organization|org|company)\s*:?\s*([^,.\n]+)/i);
  if (orgMatch) attrs.organization = orgMatch[1].trim().slice(0, 80);
  const locMatch = text.match(/(?:location|city|country)\s*:?\s*([^,.\n]+)/i);
  if (locMatch) attrs.location = locMatch[1].trim().slice(0, 80);
  return attrs;
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

// ============================================================================
// Relationship Builder
// ============================================================================

function buildRelationships(
  report: ReportData | null,
  sourceResults: SourceResult[]
): DashboardRelationship[] {
  const rels: DashboardRelationship[] = [];

  // From link graph
  if (report?.link_graph) {
    const nodeMap = new Map(report.link_graph.nodes.map((n) => [n.id, n]));
    for (const edge of report.link_graph.edges) {
      const fromNode = nodeMap.get(edge.from);
      const toNode = nodeMap.get(edge.to);
      rels.push({
        id: `rel_${rels.length}`,
        from: edge.from,
        to: edge.to,
        fromLabel: fromNode?.label || edge.from,
        toLabel: toNode?.label || edge.to,
        type: "related_to",
        label: edge.label,
        confidence: edge.confidence,
        tier: getReliabilityTier(edge.source),
        source: edge.source,
        sourceLabel: edge.source,
        sourceUrl: "",
        isObserved: edge.confidence >= 0.5,
        isInferred: edge.confidence < 0.5,
        weight: edge.confidence * 10,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Extract domain→IP relationships from findings
  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      const text = f.data;
      const domains = [...text.matchAll(/\b([\w-]+\.){1,}[\w]{2,}\b/gi)].map((m) => m[0].toLowerCase());
      const ips = [...text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g)].map((m) => m[1]).filter((ip) => !isPrivateIP(ip));

      for (const domain of domains) {
        for (const ip of ips) {
          if (domain === ip) continue;
          const relId = `rel_${rels.length}`;
          rels.push({
            id: relId,
            from: `entity:${domain}`,
            to: `entity:${ip}`,
            fromLabel: domain,
            toLabel: ip,
            type: "resolves_to",
            label: `${domain} resolves to ${ip}`,
            confidence: f.confidence,
            tier,
            source: sr.source,
            sourceLabel: sr.source_label,
            sourceUrl: f.source_url,
            isObserved: true,
            isInferred: false,
            weight: f.confidence * 10,
            timestamp: f.timestamp,
          });
        }
      }
    }
  }

  // Cap at 200 relationships for performance
  return rels.slice(0, 200);
}

// ============================================================================
// Timeline Builder
// ============================================================================

function buildTimelineEvents(
  report: ReportData | null,
  sourceResults: SourceResult[],
  investigationId: string
): DashboardTimelineEvent[] {
  const events: DashboardTimelineEvent[] = [];
  let id = 0;

  // From report timeline
  if (report?.timeline) {
    for (const t of report.timeline) {
      events.push({
        id: `tl_${id++}`,
        timestamp: t.date,
        date: t.date,
        event: t.event,
        source: t.source,
        sourceLabel: t.source,
        sourceUrl: t.source_url,
        confidence: t.confidence,
        category: categorizeEvent(t.event, t.source),
      });
    }
  }

  // From source findings (collection events)
  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    for (const f of sr.findings) {
      events.push({
        id: `tl_${id++}`,
        timestamp: f.timestamp,
        date: f.timestamp,
        event: f.data.slice(0, 200),
        source: sr.source,
        sourceLabel: sr.source_label,
        sourceUrl: f.source_url,
        confidence: f.confidence,
        category: categorizeEvent(f.data, sr.source),
        evidenceId: `${investigationId}:finding:${sr.source}`,
      });
    }
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return events;
}

function categorizeEvent(text: string, source: string): DashboardTimelineEvent["category"] {
  const lower = text.toLowerCase();
  if (["dns_google", "doh", "crtsh", "openrdap", "shodan_internetdb", "bgpview"].includes(source)) return "infrastructure";
  if (/dns|certificate|ip address|hosting|server|infrastructure/.test(lower)) return "infrastructure";
  if (/person|executive|ceo|founder|employee/.test(lower)) return "person";
  if (/document|filing|record|report/.test(lower)) return "document";
  if (/alert|threat|malicious|suspicious|breach/.test(lower)) return "alert";
  return "other";
}

// ============================================================================
// Geopoint Builder
// ============================================================================

function buildGeopoints(
  report: ReportData | null,
  sourceResults: SourceResult[]
): DashboardGeopoint[] {
  const points: DashboardGeopoint[] = [];
  let id = 0;

  // From report geopoints
  if (report?.geopoints) {
    for (const gp of report.geopoints) {
      points.push({
        id: `geo_${id++}`,
        label: gp.label,
        country: gp.country,
        lat: gp.lat,
        lon: gp.lon,
        weight: gp.weight,
        confidence: gp.weight,
        note: gp.note,
        source: gp.source,
        sourceLabel: gp.source,
        isApproximate: !gp.lat || !gp.lon,
      });
    }
  }

  // Extract location data from IP geo sources
  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    if (!["ipinfo", "ipquery", "ipwhois", "ipapico", "freeipapi", "openrdap"].includes(sr.source)) continue;
    for (const f of sr.findings) {
      const text = f.data;
      const latMatch = text.match(/lat(?:itude)?[:\s]+(-?\d+\.?\d*)/i);
      const lonMatch = text.match(/lon(?:gitude)?[:\s]+(-?\d+\.?\d*)/i);
      const cityMatch = text.match(/city[:\s]+([^,\n]+)/i);
      const countryMatch = text.match(/country[:\s]+([^,\n]+)/i);

      if (latMatch && lonMatch) {
        const lat = parseFloat(latMatch[1]);
        const lon = parseFloat(lonMatch[1]);
        const label = cityMatch?.[1]?.trim() || countryMatch?.[1]?.trim() || `${lat.toFixed(2)},${lon.toFixed(2)}`;
        // Check for duplicates
        if (points.some((p) => p.lat === lat && p.lon === lon)) continue;
        points.push({
          id: `geo_${id++}`,
          label,
          country: countryMatch?.[1]?.trim(),
          lat,
          lon,
          weight: f.confidence,
          confidence: f.confidence,
          source: sr.source,
          sourceLabel: sr.source_label,
          isApproximate: false,
        });
      }
    }
  }

  return points;
}

// ============================================================================
// Source Coverage Builder
// ============================================================================

function buildSourceCoverage(
  report: ReportData | null,
  sourceResults: SourceResult[]
): DashboardSourceCoverage[] {
  const coverage: DashboardSourceCoverage[] = [];

  // From sources consulted in report
  const consultedMap = new Map<string, SourceConsulted>();
  if (report?.sources_consulted) {
    for (const s of report.sources_consulted) {
      consultedMap.set(s.source, s);
    }
  }

  // From source results
  for (const sr of sourceResults) {
    const consulted = consultedMap.get(sr.source);
    coverage.push({
      sourceKey: sr.source,
      sourceLabel: sr.source_label,
      tier: getReliabilityTier(sr.source),
      status: sr.status,
      findingCount: sr.findings.length,
      latencyMs: sr.latency_ms,
      error: sr.error,
      lastCollected: new Date().toISOString(),
      category: categorizeSource(sr.source),
    });
  }

  return coverage;
}

function categorizeSource(source: string): string {
  if (["edgar", "opencorporates", "gleif", "icij", "fec", "usaspending"].includes(source)) return "Corporate/Legal";
  if (["crtsh", "dns_google", "doh", "openrdap", "domainsdb"].includes(source)) return "DNS/Certificate";
  if (["ipinfo", "ipquery", "ipwhois", "ipapico", "freeipapi", "bgpview", "peeringdb"].includes(source)) return "IP/Network";
  if (["shodan_internetdb", "otx", "abuseipdb", "virustotal", "greynoise", "threatfox", "urlhaus", "malwarebazaar", "hashrep"].includes(source)) return "Threat Intel";
  if (["nvd", "cisa_kev", "osv", "cveorg", "epss", "shodan_cvedb"].includes(source)) return "Vulnerability";
  if (["ofac", "opensanctions", "interpol"].includes(source)) return "Sanctions";
  if (["github", "gitlab", "reddit", "hackernews", "stackexchange", "whatsmyname", "usernamesearch", "gravatar"].includes(source)) return "Social/Dev";
  if (["wayback", "archiveorg", "urlscan"].includes(source)) return "Archive";
  if (["wikipedia", "wikinews", "gdelt", "googlenews"].includes(source)) return "Reference/News";
  if (["web_search", "duckduckgo"].includes(source)) return "Search";
  return "Other";
}

// ============================================================================
// Confidence Matrix Builder
// ============================================================================

function buildConfidenceMatrix(
  entities: DashboardEntity[],
  sourceResults: SourceResult[]
): DashboardConfidenceCell[] {
  const cells: DashboardConfidenceCell[] = [];
  const sourceCats = [...new Set(sourceResults.map((sr) => categorizeSource(sr.source)))].slice(0, 8);

  for (const entity of entities.slice(0, 20)) {
    for (const cat of sourceCats) {
      // Check if any source in this category mentions this entity
      const relevantSources = sourceResults.filter((sr) => categorizeSource(sr.source) === cat && sr.status === "success");
      let evidenceCount = 0;
      let maxConfidence = 0;
      let hasContradiction = false;

      for (const sr of relevantSources) {
        for (const f of sr.findings) {
          if (f.data.toLowerCase().includes(entity.label.toLowerCase())) {
            evidenceCount++;
            maxConfidence = Math.max(maxConfidence, f.confidence);
          }
        }
      }

      if (evidenceCount > 0) {
        cells.push({
          rowId: entity.id,
          rowLabel: entity.label,
          rowType: entity.type,
          colId: cat,
          colLabel: cat,
          confidence: maxConfidence,
          evidenceCount,
          hasContradiction,
        });
      }
    }
  }

  return cells;
}

// ============================================================================
// Progress Builder
// ============================================================================

function buildProgress(
  report: ReportData | null,
  sourceResults: SourceResult[],
  entities: DashboardEntity[],
  relationships: DashboardRelationship[],
  currentStep: number,
  totalSteps: number,
  steps: { id: string; label: string; status: string; detail?: string }[]
): DashboardProgress {
  const successfulSources = sourceResults.filter((sr) => sr.status === "success").length;
  const totalSources = sourceResults.length;
  const coveragePercent = totalSources > 0 ? (successfulSources / totalSources) * 100 : 0;
  const overallPercent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const contradictions = report?.contradictions?.length || 0;

  return {
    overallPercent,
    currentStep,
    totalSteps,
    stepName: steps[currentStep - 1]?.label || "",
    steps,
    evidenceCollected: sourceResults.reduce((s, sr) => s + (sr.findings?.length || 0), 0),
    entitiesResolved: entities.length,
    relationshipsFound: relationships.length,
    contradictionsDetected: contradictions,
    contradictionsResolved: 0,
    coveragePercent,
    gapsRemaining: report?.collection_gaps?.length || 0,
    isComplete: currentStep >= totalSteps,
    isStalled: currentStep > 0 && currentStep < totalSteps && overallPercent < 50,
  };
}

// ============================================================================
// Cluster Builder
// ============================================================================

function buildClusters(
  entities: DashboardEntity[],
  relationships: DashboardRelationship[]
): DashboardCluster[] {
  const clusters: DashboardCluster[] = [];
  const entityClusters = new Map<string, Set<string>>();

  // Group entities by type
  const byType = new Map<string, string[]>();
  for (const e of entities) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e.id);
  }

  let clusterId = 0;
  for (const [type, ids] of byType) {
    if (ids.length < 2) continue;
    const clusterEntities = entities.filter((e) => ids.includes(e.id));
    const avgConf = clusterEntities.reduce((s, e) => s + e.confidence, 0) / clusterEntities.length;
    clusters.push({
      id: `cluster_${clusterId++}`,
      label: `${type} cluster (${ids.length})`,
      entityIds: ids,
      entityCount: ids.length,
      dominantType: type,
      avgConfidence: avgConf,
      evidenceDensity: clusterEntities.reduce((s, e) => s + e.evidenceCount, 0),
      rationale: `Grouped by entity type: ${type}`,
    });
  }

  return clusters;
}

// ============================================================================
// Sankey Link Builder
// ============================================================================

function buildSankeyLinks(
  sourceResults: SourceResult[],
  entities: DashboardEntity[]
): DashboardSankeyLink[] {
  const links: DashboardSankeyLink[] = [];

  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    const sourceCat = categorizeSource(sr.source);

    // Count entities found by this source category
    const entityTypes = new Set<string>();
    for (const f of sr.findings) {
      const text = f.data;
      if (/\b([\w-]+\.){1,}[\w]{2,}\b/i.test(text)) entityTypes.add("domain");
      if (/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(text)) entityTypes.add("ip");
      if (/[\w.-]+@[\w.-]+\.\w+/.test(text)) entityTypes.add("email");
      if (/person|ceo|founder/i.test(text)) entityTypes.add("person");
      if (/company|corp|organization/i.test(text)) entityTypes.add("organization");
    }

    for (const type of entityTypes) {
      links.push({
        source: sourceCat,
        target: type,
        value: sr.findings.length,
        sourceType: "source",
        targetType: "entity",
      });
    }
  }

  return links;
}

// ============================================================================
// Infrastructure Node Builder
// ============================================================================

function buildInfrastructureNodes(
  entities: DashboardEntity[],
  relationships: DashboardRelationship[],
  sourceResults: SourceResult[]
): DashboardInfrastructureNode[] {
  const nodes: DashboardInfrastructureNode[] = [];
  const entityMap = new Map(entities.map((e) => [`entity:${e.label.toLowerCase()}`, e]));

  // Add domains
  for (const e of entities) {
    if (e.type !== "domain") continue;
    const isSubdomain = e.label.split(".").length > 2;
    nodes.push({
      id: `infra_${e.id}`,
      label: e.label,
      type: isSubdomain ? "subdomain" : "domain",
      children: [],
      confidence: e.confidence,
      isExposed: true,
      source: e.source,
      metadata: e.attributes,
    });
  }

  // Add IPs
  for (const e of entities) {
    if (e.type !== "ip") continue;
    nodes.push({
      id: `infra_${e.id}`,
      label: e.label,
      type: "ip",
      children: [],
      confidence: e.confidence,
      isExposed: true,
      source: e.source,
      metadata: e.attributes,
    });
  }

  // Link domains to IPs via resolves_to relationships
  for (const rel of relationships) {
    if (rel.type !== "resolves_to") continue;
    const fromNode = nodes.find((n) => n.label === rel.fromLabel);
    const toNode = nodes.find((n) => n.label === rel.toLabel);
    if (fromNode && toNode) {
      fromNode.children.push(toNode.id);
    }
  }

  return nodes.slice(0, 50);
}
