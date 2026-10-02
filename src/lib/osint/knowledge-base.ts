// Knowledge Base — durable intelligence repository (Feature 19)
//
// The KB is the long-lived memory layer of the platform. It persists everything
// learned during investigations: entities, relationships, evidence, observations,
// and conclusions — with provenance, history, and conflict preservation.
//
// Core capabilities:
//   1. Persistent storage of intelligence (survives restarts, grows over time)
//   2. Reusable entity accumulation (recognize the same subject across runs)
//   3. Relationship preservation (structured graph of connections)
//   4. Historical continuity (prior states retained, not overwritten)
//   5. Retrieval and reuse (search by entity/relationship/source/time)
//   6. Deduplication and normalization (one canonical record per real subject)
//   7. Evidence-backed persistence (every claim traceable to source)
//   8. Long-term intelligence growth (richer with each investigation)
//
// Ingestion workflow:
//   receive → normalize → check existing → create/update → preserve history
//   → link to prior intelligence → available for future retrieval
//
// Conflicts are PRESERVED, never destroyed. Both sides stay in the repository
// until an analyst manually resolves (or the system finds stronger evidence).

import { db } from "@/lib/db";
import type { SourceResult, NormalizedFinding, InvestigationRecord, ReportData } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";
import { safeJsonParse, safeJsonStringArray } from "./safe-json";

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export type KBEntityType =
  | "person"
  | "organization"
  | "domain"
  | "ip"
  | "email"
  | "username"
  | "wallet"
  | "phone"
  | "url"
  | "hash"
  | "cve"
  | "document";

export type KBRelationType =
  | "resolves_to"        // domain → ip
  | "owned_by"           // domain → organization
  | "affiliated_with"    // person ↔ organization
  | "employed_by"        // person → organization
  | "located_in"         // entity → location
  | "links_to"           // any → url
  | "mentions"           // source → entity
  | "registered_to"      // domain → person/org
  | "parent_of"          // org → org
  | "subsidiary_of"      // org → org
  | "alias_of"           // entity → entity (deduped)
  | "related_to"         // generic
  | "communicates_with"  // email/wallet ↔ email/wallet
  | "hosts"              // ip → domain
  | "issued"             // entity → document/cert
  | "observed_at";       // entity → url

export interface KnowledgeEntity {
  id: string;
  type: KBEntityType;
  primaryName: string;
  normalizedName: string;
  aliases: string[];
  attributes: Record<string, string>;
  confidence: number;
  tier: ReliabilityTier;
  status: "active" | "merged" | "deprecated";
  mergedIntoId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  observationCount: number;
  investigationCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  fromName: string;
  toName: string;
  relationType: KBRelationType;
  label: string;
  confidence: number;
  tier: ReliabilityTier;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  observationCount: number;
  investigationCount: number;
}

export interface EvidenceArtifact {
  id: string;
  entityId?: string;
  relationshipId?: string;
  investigationId: string;
  investigationKind: string;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: ReliabilityTier;
  rawText: string;
  normalizedText: string;
  confidence: number;
  observedAt: string;
  createdAt: string;
}

export interface VersionRecord {
  id: string;
  recordType: "entity" | "relationship";
  recordId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  validFrom: string;
  validTo?: string;
  changeType: "create" | "update" | "merge" | "split" | "deprecate";
  changeReason: string;
  investigationId: string;
  createdAt: string;
}

export interface KnowledgeConflict {
  id: string;
  entityId: string;
  entityName: string;
  field: string;
  valueA: string;
  valueB: string;
  evidenceAId: string;
  evidenceBId: string;
  sourceKeyA: string;
  sourceKeyB: string;
  status: "open" | "resolved_a" | "resolved_b" | "unresolved";
  resolution: string;
  detectedAt: string;
  resolvedAt?: string;
}

export interface InvestigationLink {
  id: string;
  investigationId: string;
  investigationKind: string;
  entityId?: string;
  relationshipId?: string;
  contributionType: "observed" | "confirmed" | "contradicted" | "updated";
  target: string;
  timestamp: string;
}

// ============================================================================
// AGGREGATE REPORTS
// ============================================================================

export interface KnowledgeBaseStats {
  totalEntities: number;
  totalRelationships: number;
  totalEvidence: number;
  totalConflicts: number;
  openConflicts: number;
  totalInvestigationsIngested: number;
  entitiesByType: Record<string, number>;
  relationshipsByType: Record<string, number>;
  avgConfidence: number;
  topSources: { sourceKey: string; sourceLabel: string; count: number }[];
  recentActivity: { timestamp: string; kind: string; description: string }[];
  generatedAt: string;
}

export interface KnowledgeBaseSearchResult {
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
  evidence: EvidenceArtifact[];
  totalMatches: number;
  query: string;
}

export interface KnowledgeBaseEntityDetail {
  entity: KnowledgeEntity;
  evidence: EvidenceArtifact[];
  relationships: KnowledgeRelationship[];
  conflicts: KnowledgeConflict[];
  versions: VersionRecord[];
  investigations: { investigationId: string; investigationKind: string; contributionType: string; timestamp: string }[];
}

export interface IngestResult {
  investigationId: string;
  investigationKind: string;
  target: string;
  ingestedAt: string;
  entitiesCreated: number;
  entitiesUpdated: number;
  relationshipsCreated: number;
  relationshipsUpdated: number;
  evidenceCreated: number;
  conflictsDetected: number;
  duplicatesResolved: number;
  totalObservations: number;
  alreadyIngested: boolean;
  message: string;
}

export interface KnowledgeBaseReport {
  stats: KnowledgeBaseStats;
  recentEntities: KnowledgeEntity[];
  recentRelationships: KnowledgeRelationship[];
  recentInvestigations: { investigationId: string; investigationKind: string; target: string; timestamp: string; entityCount: number }[];
  topEntities: KnowledgeEntity[];
  generatedAt: string;
}

// ============================================================================
// INGESTION — Convert investigation output into KB records
// ============================================================================

const INGESTED_FLAG = "kb_ingested";

/**
 * Ingest a standard investigation into the Knowledge Base.
 * Returns a summary of what was created/updated. Idempotent — re-ingesting
 * the same investigation is a no-op (returns alreadyIngested=true).
 */
export async function ingestInvestigation(
  investigationId: string,
  kind: "standard" | "agent" | "discovery" | "plan" | "monitor" = "standard"
): Promise<IngestResult> {
  const now = new Date().toISOString();

  // Idempotency check — if we've already ingested this investigation, return early
  const existingLinks = await db.kBInvestigationLink.findMany({
    where: { investigationId },
    take: 1,
  });
  if (existingLinks.length > 0) {
    return {
      investigationId,
      investigationKind: kind,
      target: "",
      ingestedAt: now,
      entitiesCreated: 0,
      entitiesUpdated: 0,
      relationshipsCreated: 0,
      relationshipsUpdated: 0,
      evidenceCreated: 0,
      conflictsDetected: 0,
      duplicatesResolved: 0,
      totalObservations: 0,
      alreadyIngested: true,
      message: `Investigation ${investigationId} was already ingested into the Knowledge Base.`,
    };
  }

  // Fetch the investigation record from the store
  const rec = await fetchInvestigationRecord(investigationId, kind);
  if (!rec) {
    return {
      investigationId,
      investigationKind: kind,
      target: "",
      ingestedAt: now,
      entitiesCreated: 0,
      entitiesUpdated: 0,
      relationshipsCreated: 0,
      relationshipsUpdated: 0,
      evidenceCreated: 0,
      conflictsDetected: 0,
      duplicatesResolved: 0,
      totalObservations: 0,
      alreadyIngested: false,
      message: `Investigation ${investigationId} not found.`,
    };
  }

  // 1. Extract entities from source results
  const extractedEntities = extractEntitiesFromSources(rec.source_results, rec.target);
  // 2. Extract relationships
  const extractedRelationships = extractRelationshipsFromSources(rec.source_results, rec.target, rec.input_type);
  // 3. Process each entity: dedup against existing KB, create or update
  let entitiesCreated = 0;
  let entitiesUpdated = 0;
  let duplicatesResolved = 0;
  let conflictsDetected = 0;
  let evidenceCreated = 0;

  // Cache: extracted entity key -> KB entity id (for relationship wiring)
  const entityIdMap = new Map<string, string>();

  for (const ext of extractedEntities) {
    const result = await upsertEntity(ext, investigationId, kind);
    if (result.created) entitiesCreated++;
    else entitiesUpdated++;
    if (result.duplicateResolved) duplicatesResolved++;
    if (result.conflictDetected) conflictsDetected++;
    evidenceCreated += result.evidenceCreated;
    entityIdMap.set(ext.cacheKey, result.entityId);
  }

  // 4. Process relationships
  let relationshipsCreated = 0;
  let relationshipsUpdated = 0;

  for (const extRel of extractedRelationships) {
    const fromId = entityIdMap.get(extRel.fromCacheKey);
    const toId = entityIdMap.get(extRel.toCacheKey);
    if (!fromId || !toId) continue;
    const result = await upsertRelationship(extRel, fromId, toId, investigationId, kind);
    if (result.created) relationshipsCreated++;
    else relationshipsUpdated++;
    evidenceCreated += result.evidenceCreated;
  }

  // 5. Also persist investigation-level evidence (key findings as evidence)
  if (rec.report) {
    for (const finding of rec.report.key_findings.slice(0, 30)) {
      await db.kBEvidence.create({
        data: {
          id: `ev_${cryptoRandom()}`,
          entityId: null,
          relationshipId: null,
          investigationId,
          investigationKind: kind,
          sourceKey: finding.source,
          sourceLabel: finding.source,
          sourceUrl: finding.source_url,
          tier: getReliabilityTier(finding.source),
          rawText: finding.claim.slice(0, 1000),
          normalizedText: normalizeText(finding.claim).slice(0, 500),
          confidence: finding.confidence,
          observedAt: new Date(now),
          createdAt: new Date(now),
        },
      });
      evidenceCreated++;
    }
  }

  const totalObservations = entitiesCreated + entitiesUpdated + relationshipsCreated + relationshipsUpdated + evidenceCreated;

  return {
    investigationId,
    investigationKind: kind,
    target: rec.target,
    ingestedAt: now,
    entitiesCreated,
    entitiesUpdated,
    relationshipsCreated,
    relationshipsUpdated,
    evidenceCreated,
    conflictsDetected,
    duplicatesResolved,
    totalObservations,
    alreadyIngested: false,
    message: `Ingested ${entitiesCreated} new + ${entitiesUpdated} existing entities, ${relationshipsCreated} new + ${relationshipsUpdated} existing relationships, ${evidenceCreated} evidence artifacts.`,
  };
}

// ============================================================================
// Internal: Fetch investigation record from any store
// ============================================================================

async function fetchInvestigationRecord(
  investigationId: string,
  kind: "standard" | "agent" | "discovery" | "plan" | "monitor"
): Promise<{ target: string; input_type: string; source_results: SourceResult[]; report: ReportData | null } | null> {
  if (kind === "standard") {
    const { getRecord } = await import("./store");
    const rec = await getRecord(investigationId);
    if (!rec) return null;
    return {
      target: rec.target,
      input_type: rec.input_type,
      source_results: rec.source_results,
      report: rec.report,
    };
  }
  if (kind === "agent") {
    const row = await db.autonomousInvestigation.findUnique({ where: { id: investigationId } });
    if (!row) return null;
    const state = safeJsonParse<Record<string, unknown>>(row.stateJson || "{}", {});
    const sr: SourceResult[] = Array.isArray(state.evidence) ? state.evidence as SourceResult[] : [];
    const report: ReportData | null = row.reportJson ? safeJsonParse<ReportData | null>(row.reportJson, null) : null;
    return { target: row.target, input_type: row.inputType, source_results: sr, report };
  }
  if (kind === "discovery") {
    const row = await db.discoverySession.findUnique({ where: { id: investigationId } });
    if (!row) return null;
    return { target: row.rootTarget, input_type: row.rootType, source_results: [], report: null };
  }
  if (kind === "plan") {
    const row = await db.planSession.findUnique({ where: { id: investigationId } });
    if (!row) return null;
    return { target: row.target, input_type: row.inputType, source_results: [], report: row.reportJson ? safeJsonParse<ReportData | null>(row.reportJson, null) : null };
  }
  if (kind === "monitor") {
    const row = await db.monitorSession.findUnique({ where: { id: investigationId } });
    if (!row) return null;
    return { target: row.target, input_type: row.inputType, source_results: [], report: null };
  }
  return null;
}

// ============================================================================
// Entity Extraction (from source results)
// ============================================================================

interface ExtractedEntity {
  cacheKey: string;
  type: KBEntityType;
  primaryName: string;
  normalizedName: string;
  rawValue: string;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: ReliabilityTier;
  confidence: number;
  rawText: string;
  observedAt: string;
  attributes: Record<string, string>;
}

function extractEntitiesFromSources(sourceResults: SourceResult[], target: string): ExtractedEntity[] {
  const extracted: ExtractedEntity[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();

  // Always include the target as the first entity
  const targetType = detectEntityType(target);
  extracted.push({
    cacheKey: `target:${target.toLowerCase()}`,
    type: targetType,
    primaryName: target,
    normalizedName: normalizeEntityName(target, targetType),
    rawValue: target,
    sourceKey: "user",
    sourceLabel: "User input",
    sourceUrl: "",
    tier: 5,
    confidence: 1.0,
    rawText: `Original target: ${target}`,
    observedAt: now,
    attributes: {},
  });
  seen.add(`target:${target.toLowerCase()}`);

  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      const text = f.data;

      // Extract domains
      for (const m of text.matchAll(/\b([\w-]+\.){1,}[\w]{2,}\b/gi)) {
        const val = m[0];
        const norm = val.toLowerCase();
        const key = `domain:${norm}`;
        if (seen.has(key) || norm.length < 4) continue;
        seen.add(key);
        extracted.push({
          cacheKey: key,
          type: "domain",
          primaryName: val,
          normalizedName: norm,
          rawValue: val,
          sourceKey: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          tier,
          confidence: f.confidence,
          rawText: text.slice(0, 500),
          observedAt: f.timestamp,
          attributes: extractAttributes(text),
        });
      }

      // Extract IPs
      for (const m of text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g)) {
        const val = m[1];
        if (isPrivateIP(val)) continue;
        const key = `ip:${val}`;
        if (seen.has(key)) continue;
        seen.add(key);
        extracted.push({
          cacheKey: key,
          type: "ip",
          primaryName: val,
          normalizedName: normalizeEntityName(val, "ip"),
          rawValue: val,
          sourceKey: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          tier,
          confidence: f.confidence,
          rawText: text.slice(0, 500),
          observedAt: f.timestamp,
          attributes: extractAttributes(text),
        });
      }

      // Extract emails
      for (const m of text.matchAll(/[\w.-]+@[\w.-]+\.\w+/g)) {
        const val = m[0];
        const norm = val.toLowerCase();
        const key = `email:${norm}`;
        if (seen.has(key)) continue;
        seen.add(key);
        extracted.push({
          cacheKey: key,
          type: "email",
          primaryName: val,
          normalizedName: norm,
          rawValue: val,
          sourceKey: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          tier,
          confidence: f.confidence,
          rawText: text.slice(0, 500),
          observedAt: f.timestamp,
          attributes: extractAttributes(text),
        });
      }

      // Extract wallets
      for (const m of text.matchAll(/\b(0x[a-fA-F0-9]{40}|bc1[a-zA-HJ-NP-Z0-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g)) {
        const val = m[1];
        const norm = val.toLowerCase();
        const key = `wallet:${norm}`;
        if (seen.has(key)) continue;
        seen.add(key);
        extracted.push({
          cacheKey: key,
          type: "wallet",
          primaryName: val,
          normalizedName: norm,
          rawValue: val,
          sourceKey: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          tier,
          confidence: f.confidence,
          rawText: text.slice(0, 500),
          observedAt: f.timestamp,
          attributes: extractAttributes(text),
        });
      }

      // Extract CVE IDs
      for (const m of text.matchAll(/\b(CVE-\d{4}-\d{4,7})\b/gi)) {
        const val = m[1].toUpperCase();
        const key = `cve:${val}`;
        if (seen.has(key)) continue;
        seen.add(key);
        extracted.push({
          cacheKey: key,
          type: "cve",
          primaryName: val,
          normalizedName: val,
          rawValue: val,
          sourceKey: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          tier,
          confidence: f.confidence,
          rawText: text.slice(0, 500),
          observedAt: f.timestamp,
          attributes: extractAttributes(text),
        });
      }

      // Extract phone numbers
      for (const m of text.matchAll(/\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g)) {
        const val = m[0].trim();
        if (val.length < 8 || val.length > 20) continue;
        const norm = val.replace(/[^\d+]/g, "");
        const key = `phone:${norm}`;
        if (seen.has(key)) continue;
        seen.add(key);
        extracted.push({
          cacheKey: key,
          type: "phone",
          primaryName: val,
          normalizedName: norm,
          rawValue: val,
          sourceKey: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          tier,
          confidence: f.confidence,
          rawText: text.slice(0, 500),
          observedAt: f.timestamp,
          attributes: extractAttributes(text),
        });
      }
    }
  }

  return extracted;
}

// ============================================================================
// Relationship Extraction
// ============================================================================

interface ExtractedRelationship {
  fromCacheKey: string;
  toCacheKey: string;
  relationType: KBRelationType;
  label: string;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: ReliabilityTier;
  confidence: number;
  observedAt: string;
  rawText: string;
}

function extractRelationshipsFromSources(
  sourceResults: SourceResult[],
  target: string,
  inputType: string
): ExtractedRelationship[] {
  const rels: ExtractedRelationship[] = [];
  const seen = new Set<string>();
  const now = new Date().toISOString();
  const targetType = detectEntityType(target);
  const targetCacheKey = `target:${target.toLowerCase()}`;

  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      const text = f.data;

      // domain → ip (resolves_to)
      const domains = [...text.matchAll(/\b([\w-]+\.){1,}[\w]{2,}\b/gi)].map((m) => m[0].toLowerCase());
      const ips = [...text.matchAll(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g)].map((m) => m[1]).filter((ip) => !isPrivateIP(ip));

      for (const domain of domains) {
        for (const ip of ips) {
          const key = `resolves_to:${domain}:${ip}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rels.push({
            fromCacheKey: `domain:${domain}`,
            toCacheKey: `ip:${ip}`,
            relationType: "resolves_to",
            label: `${domain} resolves to ${ip}`,
            sourceKey: sr.source,
            sourceLabel: sr.source_label,
            sourceUrl: f.source_url,
            tier,
            confidence: f.confidence,
            observedAt: f.timestamp,
            rawText: text.slice(0, 300),
          });
        }

        // domain → target (links_to / owned_by)
        if (targetType === "organization" && domain !== target.toLowerCase()) {
          const key = `links_to:${domain}:${target.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            rels.push({
              fromCacheKey: `domain:${domain}`,
              toCacheKey: targetCacheKey,
              relationType: "owned_by",
              label: `${domain} owned by ${target}`,
              sourceKey: sr.source,
              sourceLabel: sr.source_label,
              sourceUrl: f.source_url,
              tier,
              confidence: f.confidence,
              observedAt: f.timestamp,
              rawText: text.slice(0, 300),
            });
          }
        }
      }

      // email → domain (registered_to / affiliated_with)
      const emails = [...text.matchAll(/[\w.-]+@([\w.-]+\.\w+)/g)].map((m) => ({ email: m[0].toLowerCase(), domain: m[1].toLowerCase() }));
      for (const { email, domain } of emails) {
        const key = `affiliated_with:${email}:${domain}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rels.push({
          fromCacheKey: `email:${email}`,
          toCacheKey: `domain:${domain}`,
          relationType: "affiliated_with",
          label: `${email} affiliated with ${domain}`,
          sourceKey: sr.source,
          sourceLabel: sr.source_label,
          sourceUrl: f.source_url,
          tier,
          confidence: f.confidence,
          observedAt: f.timestamp,
          rawText: text.slice(0, 300),
        });
      }

      // For person/organization targets, link target → any observed domain/ip
      if ((targetType === "person" || targetType === "organization") && domains.length > 0) {
        for (const domain of domains.slice(0, 5)) {
          if (domain === target.toLowerCase()) continue;
          const key = `mentions:${targetCacheKey}:${domain}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rels.push({
            fromCacheKey: targetCacheKey,
            toCacheKey: `domain:${domain}`,
            relationType: "mentions",
            label: `${target} associated with ${domain}`,
            sourceKey: sr.source,
            sourceLabel: sr.source_label,
            sourceUrl: f.source_url,
            tier,
            confidence: f.confidence * 0.7,
            observedAt: f.timestamp,
            rawText: text.slice(0, 300),
          });
        }
      }

      // For ip targets, link target → domains observed
      if (targetType === "ip" && domains.length > 0) {
        for (const domain of domains.slice(0, 5)) {
          const key = `hosts:${targetCacheKey}:${domain}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rels.push({
            fromCacheKey: targetCacheKey,
            toCacheKey: `domain:${domain}`,
            relationType: "hosts",
            label: `${target} hosts ${domain}`,
            sourceKey: sr.source,
            sourceLabel: sr.source_label,
            sourceUrl: f.source_url,
            tier,
            confidence: f.confidence * 0.8,
            observedAt: f.timestamp,
            rawText: text.slice(0, 300),
          });
        }
      }

      // For domain targets, link target → observed IPs
      if (targetType === "domain" && ips.length > 0) {
        for (const ip of ips.slice(0, 5)) {
          const key = `resolves_to:${targetCacheKey}:${ip}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rels.push({
            fromCacheKey: targetCacheKey,
            toCacheKey: `ip:${ip}`,
            relationType: "resolves_to",
            label: `${target} resolves to ${ip}`,
            sourceKey: sr.source,
            sourceLabel: sr.source_label,
            sourceUrl: f.source_url,
            tier,
            confidence: f.confidence,
            observedAt: f.timestamp,
            rawText: text.slice(0, 300),
          });
        }
      }
    }
  }

  // No relationships found — this is a valid state (the target may not have
  // detectable relationships from the collected evidence).
  return rels;
}

// ============================================================================
// Upsert Entity (dedup against existing KB)
// ============================================================================

interface EntityUpsertResult {
  entityId: string;
  created: boolean;
  duplicateResolved: boolean;
  conflictDetected: boolean;
  evidenceCreated: number;
}

async function upsertEntity(
  ext: ExtractedEntity,
  investigationId: string,
  investigationKind: string
): Promise<EntityUpsertResult> {
  const now = new Date().toISOString();

  // Look for an existing entity by normalized name + type
  let existing = await db.kBEntity.findFirst({
    where: {
      normalizedName: ext.normalizedName,
      type: ext.type,
      status: { in: ["active", "merged"] },
    },
  });

  // If not found by exact normalizedName, try fuzzy match for organizations/persons
  if (!existing && (ext.type === "organization" || ext.type === "person")) {
    const candidates = await db.kBEntity.findMany({
      where: { type: ext.type, status: "active" },
      take: 200,
    });
    for (const c of candidates) {
      const sim = stringSimilarity(c.normalizedName, ext.normalizedName);
      if (sim >= 0.92) {
        existing = c;
        break;
      }
    }
  }

  let entityId: string;
  let created = false;
  let duplicateResolved = false;
  let conflictDetected = false;
  let evidenceCreated = 0;
  const now2 = new Date(now);

  if (existing) {
    // Update: accumulate aliases, observations, investigation count, confidence
    const aliases = safeJsonStringArray(existing.aliasesJson);
    if (ext.rawValue !== existing.primaryName && !aliases.includes(ext.rawValue)) {
      aliases.push(ext.rawValue);
    }
    const attrs = safeJsonParse(existing.attributesJson || "{}", {} as Record<string, string>);
    // Check for conflicts: if attribute values differ, record a conflict
    for (const [k, v] of Object.entries(ext.attributes)) {
      if (attrs[k] && attrs[k] !== v) {
        // Conflict detected — preserve both
        conflictDetected = true;
        await db.kBConflict.create({
          data: {
            id: `conf_${cryptoRandom()}`,
            entityId: existing.id,
            field: k,
            valueA: attrs[k],
            valueB: v,
            evidenceAId: "",
            evidenceBId: "",
            sourceKeyA: existing.tier >= 3 ? "prior" : "prior",
            sourceKeyB: ext.sourceKey,
            status: "open",
            resolution: "",
            detectedAt: now2,
            createdAt: now2,
          },
        });
      } else if (!attrs[k]) {
        attrs[k] = v;
      }
    }

    // Bump version + create version snapshot
    const newVersion = existing.version + 1;
    await db.kBVersion.create({
      data: {
        id: `ver_${cryptoRandom()}`,
        entityType: "entity",
        recordId: existing.id,
        versionNumber: existing.version,
        snapshotJson: JSON.stringify({
          primaryName: existing.primaryName,
          normalizedName: existing.normalizedName,
          aliases,
          attributes: attrs,
          confidence: existing.confidence,
          tier: existing.tier,
        }),
        validFrom: existing.updatedAt,
        validTo: now2,
        changeType: "update",
        changeReason: `New observation from ${investigationKind} investigation ${investigationId}`,
        investigationId,
        createdAt: now2,
      },
    });

    const newConfidence = Math.min(1.0, (existing.confidence * existing.observationCount + ext.confidence) / (existing.observationCount + 1));
    const newTier = Math.max(existing.tier, ext.tier) as ReliabilityTier;

    await db.kBEntity.update({
      where: { id: existing.id },
      data: {
        aliasesJson: JSON.stringify(aliases),
        attributesJson: JSON.stringify(attrs),
        confidence: newConfidence,
        tier: newTier,
        observationCount: existing.observationCount + 1,
        investigationCount: existing.investigationCount + 1,
        version: newVersion,
        lastSeenAt: now2,
        updatedAt: now2,
      },
    });
    entityId = existing.id;
    duplicateResolved = true;
  } else {
    // Create new entity
    entityId = `kb_${cryptoRandom()}`;
    created = true;
    await db.kBEntity.create({
      data: {
        id: entityId,
        type: ext.type,
        primaryName: ext.primaryName,
        normalizedName: ext.normalizedName,
        aliasesJson: JSON.stringify(ext.rawValue !== ext.primaryName ? [ext.rawValue] : []),
        attributesJson: JSON.stringify(ext.attributes),
        confidence: ext.confidence,
        tier: ext.tier,
        status: "active",
        firstSeenAt: now2,
        lastSeenAt: now2,
        observationCount: 1,
        investigationCount: 1,
        version: 1,
        createdAt: now2,
        updatedAt: now2,
      },
    });

    // Initial version snapshot
    await db.kBVersion.create({
      data: {
        id: `ver_${cryptoRandom()}`,
        entityType: "entity",
        recordId: entityId,
        versionNumber: 1,
        snapshotJson: JSON.stringify({
          primaryName: ext.primaryName,
          normalizedName: ext.normalizedName,
          aliases: [],
          attributes: ext.attributes,
          confidence: ext.confidence,
          tier: ext.tier,
        }),
        validFrom: now2,
        validTo: null,
        changeType: "create",
        changeReason: `Initial observation from ${investigationKind} investigation ${investigationId}`,
        investigationId,
        createdAt: now2,
      },
    });
  }

  // Persist evidence
  await db.kBEvidence.create({
    data: {
      id: `ev_${cryptoRandom()}`,
      entityId,
      relationshipId: null,
      investigationId,
      investigationKind,
      sourceKey: ext.sourceKey,
      sourceLabel: ext.sourceLabel,
      sourceUrl: ext.sourceUrl,
      tier: ext.tier,
      rawText: ext.rawText,
      normalizedText: normalizeText(ext.rawText).slice(0, 500),
      confidence: ext.confidence,
      observedAt: new Date(ext.observedAt),
      createdAt: now2,
    },
  });
  evidenceCreated++;

  // Persist investigation link
  await db.kBInvestigationLink.create({
    data: {
      id: `link_${cryptoRandom()}`,
      investigationId,
      investigationKind,
      entityId,
      relationshipId: null,
      contributionType: created ? "observed" : "confirmed",
      target: ext.primaryName,
      timestamp: now2,
      createdAt: now2,
    },
  });

  return { entityId, created, duplicateResolved, conflictDetected, evidenceCreated };
}

// ============================================================================
// Upsert Relationship
// ============================================================================

interface RelationshipUpsertResult {
  relationshipId: string;
  created: boolean;
  evidenceCreated: number;
}

async function upsertRelationship(
  ext: ExtractedRelationship,
  fromEntityId: string,
  toEntityId: string,
  investigationId: string,
  investigationKind: string
): Promise<RelationshipUpsertResult> {
  const now = new Date().toISOString();
  const now2 = new Date(now);

  // Look for an existing relationship with same from/to/type
  let existing = await db.kBRelationship.findFirst({
    where: {
      fromEntityId,
      toEntityId,
      relationType: ext.relationType,
    },
  });

  // Also check the reverse direction for symmetric relationships
  if (!existing && SYMMETRIC_RELATIONS.has(ext.relationType)) {
    existing = await db.kBRelationship.findFirst({
      where: {
        fromEntityId: toEntityId,
        toEntityId: fromEntityId,
        relationType: ext.relationType,
      },
    });
  }

  let relationshipId: string;
  let created = false;
  let evidenceCreated = 0;

  if (existing) {
    const newConfidence = Math.min(1.0, (existing.confidence * existing.observationCount + ext.confidence) / (existing.observationCount + 1));
    const newTier = Math.max(existing.tier, ext.tier) as ReliabilityTier;
    await db.kBRelationship.update({
      where: { id: existing.id },
      data: {
        confidence: newConfidence,
        tier: newTier,
        observationCount: existing.observationCount + 1,
        investigationCount: existing.investigationCount + 1,
        lastSeenAt: now2,
        updatedAt: now2,
      },
    });
    relationshipId = existing.id;
  } else {
    relationshipId = `rel_${cryptoRandom()}`;
    created = true;
    await db.kBRelationship.create({
      data: {
        id: relationshipId,
        fromEntityId,
        toEntityId,
        relationType: ext.relationType,
        label: ext.label,
        confidence: ext.confidence,
        tier: ext.tier,
        sourceKey: ext.sourceKey,
        sourceLabel: ext.sourceLabel,
        sourceUrl: ext.sourceUrl,
        firstSeenAt: now2,
        lastSeenAt: now2,
        observationCount: 1,
        investigationCount: 1,
        createdAt: now2,
        updatedAt: now2,
      },
    });
  }

  // Persist evidence for the relationship
  await db.kBEvidence.create({
    data: {
      id: `ev_${cryptoRandom()}`,
      entityId: null,
      relationshipId,
      investigationId,
      investigationKind,
      sourceKey: ext.sourceKey,
      sourceLabel: ext.sourceLabel,
      sourceUrl: ext.sourceUrl,
      tier: ext.tier,
      rawText: ext.rawText,
      normalizedText: normalizeText(ext.rawText).slice(0, 500),
      confidence: ext.confidence,
      observedAt: new Date(ext.observedAt),
      createdAt: now2,
    },
  });
  evidenceCreated++;

  // Investigation link for relationship
  await db.kBInvestigationLink.create({
    data: {
      id: `link_${cryptoRandom()}`,
      investigationId,
      investigationKind,
      entityId: null,
      relationshipId,
      contributionType: created ? "observed" : "confirmed",
      target: ext.label,
      timestamp: now2,
      createdAt: now2,
    },
  });

  return { relationshipId, created, evidenceCreated };
}

const SYMMETRIC_RELATIONS = new Set<KBRelationType>([
  "affiliated_with",
  "related_to",
  "communicates_with",
  "mentions",
]);

// ============================================================================
// RETRIEVAL — search, stats, entity detail
// ============================================================================

export async function getKnowledgeBaseStats(): Promise<KnowledgeBaseStats> {
  // All queries are independent — run them all in a single parallel batch
  // to minimize DB round-trips (was: 6 parallel + 5 sequential = 2+ round-trips).
  const [
    entities, rels, evidence, conflicts, openConflicts, links,
    entitiesByTypeRaw, relsByTypeRaw, entityAgg, evidenceBySource, recentLinks,
  ] = await Promise.all([
    db.kBEntity.count({ where: { status: "active" } }),
    db.kBRelationship.count(),
    db.kBEvidence.count(),
    db.kBConflict.count(),
    db.kBConflict.count({ where: { status: "open" } }),
    db.kBInvestigationLink.findMany({
      distinct: ["investigationId"],
      select: { investigationId: true, investigationKind: true, target: true, timestamp: true },
      orderBy: { timestamp: "desc" },
      take: 100,
    }),
    // Entities by type
    db.kBEntity.groupBy({ by: ["type"], where: { status: "active" }, _count: true }),
    // Relationships by type
    db.kBRelationship.groupBy({ by: ["relationType"], _count: true }),
    // Avg confidence
    db.kBEntity.aggregate({ where: { status: "active" }, _avg: { confidence: true } }),
    // Top sources
    db.kBEvidence.groupBy({
      by: ["sourceKey", "sourceLabel"],
      _count: true,
      orderBy: { _count: { sourceKey: "desc" } },
      take: 8,
    }),
    // Recent activity
    db.kBInvestigationLink.findMany({ orderBy: { timestamp: "desc" }, take: 10 }),
  ]);

  const entitiesByType: Record<string, number> = {};
  for (const r of entitiesByTypeRaw) entitiesByType[r.type] = r._count;

  const relationshipsByType: Record<string, number> = {};
  for (const r of relsByTypeRaw) relationshipsByType[r.relationType] = r._count;

  const topSources = evidenceBySource.map((s) => ({
    sourceKey: s.sourceKey,
    sourceLabel: s.sourceLabel || s.sourceKey,
    count: s._count,
  }));

  const recentActivity = recentLinks.map((l) => ({
    timestamp: l.timestamp instanceof Date ? l.timestamp.toISOString() : String(l.timestamp),
    kind: l.investigationKind,
    description: `${l.contributionType} ${l.target || "record"}`,
  }));

  return {
    totalEntities: entities,
    totalRelationships: rels,
    totalEvidence: evidence,
    totalConflicts: conflicts,
    openConflicts,
    totalInvestigationsIngested: links.length,
    entitiesByType,
    relationshipsByType,
    avgConfidence: entityAgg._avg.confidence ?? 0,
    topSources,
    recentActivity,
    generatedAt: new Date().toISOString(),
  };
}

export async function searchKnowledgeBase(query: string, limit = 30): Promise<KnowledgeBaseSearchResult> {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { entities: [], relationships: [], evidence: [], totalMatches: 0, query };
  }

  // Search entities by name (case-insensitive LIKE)
  const entities = await db.kBEntity.findMany({
    where: {
      OR: [
        { primaryName: { contains: q } },
        { normalizedName: { contains: q } },
        { aliasesJson: { contains: q } },
      ],
      status: "active",
    },
    take: limit,
    orderBy: { lastSeenAt: "desc" },
  });

  // Search relationships by label
  const rels = await db.kBRelationship.findMany({
    where: { label: { contains: q } },
    take: limit,
    orderBy: { lastSeenAt: "desc" },
  });

  // Resolve names for relationships
  const entityIds = new Set<string>();
  for (const r of rels) {
    entityIds.add(r.fromEntityId);
    entityIds.add(r.toEntityId);
  }
  const relEntities = entityIds.size > 0
    ? await db.kBEntity.findMany({ where: { id: { in: [...entityIds] } } })
    : [];
  const entityMap = new Map(relEntities.map((e) => [e.id, e]));

  // Search evidence by raw text
  const evidence = await db.kBEvidence.findMany({
    where: {
      OR: [
        { rawText: { contains: q } },
        { normalizedText: { contains: q } },
        { sourceLabel: { contains: q } },
      ],
    },
    take: limit,
    orderBy: { observedAt: "desc" },
  });

  const mappedEntities: KnowledgeEntity[] = entities.map(mapEntity);
  const mappedRels: KnowledgeRelationship[] = rels.map((r) => mapRelationship(r, entityMap.get(r.fromEntityId)?.primaryName || "", entityMap.get(r.toEntityId)?.primaryName || ""));
  const mappedEvidence: EvidenceArtifact[] = evidence.map(mapEvidence);

  return {
    entities: mappedEntities,
    relationships: mappedRels,
    evidence: mappedEvidence,
    totalMatches: mappedEntities.length + mappedRels.length + mappedEvidence.length,
    query,
  };
}

export async function getEntityDetail(entityId: string): Promise<KnowledgeBaseEntityDetail | null> {
  const entity = await db.kBEntity.findUnique({ where: { id: entityId } });
  if (!entity) return null;

  const [evidence, relsFrom, relsTo, conflicts, versions, links] = await Promise.all([
    db.kBEvidence.findMany({ where: { entityId }, orderBy: { observedAt: "desc" }, take: 100 }),
    db.kBRelationship.findMany({ where: { fromEntityId: entityId }, orderBy: { lastSeenAt: "desc" }, take: 50 }),
    db.kBRelationship.findMany({ where: { toEntityId: entityId }, orderBy: { lastSeenAt: "desc" }, take: 50 }),
    db.kBConflict.findMany({ where: { entityId }, orderBy: { detectedAt: "desc" }, take: 50 }),
    db.kBVersion.findMany({ where: { recordId: entityId, entityType: "entity" }, orderBy: { versionNumber: "desc" }, take: 30 }),
    db.kBInvestigationLink.findMany({ where: { entityId }, orderBy: { timestamp: "desc" }, take: 20 }),
  ]);

  const allRels = [...relsFrom, ...relsTo];
  const partnerIds = new Set<string>();
  for (const r of allRels) {
    partnerIds.add(r.fromEntityId);
    partnerIds.add(r.toEntityId);
  }
  const partners = partnerIds.size > 0
    ? await db.kBEntity.findMany({ where: { id: { in: [...partnerIds] } } })
    : [];
  const partnerMap = new Map(partners.map((e) => [e.id, e]));

  const mappedRels: KnowledgeRelationship[] = allRels.map((r) =>
    mapRelationship(r, partnerMap.get(r.fromEntityId)?.primaryName || "", partnerMap.get(r.toEntityId)?.primaryName || "")
  );

  return {
    entity: mapEntity(entity),
    evidence: evidence.map(mapEvidence),
    relationships: mappedRels,
    conflicts: conflicts.map(mapConflict),
    versions: versions.map(mapVersion),
    investigations: links.map((l) => ({
      investigationId: l.investigationId,
      investigationKind: l.investigationKind,
      contributionType: l.contributionType,
      timestamp: l.timestamp instanceof Date ? l.timestamp.toISOString() : String(l.timestamp),
    })),
  };
}

export async function getKnowledgeBaseReport(): Promise<KnowledgeBaseReport> {
  const [recentEntities, recentRels, recentLinks, topEntities, stats] = await Promise.all([
    db.kBEntity.findMany({ where: { status: "active" }, orderBy: { lastSeenAt: "desc" }, take: 20 }),
    db.kBRelationship.findMany({ orderBy: { lastSeenAt: "desc" }, take: 20 }),
    db.kBInvestigationLink.findMany({
      distinct: ["investigationId"],
      orderBy: { timestamp: "desc" },
      take: 15,
      select: { investigationId: true, investigationKind: true, target: true, timestamp: true },
    }),
    db.kBEntity.findMany({
      where: { status: "active" },
      orderBy: { observationCount: "desc" },
      take: 10,
    }),
    getKnowledgeBaseStats(),
  ]);

  // Resolve partner names for recent relationships
  const eIds = new Set<string>();
  for (const r of recentRels) {
    eIds.add(r.fromEntityId);
    eIds.add(r.toEntityId);
  }
  const eRows = eIds.size > 0 ? await db.kBEntity.findMany({ where: { id: { in: [...eIds] } } }) : [];
  const eMap = new Map(eRows.map((e) => [e.id, e]));

  // Count entities per investigation
  const recentInvestigations: { investigationId: string; investigationKind: string; target: string; timestamp: string; entityCount: number }[] = [];
  for (const link of recentLinks) {
    const entityCount = await db.kBInvestigationLink.count({
      where: { investigationId: link.investigationId, entityId: { not: null } },
    });
    recentInvestigations.push({
      investigationId: link.investigationId,
      investigationKind: link.investigationKind,
      target: link.target,
      timestamp: link.timestamp instanceof Date ? link.timestamp.toISOString() : String(link.timestamp),
      entityCount,
    });
  }

  return {
    stats,
    recentEntities: recentEntities.map(mapEntity),
    recentRelationships: recentRels.map((r) =>
      mapRelationship(r, eMap.get(r.fromEntityId)?.primaryName || "", eMap.get(r.toEntityId)?.primaryName || "")
    ),
    recentInvestigations,
    topEntities: topEntities.map(mapEntity),
    generatedAt: new Date().toISOString(),
  };
}

export async function getRecentIngestedInvestigations(limit = 20): Promise<
  { investigationId: string; investigationKind: string; target: string; timestamp: string; entityCount: number; relCount: number }[]
> {
  const links = await db.kBInvestigationLink.findMany({
    distinct: ["investigationId"],
    orderBy: { timestamp: "desc" },
    take: limit,
    select: { investigationId: true, investigationKind: true, target: true, timestamp: true },
  });
  const out: { investigationId: string; investigationKind: string; target: string; timestamp: string; entityCount: number; relCount: number }[] = [];
  for (const link of links) {
    const [entityCount, relCount] = await Promise.all([
      db.kBInvestigationLink.count({ where: { investigationId: link.investigationId, entityId: { not: null } } }),
      db.kBInvestigationLink.count({ where: { investigationId: link.investigationId, relationshipId: { not: null } } }),
    ]);
    out.push({
      investigationId: link.investigationId,
      investigationKind: link.investigationKind,
      target: link.target,
      timestamp: link.timestamp instanceof Date ? link.timestamp.toISOString() : String(link.timestamp),
      entityCount,
      relCount,
    });
  }
  return out;
}

// ============================================================================
// Conflict Detection — find new conflicts in stored evidence
// ============================================================================

export async function detectConflictsForEntity(entityId: string): Promise<KnowledgeConflict[]> {
  const entity = await db.kBEntity.findUnique({ where: { id: entityId } });
  if (!entity) return [];

  const attrs = safeJsonParse(entity.attributesJson || "{}", {} as Record<string, string>);
  const evidence = await db.kBEvidence.findMany({ where: { entityId }, orderBy: { observedAt: "desc" } });
  const newConflicts: KnowledgeConflict[] = [];

  // For each attribute, check if evidence disagrees
  for (const [field, currentValue] of Object.entries(attrs)) {
    const conflictingEvidence = evidence.filter((ev) => {
      const m = ev.rawText.match(new RegExp(`${field}\\s*:?\\s*([^,\\.\\n]+)`, "i"));
      return m && m[1] && m[1].trim() !== currentValue;
    });
    for (const ev of conflictingEvidence.slice(0, 3)) {
      const m = ev.rawText.match(new RegExp(`${field}\\s*:?\\s*([^,\\.\\n]+)`, "i"));
      if (!m) continue;
      const otherValue = m[1].trim();
      // Check if conflict already exists
      const existing = await db.kBConflict.findFirst({
        where: { entityId, field, valueA: currentValue, valueB: otherValue },
      });
      if (existing) continue;
      const now2 = new Date();
      await db.kBConflict.create({
        data: {
          id: `conf_${cryptoRandom()}`,
          entityId,
          field,
          valueA: currentValue,
          valueB: otherValue,
          evidenceAId: "",
          evidenceBId: ev.id,
          sourceKeyA: "stored",
          sourceKeyB: ev.sourceKey,
          status: "open",
          resolution: "",
          detectedAt: now2,
          createdAt: now2,
        },
      });
      newConflicts.push({
        id: `conf_${cryptoRandom()}`,
        entityId,
        entityName: entity.primaryName,
        field,
        valueA: currentValue,
        valueB: otherValue,
        evidenceAId: "",
        evidenceBId: ev.id,
        sourceKeyA: "stored",
        sourceKeyB: ev.sourceKey,
        status: "open",
        resolution: "",
        detectedAt: now2.toISOString(),
      });
    }
  }
  return newConflicts;
}

// ============================================================================
// Mapping helpers — Prisma rows → domain types
// ============================================================================

type EntityRow = NonNullable<Awaited<ReturnType<typeof db.kBEntity.findUnique>>>;
type RelRow = NonNullable<Awaited<ReturnType<typeof db.kBRelationship.findFirst>>>;
type EvidenceRow = NonNullable<Awaited<ReturnType<typeof db.kBEvidence.findUnique>>>;
type ConflictRow = NonNullable<Awaited<ReturnType<typeof db.kBConflict.findUnique>>>;
type VersionRow = NonNullable<Awaited<ReturnType<typeof db.kBVersion.findUnique>>>;

function mapEntity(r: EntityRow): KnowledgeEntity {
  return {
    id: r.id,
    type: r.type as KBEntityType,
    primaryName: r.primaryName,
    normalizedName: r.normalizedName,
    aliases: safeJsonStringArray(r.aliasesJson),
    attributes: safeJsonParse(r.attributesJson || "{}", {}),
    confidence: r.confidence,
    tier: r.tier as ReliabilityTier,
    status: r.status as "active" | "merged" | "deprecated",
    mergedIntoId: r.mergedIntoId ?? undefined,
    firstSeenAt: r.firstSeenAt instanceof Date ? r.firstSeenAt.toISOString() : String(r.firstSeenAt),
    lastSeenAt: r.lastSeenAt instanceof Date ? r.lastSeenAt.toISOString() : String(r.lastSeenAt),
    observationCount: r.observationCount,
    investigationCount: r.investigationCount,
    version: r.version,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

function mapRelationship(r: RelRow, fromName: string, toName: string): KnowledgeRelationship {
  return {
    id: r.id,
    fromEntityId: r.fromEntityId,
    toEntityId: r.toEntityId,
    fromName,
    toName,
    relationType: r.relationType as KBRelationType,
    label: r.label,
    confidence: r.confidence,
    tier: r.tier as ReliabilityTier,
    sourceKey: r.sourceKey,
    sourceLabel: r.sourceLabel,
    sourceUrl: r.sourceUrl,
    firstSeenAt: r.firstSeenAt instanceof Date ? r.firstSeenAt.toISOString() : String(r.firstSeenAt),
    lastSeenAt: r.lastSeenAt instanceof Date ? r.lastSeenAt.toISOString() : String(r.lastSeenAt),
    observationCount: r.observationCount,
    investigationCount: r.investigationCount,
  };
}

function mapEvidence(r: EvidenceRow): EvidenceArtifact {
  return {
    id: r.id,
    entityId: r.entityId ?? undefined,
    relationshipId: r.relationshipId ?? undefined,
    investigationId: r.investigationId,
    investigationKind: r.investigationKind,
    sourceKey: r.sourceKey,
    sourceLabel: r.sourceLabel,
    sourceUrl: r.sourceUrl,
    tier: r.tier as ReliabilityTier,
    rawText: r.rawText,
    normalizedText: r.normalizedText,
    confidence: r.confidence,
    observedAt: r.observedAt instanceof Date ? r.observedAt.toISOString() : String(r.observedAt),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

function mapConflict(r: ConflictRow): KnowledgeConflict {
  return {
    id: r.id,
    entityId: r.entityId,
    entityName: "",
    field: r.field,
    valueA: r.valueA,
    valueB: r.valueB,
    evidenceAId: r.evidenceAId,
    evidenceBId: r.evidenceBId,
    sourceKeyA: r.sourceKeyA,
    sourceKeyB: r.sourceKeyB,
    status: r.status as "open" | "resolved_a" | "resolved_b" | "unresolved",
    resolution: r.resolution,
    detectedAt: r.detectedAt instanceof Date ? r.detectedAt.toISOString() : String(r.detectedAt),
    resolvedAt: r.resolvedAt instanceof Date ? r.resolvedAt.toISOString() : undefined,
  };
}

function mapVersion(r: VersionRow): VersionRecord {
  return {
    id: r.id,
    recordType: r.entityType as "entity" | "relationship",
    recordId: r.recordId,
    versionNumber: r.versionNumber,
    snapshot: safeJsonParse(r.snapshotJson || "{}", {}),
    validFrom: r.validFrom instanceof Date ? r.validFrom.toISOString() : String(r.validFrom),
    validTo: r.validTo instanceof Date ? r.validTo.toISOString() : undefined,
    changeType: r.changeType as "create" | "update" | "merge" | "split" | "deprecate",
    changeReason: r.changeReason,
    investigationId: r.investigationId,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  };
}

// ============================================================================
// Utility functions
// ============================================================================

function detectEntityType(value: string): KBEntityType {
  const v = value.trim();
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v)) return "ip";
  if (/^0x[a-fA-F0-9]{40}$/.test(v)) return "wallet";
  if (/^bc1[a-zA-HJ-NP-Z0-9]{25,62}$/.test(v)) return "wallet";
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(v)) return "wallet";
  if (/^CVE-\d{4}-\d{4,7}$/i.test(v)) return "cve";
  if (/[\w.-]+@[\w.-]+\.\w+/.test(v)) return "email";
  if (/^@[\w.-]+$/.test(v)) return "username";
  if (/^\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/.test(v) && v.length >= 8) return "phone";
  if (/^https?:\/\//i.test(v)) return "url";
  if (/\.([a-z]{2,})$/i.test(v)) return "domain";
  if (/^[a-fA-F0-9]{32,64}$/.test(v)) return "hash";
  return "organization";
}

function normalizeEntityName(value: string, type: KBEntityType): string {
  const v = value.trim().toLowerCase();
  if (type === "domain" || type === "email" || type === "url") return v;
  if (type === "wallet") return v.toLowerCase();
  if (type === "ip") return v; // keep dots — they're part of the canonical IP representation
  if (type === "phone") return v.replace(/[^\d+]/g, "");
  if (type === "hash") return v.replace(/[^a-f0-9]/g, "");
  if (type === "cve") return v.toUpperCase();
  // For person/organization: strip legal suffixes
  return v
    .replace(/\b(inc\.?|llc|ltd\.?|corp\.?|corporation|gmbh|s\.?a\.?|ag|sarl|bv|nv|pty\.?|plc|co\.?|group|holdings|foundation|limited)\b\.?/g, "")
    .replace(/[^\w\s.@-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractAttributes(text: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const orgMatch = text.match(/(?:organization|org|company|employer|owner|registrant)\s*:?\s*([^,.\n]+)/i);
  if (orgMatch) attrs.organization = orgMatch[1].trim().slice(0, 100);
  const locMatch = text.match(/(?:location|city|country|region|address)\s*:?\s*([^,.\n]+)/i);
  if (locMatch) attrs.location = locMatch[1].trim().slice(0, 100);
  const titleMatch = text.match(/(?:title|role|position|job)\s*:?\s*([^,.\n]+)/i);
  if (titleMatch) attrs.title = titleMatch[1].trim().slice(0, 100);
  const asnMatch = text.match(/(?:asn|as number|autonomous system)\s*:?\s*(AS\d+|\d+)/i);
  if (asnMatch) attrs.asn = asnMatch[1].trim();
  const registrarMatch = text.match(/(?:registrar)\s*:?\s*([^,.\n]+)/i);
  if (registrarMatch) attrs.registrar = registrarMatch[1].trim().slice(0, 100);
  return attrs;
}

function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  return false;
}

function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen > 0 ? 1 - dist / maxLen : 0;
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

function cryptoRandom(): string {
  // 12-char random hex
  return Math.random().toString(16).slice(2, 14) + Date.now().toString(16).slice(-4);
}

// Re-export for downstream use
export { INGESTED_FLAG };
