// Organization Hierarchy Intelligence — domain models and extractor.
// Identifies, normalizes, and visualizes organizational structural relationships:
// 1. Parent organizations — controlling entities
// 2. Subsidiaries — owned/controlled entities
// 3. Brands — consumer-facing brands
// 4. Acquisitions — acquisition events
// 5. Founders — founding individuals
// 6. Executives — leadership roles
// 7. Investors — capital providers
// 8. Partners — strategic partnerships
//
// Each relationship includes: type, direction, confidence, evidence, source, temporal context.
// Builds a graph (org tree) with typed nodes and edges.

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Entity Types
// =====================

export type EntityType =
  | "organization" | "person" | "brand" | "investor" | "partner" | "subsidiary" | "parent_org";

export type RelationshipType =
  | "parent_of" | "subsidiary_of" | "operates_brand" | "acquired" | "acquired_by"
  | "founded_by" | "executive_of" | "invested_in" | "partnered_with" | "same_as";

// =====================
// Org Entity
// =====================

export interface OrgEntity {
  id: string;
  name: string;
  type: EntityType;
  /** Normalized name (legal suffixes removed). */
  normalizedName: string;
  /** Legal suffix (Inc, LLC, Ltd, GmbH, etc.). */
  legalSuffix?: string;
  /** Jurisdiction if known. */
  jurisdiction?: string;
  /** Aliases / trade names. */
  aliases: string[];
  /** Role/title for persons. */
  role?: string;
  /** Source. */
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  confidence: number;
  evidence: string;
}

// =====================
// Relationship
// =====================

export interface OrgRelationship {
  id: string;
  from: string; // entity ID
  to: string; // entity ID
  type: RelationshipType;
  /** Confidence (0-1). */
  confidence: number;
  /** Whether this is confirmed or inferred. */
  status: "confirmed" | "inferred" | "hypothesized";
  /** Temporal context. */
  startDate?: string;
  endDate?: string;
  /** Additional detail (e.g., "CEO since 2020", "$10M Series A"). */
  detail: string;
  /** Source. */
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  evidence: string;
}

// =====================
// Hierarchy Graph
// =====================

export interface HierarchyNode {
  id: string;
  label: string;
  type: EntityType;
  weight: number;
  meta: { role?: string; jurisdiction?: string; legalSuffix?: string };
}

export interface HierarchyEdge {
  from: string;
  to: string;
  type: RelationshipType;
  label: string;
  confidence: number;
  status: string;
}

export interface HierarchyGraph {
  nodes: HierarchyNode[];
  edges: HierarchyEdge[];
}

// =====================
// Category Summary
// =====================

export interface CategorySummary {
  type: RelationshipType;
  label: string;
  count: number;
  entities: string[];
}

// =====================
// Complete Report
// =====================

export interface OrgHierarchyReport {
  entities: OrgEntity[];
  relationships: OrgRelationship[];
  graph: HierarchyGraph;
  summaries: CategorySummary[];
  assessment: {
    totalEntities: number;
    totalRelationships: number;
    entityTypes: Record<EntityType, number>;
    relationshipTypes: Record<RelationshipType, number>;
    confirmedCount: number;
    inferredCount: number;
    complexity: "minimal" | "moderate" | "complex";
    explanation: string;
  };
  keyFindings: string[];
  meta: {
    sourcesAnalyzed: number;
    findingsAnalyzed: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface OrgHierarchyApiResponse {
  investigation_id: string;
  report: OrgHierarchyReport;
}

// =====================
// Labels
// =====================

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  parent_of: "Parent Organization",
  subsidiary_of: "Subsidiary",
  operates_brand: "Brand",
  acquired: "Acquisition",
  acquired_by: "Acquired By",
  founded_by: "Founder",
  executive_of: "Executive",
  invested_in: "Investor",
  partnered_with: "Partner",
  same_as: "Same As (Alias)",
};

export const ENTITY_LABELS: Record<EntityType, string> = {
  organization: "Organization",
  person: "Person",
  brand: "Brand",
  investor: "Investor",
  partner: "Partner",
  subsidiary: "Subsidiary",
  parent_org: "Parent Organization",
};

// =====================
// Extractor
// =====================

export function extractOrgHierarchy(sourceResults: SourceResult[], target: string): OrgHierarchyReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  const entities: OrgEntity[] = [];
  const relationships: OrgRelationship[] = [];
  const entityMap = new Map<string, OrgEntity>();

  // Create target entity
  const targetEntity: OrgEntity = {
    id: "ent_target",
    name: target,
    type: "organization",
    normalizedName: normalizeEntityName(target),
    aliases: [],
    source: "user",
    sourceLabel: "User input",
    tier: 5,
    confidence: 1.0,
    evidence: `Original target: ${target}`,
  };
  entities.push(targetEntity);
  entityMap.set(targetEntity.id, targetEntity);

  // 1. Extract parent/subsidiary relationships
  extractOwnership(allFindings, target, entities, relationships, entityMap);

  // 2. Extract brands
  extractBrands(allFindings, target, entities, relationships, entityMap);

  // 3. Extract acquisitions
  extractAcquisitions(allFindings, target, entities, relationships, entityMap);

  // 4. Extract founders
  extractFounders(allFindings, target, entities, relationships, entityMap);

  // 5. Extract executives
  extractExecutives(allFindings, target, entities, relationships, entityMap);

  // 6. Extract investors
  extractInvestors(allFindings, target, entities, relationships, entityMap);

  // 7. Extract partners
  extractPartners(allFindings, target, entities, relationships, entityMap);

  // Build graph
  const graph = buildHierarchyGraph(entities, relationships);

  // Build summaries
  const summaries = buildSummaries(relationships);

  // Assessment
  const totalEntities = entities.length;
  const totalRelationships = relationships.length;
  const entityTypes = {} as Record<EntityType, number>;
  const relationshipTypes = {} as Record<RelationshipType, number>;
  for (const e of entities) entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
  for (const r of relationships) relationshipTypes[r.type] = (relationshipTypes[r.type] || 0) + 1;

  const confirmedCount = relationships.filter((r) => r.status === "confirmed").length;
  const inferredCount = relationships.filter((r) => r.status === "inferred").length;
  const complexity: "minimal" | "moderate" | "complex" =
    totalRelationships > 10 ? "complex" : totalRelationships > 3 ? "moderate" : "minimal";

  const keyFindings = buildKeyFindings(entities, relationships, summaries);
  const explanation = buildAssessmentExplanation(totalEntities, totalRelationships, entityTypes, relationshipTypes, confirmedCount, inferredCount, complexity, summaries);

  return {
    entities,
    relationships,
    graph,
    summaries,
    assessment: {
      totalEntities,
      totalRelationships,
      entityTypes,
      relationshipTypes,
      confirmedCount,
      inferredCount,
      complexity,
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
// Name Normalization
// =====================

function normalizeEntityName(name: string): string {
  return name
    .replace(/\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|GmbH|S\.?A\.?|AG|Sarl|BV|NV|Pty\.?|Plc|Co\.?|Group|Holdings|Foundation|Limited)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLegalSuffix(name: string): string | undefined {
  const match = name.match(/\b(Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|GmbH|S\.?A\.?|AG|Sarl|BV|NV|Pty\.?|Plc|Co\.?|Group|Holdings|Foundation|Limited)\b\.?$/i);
  return match ? match[1] : undefined;
}

function entityIdFor(name: string, type: EntityType): string {
  const normalized = normalizeEntityName(name).toLowerCase().replace(/[^a-z0-9]/g, "_");
  return `ent_${type}_${normalized}`.slice(0, 50);
}

function addOrMergeEntity(
  entity: OrgEntity,
  entities: OrgEntity[],
  entityMap: Map<string, OrgEntity>
): OrgEntity {
  const existing = entityMap.get(entity.id);
  if (existing) {
    // Merge aliases
    if (entity.name !== existing.name && !existing.aliases.includes(entity.name)) {
      existing.aliases.push(entity.name);
    }
    return existing;
  }
  entities.push(entity);
  entityMap.set(entity.id, entity);
  return entity;
}

// =====================
// Extractors
// =====================

function extractOwnership(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  target: string,
  entities: OrgEntity[],
  relationships: OrgRelationship[],
  entityMap: Map<string, OrgEntity>
): void {
  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;

    // Pattern: "owned by X", "parent company: X", "subsidiary of X"
    let m = text.match(/(?:owned\s+by|parent\s+company:?\s*|controlled\s+by|subsidiary\s+of)\s+([^,.\n]+)/i);
    if (m) {
      const parentName = m[1].trim();
      if (parentName.length > 2 && parentName.toLowerCase() !== target.toLowerCase()) {
        const id = entityIdFor(parentName, "parent_org");
        const parent = addOrMergeEntity({
          id, name: parentName, type: "parent_org",
          normalizedName: normalizeEntityName(parentName),
          legalSuffix: extractLegalSuffix(parentName),
          aliases: [], source, sourceLabel, tier,
          confidence: finding.confidence, evidence: text.slice(0, 150),
        }, entities, entityMap);

        relationships.push({
          id: `rel_${relationships.length}`,
          from: parent.id, to: "ent_target",
          type: "parent_of",
          confidence: finding.confidence,
          status: tier >= 4 ? "confirmed" : "inferred",
          detail: `Parent organization: ${parentName}`,
          source, sourceLabel, tier,
          evidence: text.slice(0, 150),
        });
      }
    }

    // Pattern: "subsidiary X", "owns X", "acquired X"
    m = text.match(/(?:subsidiary|owns?|operates?)\s+([^,.\n]+)/i);
    if (m) {
      const subName = m[1].trim();
      if (subName.length > 2 && subName.toLowerCase() !== target.toLowerCase()) {
        const id = entityIdFor(subName, "subsidiary");
        const sub = addOrMergeEntity({
          id, name: subName, type: "subsidiary",
          normalizedName: normalizeEntityName(subName),
          legalSuffix: extractLegalSuffix(subName),
          aliases: [], source, sourceLabel, tier,
          confidence: finding.confidence, evidence: text.slice(0, 150),
        }, entities, entityMap);

        relationships.push({
          id: `rel_${relationships.length}`,
          from: "ent_target", to: sub.id,
          type: "subsidiary_of",
          confidence: finding.confidence,
          status: tier >= 4 ? "confirmed" : "inferred",
          detail: `Subsidiary: ${subName}`,
          source, sourceLabel, tier,
          evidence: text.slice(0, 150),
        });
      }
    }
  }
}

function extractBrands(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  target: string,
  entities: OrgEntity[],
  relationships: OrgRelationship[],
  entityMap: Map<string, OrgEntity>
): void {
  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // Pattern: "brand X", "trade name X", "also known as X"
    const m = text.match(/(?:brand|trade\s*name|also\s+known\s+as|aka)\s*:?\s*([^,.\n]+)/i);
    if (m) {
      const brandName = m[1].trim();
      if (brandName.length > 1 && brandName.toLowerCase() !== target.toLowerCase()) {
        const id = entityIdFor(brandName, "brand");
        const brand = addOrMergeEntity({
          id, name: brandName, type: "brand",
          normalizedName: brandName, aliases: [],
          source, sourceLabel, tier,
          confidence: finding.confidence, evidence: text.slice(0, 150),
        }, entities, entityMap);

        relationships.push({
          id: `rel_${relationships.length}`,
          from: "ent_target", to: brand.id,
          type: "operates_brand",
          confidence: finding.confidence,
          status: "inferred",
          detail: `Brand: ${brandName}`,
          source, sourceLabel, tier,
          evidence: text.slice(0, 150),
        });
      }
    }
  }
}

function extractAcquisitions(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  target: string,
  entities: OrgEntity[],
  relationships: OrgRelationship[],
  entityMap: Map<string, OrgEntity>
): void {
  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // Pattern: "acquired X", "acquisition of X", "merged with X"
    const m = text.match(/(?:acquired|acquisition\s+of|merged\s+with|bought)\s+([^,.\n]+)/i);
    if (m) {
      const acquiredName = m[1].trim();
      if (acquiredName.length > 2 && acquiredName.toLowerCase() !== target.toLowerCase()) {
        const id = entityIdFor(acquiredName, "organization");
        const acquired = addOrMergeEntity({
          id, name: acquiredName, type: "organization",
          normalizedName: normalizeEntityName(acquiredName),
          legalSuffix: extractLegalSuffix(acquiredName),
          aliases: [], source, sourceLabel, tier,
          confidence: finding.confidence, evidence: text.slice(0, 150),
        }, entities, entityMap);

        relationships.push({
          id: `rel_${relationships.length}`,
          from: "ent_target", to: acquired.id,
          type: "acquired",
          confidence: finding.confidence,
          status: tier >= 3 ? "confirmed" : "inferred",
          detail: `Acquired: ${acquiredName}`,
          source, sourceLabel, tier,
          evidence: text.slice(0, 150),
        });
      }
    }
  }
}

function extractFounders(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  target: string,
  entities: OrgEntity[],
  relationships: OrgRelationship[],
  entityMap: Map<string, OrgEntity>
): void {
  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // Pattern: "founded by X", "co-founder X", "founder X"
    const m = text.match(/(?:founded\s+by|co[- ]?founder|founder)\s*:?\s*([^,.\n]+)/i);
    if (m) {
      const founderName = m[1].trim();
      if (founderName.length > 2) {
        const id = entityIdFor(founderName, "person");
        const founder = addOrMergeEntity({
          id, name: founderName, type: "person",
          normalizedName: founderName, aliases: [],
          role: "Founder",
          source, sourceLabel, tier,
          confidence: finding.confidence, evidence: text.slice(0, 150),
        }, entities, entityMap);

        relationships.push({
          id: `rel_${relationships.length}`,
          from: founder.id, to: "ent_target",
          type: "founded_by",
          confidence: finding.confidence,
          status: tier >= 3 ? "confirmed" : "inferred",
          detail: `Founder: ${founderName}`,
          source, sourceLabel, tier,
          evidence: text.slice(0, 150),
        });
      }
    }
  }
}

function extractExecutives(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  target: string,
  entities: OrgEntity[],
  relationships: OrgRelationship[],
  entityMap: Map<string, OrgEntity>
): void {
  const execPatterns: { regex: RegExp; role: string }[] = [
    { regex: /CEO\s*:?\s*([^,.\n]+)/i, role: "CEO" },
    { regex: /CFO\s*:?\s*([^,.\n]+)/i, role: "CFO" },
    { regex: /CTO\s*:?\s*([^,.\n]+)/i, role: "CTO" },
    { regex: /COO\s*:?\s*([^,.\n]+)/i, role: "COO" },
    { regex: /president\s*:?\s*([^,.\n]+)/i, role: "President" },
    { regex: /chairman\s*:?\s*([^,.\n]+)/i, role: "Chairman" },
    { regex: /board\s+member\s*:?\s*([^,.\n]+)/i, role: "Board Member" },
    { regex: /managing\s+director\s*:?\s*([^,.\n]+)/i, role: "Managing Director" },
    { regex: /executive\s+director\s*:?\s*([^,.\n]+)/i, role: "Executive Director" },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const p of execPatterns) {
      const m = finding.data.match(p.regex);
      if (m) {
        const execName = m[1].trim();
        if (execName.length > 2 && !/^(the|a|an)\s/i.test(execName)) {
          const id = entityIdFor(execName, "person");
          const exec = addOrMergeEntity({
            id, name: execName, type: "person",
            normalizedName: execName, aliases: [],
            role: p.role,
            source, sourceLabel, tier,
            confidence: finding.confidence, evidence: finding.data.slice(0, 150),
          }, entities, entityMap);

          relationships.push({
            id: `rel_${relationships.length}`,
            from: exec.id, to: "ent_target",
            type: "executive_of",
            confidence: finding.confidence,
            status: tier >= 3 ? "confirmed" : "inferred",
            detail: `${p.role}: ${execName}`,
            source, sourceLabel, tier,
            evidence: finding.data.slice(0, 150),
          });
        }
      }
    }
  }
}

function extractInvestors(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  target: string,
  entities: OrgEntity[],
  relationships: OrgRelationship[],
  entityMap: Map<string, OrgEntity>
): void {
  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // Pattern: "funded by X", "investor X", "backed by X", "Series A from X"
    const m = text.match(/(?:funded\s+by|investor|backed\s+by|investment\s+from|Series\s+\w\s+from)\s*:?\s*([^,.\n]+)/i);
    if (m) {
      const investorName = m[1].trim();
      if (investorName.length > 2 && investorName.toLowerCase() !== target.toLowerCase()) {
        const id = entityIdFor(investorName, "investor");
        const investor = addOrMergeEntity({
          id, name: investorName, type: "investor",
          normalizedName: normalizeEntityName(investorName),
          legalSuffix: extractLegalSuffix(investorName),
          aliases: [], source, sourceLabel, tier,
          confidence: finding.confidence, evidence: text.slice(0, 150),
        }, entities, entityMap);

        relationships.push({
          id: `rel_${relationships.length}`,
          from: investor.id, to: "ent_target",
          type: "invested_in",
          confidence: finding.confidence,
          status: tier >= 3 ? "confirmed" : "inferred",
          detail: `Investor: ${investorName}`,
          source, sourceLabel, tier,
          evidence: text.slice(0, 150),
        });
      }
    }
  }
}

function extractPartners(
  findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[],
  target: string,
  entities: OrgEntity[],
  relationships: OrgRelationship[],
  entityMap: Map<string, OrgEntity>
): void {
  for (const { finding, source, sourceLabel, tier } of findings) {
    const text = finding.data;
    // Pattern: "partnered with X", "partnership with X", "strategic partner X"
    const m = text.match(/(?:partnered\s+with|partnership\s+with|strategic\s+partner|partner)\s*:?\s*([^,.\n]+)/i);
    if (m) {
      const partnerName = m[1].trim();
      if (partnerName.length > 2 && partnerName.toLowerCase() !== target.toLowerCase()) {
        const id = entityIdFor(partnerName, "partner");
        const partner = addOrMergeEntity({
          id, name: partnerName, type: "partner",
          normalizedName: normalizeEntityName(partnerName),
          legalSuffix: extractLegalSuffix(partnerName),
          aliases: [], source, sourceLabel, tier,
          confidence: finding.confidence, evidence: text.slice(0, 150),
        }, entities, entityMap);

        relationships.push({
          id: `rel_${relationships.length}`,
          from: "ent_target", to: partner.id,
          type: "partnered_with",
          confidence: finding.confidence,
          status: "inferred",
          detail: `Partner: ${partnerName}`,
          source, sourceLabel, tier,
          evidence: text.slice(0, 150),
        });
      }
    }
  }
}

// =====================
// Graph Builder
// =====================

function buildHierarchyGraph(entities: OrgEntity[], relationships: OrgRelationship[]): HierarchyGraph {
  const nodes: HierarchyNode[] = entities.map((e) => ({
    id: e.id,
    label: e.name,
    type: e.type,
    weight: relationships.filter((r) => r.from === e.id || r.to === e.id).length,
    meta: { role: e.role, jurisdiction: e.jurisdiction, legalSuffix: e.legalSuffix },
  }));

  const edges: HierarchyEdge[] = relationships.map((r) => ({
    from: r.from,
    to: r.to,
    type: r.type,
    label: r.detail,
    confidence: r.confidence,
    status: r.status,
  }));

  return { nodes, edges };
}

// =====================
// Summaries & Assessment
// =====================

function buildSummaries(relationships: OrgRelationship[]): CategorySummary[] {
  const groups = new Map<RelationshipType, OrgRelationship[]>();
  for (const r of relationships) {
    if (!groups.has(r.type)) groups.set(r.type, []);
    groups.get(r.type)!.push(r);
  }

  return [...groups.entries()].map(([type, rels]) => ({
    type,
    label: RELATIONSHIP_LABELS[type] || type,
    count: rels.length,
    entities: rels.map((r) => {
      const fromEntity = r.from;
      const toEntity = r.to;
      return fromEntity === "ent_target" ? toEntity : fromEntity;
    }),
  }));
}

function buildKeyFindings(entities: OrgEntity[], relationships: OrgRelationship[], summaries: CategorySummary[]): string[] {
  const findings: string[] = [];

  const parents = summaries.find((s) => s.type === "parent_of");
  if (parents) findings.push(`Parent organization identified: ${parents.entities.join(", ")}`);

  const subsidiaries = summaries.find((s) => s.type === "subsidiary_of");
  if (subsidiaries) findings.push(`${subsidiaries.count} subsidiaries discovered: ${subsidiaries.entities.slice(0, 3).join(", ")}`);

  const founders = summaries.find((s) => s.type === "founded_by");
  if (founders) findings.push(`Founders: ${founders.entities.join(", ")}`);

  const execs = summaries.find((s) => s.type === "executive_of");
  if (execs) findings.push(`${execs.count} executives identified: ${execs.entities.slice(0, 3).join(", ")}`);

  const investors = summaries.find((s) => s.type === "invested_in");
  if (investors) findings.push(`Investors: ${investors.entities.join(", ")}`);

  const brands = summaries.find((s) => s.type === "operates_brand");
  if (brands) findings.push(`Brands: ${brands.entities.join(", ")}`);

  const acquisitions = summaries.find((s) => s.type === "acquired");
  if (acquisitions) findings.push(`Acquisitions: ${acquisitions.entities.join(", ")}`);

  const partners = summaries.find((s) => s.type === "partnered_with");
  if (partners) findings.push(`Partners: ${partners.entities.join(", ")}`);

  if (findings.length === 0) {
    findings.push("No organizational hierarchy relationships discovered from available evidence.");
  }

  return findings;
}

function buildAssessmentExplanation(
  totalEntities: number, totalRelationships: number,
  entityTypes: Record<EntityType, number>,
  relationshipTypes: Record<RelationshipType, number>,
  confirmed: number, inferred: number,
  complexity: string, summaries: CategorySummary[]
): string {
  if (totalRelationships === 0) {
    return "No organizational hierarchy relationships discovered. The target may not have publicly documented parent/subsidiary/founder/executive/investor/partner relationships in collected evidence.";
  }

  const parts: string[] = [];
  parts.push(`${totalEntities} entities and ${totalRelationships} relationships discovered`);
  parts.push(`${confirmed} confirmed, ${inferred} inferred`);
  parts.push(`Hierarchy complexity: ${complexity.toUpperCase()}`);

  const catSummary = summaries.map((s) => `${s.label}: ${s.count}`).join(", ");
  if (catSummary) parts.push(`Categories: ${catSummary}`);

  if (complexity === "complex") {
    parts.push("Complex organizational structure with multiple relationship types");
  } else if (complexity === "moderate") {
    parts.push("Moderate organizational structure — some relationships identified");
  } else {
    parts.push("Minimal organizational structure — few relationships discovered");
  }

  return parts.join(". ") + ".";
}
