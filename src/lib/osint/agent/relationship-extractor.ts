// Relationship Extractor — parses finding text to identify relationships between entities.
// Uses pattern matching to detect 12+ relationship types from natural language findings.
//
// Design:
// - Pure function: given finding text + known entities, returns edges.
// - Pattern-based: uses regex to find relationship keywords + entity references.
// - Conservative: only creates edges when both endpoints are known entities.
// - Confidence scoring: stronger patterns get higher confidence.

import type { DiscoveredEntity } from "./types";
import type { GraphEdge, RelationshipType } from "./graph-types";
import { entityId } from "./types";
import { PATTERNS } from "../detector";

/** A candidate entity found in text, with its position. */
interface TextEntity {
  value: string;
  type: DiscoveredEntity["type"];
  start: number;
  end: number;
}

/** Extract all entities mentioned in a text string, with their positions. */
function extractEntitiesFromText(text: string): TextEntity[] {
  const entities: TextEntity[] = [];

  // Extract emails (check first — emails contain @ and may look like domains)
  const emailRe = new RegExp(PATTERNS.EMAIL_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = emailRe.exec(text)) !== null) {
    entities.push({ value: m[0], type: "email", start: m.index, end: m.index + m[0].length });
  }

  // Extract domains (but not if they're part of an email — check overlap)
  const domainRe = new RegExp(PATTERNS.DOMAIN_RE.source, "gi");
  while ((m = domainRe.exec(text)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    // Skip if this overlaps with an already-found email
    if (entities.some((e) => e.start < end && e.end > start)) continue;
    entities.push({ value: m[0], type: "domain", start, end });
  }

  // Extract IPv4 addresses
  const ipv4Re = new RegExp(PATTERNS.IPv4_RE.source, "gi");
  while ((m = ipv4Re.exec(text)) !== null) {
    entities.push({ value: m[0], type: "ip", start: m.index, end: m.index + m[0].length });
  }

  // Extract ETH wallets
  const ethRe = new RegExp(PATTERNS.ETH_RE.source, "gi");
  while ((m = ethRe.exec(text)) !== null) {
    entities.push({ value: m[0], type: "wallet", start: m.index, end: m.index + m[0].length });
  }

  // Extract BTC wallets
  const btcRe = new RegExp(PATTERNS.BTC_RE.source, "gi");
  while ((m = btcRe.exec(text)) !== null) {
    entities.push({ value: m[0], type: "wallet", start: m.index, end: m.index + m[0].length });
  }

  return entities;
}

/** Relationship pattern: regex + the relationship type it indicates. */
interface RelationshipPattern {
  regex: RegExp;
  type: RelationshipType;
  label: string;
  confidence: number;
}

// Patterns are ordered by specificity (most specific first).
// Each pattern looks for a keyword/phrase that indicates a relationship,
// with entities on either side.
const RELATIONSHIP_PATTERNS: RelationshipPattern[] = [
  // resolves_to: "X resolves to Y", "X → Y (A record)", "A record: X → Y"
  {
    regex: /\b(?:resolves?\s+to|points?\s+to|A\s+record[:\s]+)\s*([\w.-]+)\s*(?:→|->|=|:)?\s*([\d.]+)/i,
    type: "resolves_to",
    label: "resolves to",
    confidence: 0.9,
  },
  {
    regex: /\b([\w.-]+)\s+(?:resolves?\s+to|points?\s+to)\s+([\d.]+)/i,
    type: "resolves_to",
    label: "resolves to",
    confidence: 0.9,
  },
  // registered_by: "registered by X", "registrar: X"
  {
    regex: /\bregistered\s+by\s+(.+)/i,
    type: "registered_by",
    label: "registered by",
    confidence: 0.85,
  },
  {
    regex: /\bregistrar[:\s]+(.+)/i,
    type: "registered_by",
    label: "registrar",
    confidence: 0.85,
  },
  // hosts: "X hosts Y", "hosted on X", "X is hosted on Y"
  {
    regex: /\bhosted\s+(?:on|by|at)\s+(.+)/i,
    type: "hosts",
    label: "hosted on",
    confidence: 0.8,
  },
  // employed_at: "employed at X", "works at X", "employee of X"
  {
    regex: /\b(?:employed\s+at|works?\s+at|employee\s+of)\s+(.+)/i,
    type: "employed_at",
    label: "employed at",
    confidence: 0.85,
  },
  // owns: "owns X", "owned by X", "owner: X"
  {
    regex: /\bowned\s+by\s+(.+)/i,
    type: "owns",
    label: "owned by",
    confidence: 0.85,
  },
  {
    regex: /\bowner[:\s]+(.+)/i,
    type: "owns",
    label: "owner",
    confidence: 0.8,
  },
  // mentions: "mentions X", "referenced by X", "X mentioned in Y"
  {
    regex: /\bmentions?\s+(.+)/i,
    type: "mentions",
    label: "mentions",
    confidence: 0.75,
  },
  // follows: "follows X", "follower of X"
  {
    regex: /\bfollows?\s+(.+)/i,
    type: "follows",
    label: "follows",
    confidence: 0.7,
  },
  // commits_to: "commits to X", "contributor to X", "committed to X"
  {
    regex: /\b(?:commits?\s+to|contributor\s+to|committed\s+to)\s+(.+)/i,
    type: "commits_to",
    label: "commits to",
    confidence: 0.8,
  },
];

/**
 * Extract relationships from a finding text.
 * @param text The finding text to parse.
 * @param knownEntities All entities known in the investigation (for endpoint matching).
 * @param sourceLabel The source that produced this finding.
 * @returns Array of edges (relationships) found in the text.
 */
export function extractRelationships(
  text: string,
  knownEntities: DiscoveredEntity[],
  sourceLabel: string
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const textEntities = extractEntitiesFromText(text);

  if (textEntities.length < 1) return edges;

  // Build a lookup: entity value → entity ID (for matching text entities to known entities)
  const entityLookup = new Map<string, DiscoveredEntity>();
  for (const e of knownEntities) {
    entityLookup.set(e.value.toLowerCase(), e);
  }

  // Match text entities to known entities
  const matchedEntities: { textEntity: TextEntity; entity: DiscoveredEntity }[] = [];
  for (const te of textEntities) {
    const match = entityLookup.get(te.value.toLowerCase());
    if (match) {
      matchedEntities.push({ textEntity: te, entity: match });
    }
  }

  // 1. Pattern-based relationship extraction
  for (const pattern of RELATIONSHIP_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      // The pattern matched — find which entities are involved
      // The captured group(s) contain the entity reference
      const capturedText = match[1] || match[0];
      // Find known entities that appear in the captured text
      const capturedEntities = matchedEntities.filter((me) =>
        capturedText.toLowerCase().includes(me.textEntity.value.toLowerCase())
      );

      if (capturedEntities.length >= 1) {
        // Find another entity in the text that's NOT in the captured group (the other endpoint)
        const otherEntities = matchedEntities.filter(
          (me) => !capturedText.toLowerCase().includes(me.textEntity.value.toLowerCase())
        );

        if (otherEntities.length >= 1) {
          // Create edges between the captured entity and the other entity
          for (const cap of capturedEntities.slice(0, 1)) {
            for (const other of otherEntities.slice(0, 1)) {
              edges.push({
                from: other.entity.id,
                to: cap.entity.id,
                type: pattern.type,
                label: pattern.label,
                confidence: pattern.confidence,
                source: sourceLabel,
                evidence: text.slice(0, 200),
              });
            }
          }
        }
      }
    }
  }

  // 2. Co-occurrence based relationships: if two entities appear in the same finding,
  // they're likely related. Use "related_to" with lower confidence.
  if (matchedEntities.length >= 2) {
    for (let i = 0; i < matchedEntities.length; i++) {
      for (let j = i + 1; j < matchedEntities.length; j++) {
        const a = matchedEntities[i].entity;
        const b = matchedEntities[j].entity;
        // Skip if they're the same entity
        if (a.id === b.id) continue;
        // Skip if an edge already exists between them
        if (edges.some((e) =>
          (e.from === a.id && e.to === b.id) || (e.from === b.id && e.to === a.id)
        )) continue;
        // Determine relationship type based on entity types
        const relType = inferRelationshipType(a.type, b.type);
        if (relType) {
          edges.push({
            from: a.id,
            to: b.id,
            type: relType,
            label: getRelationshipLabel(relType),
            confidence: 0.6, // Co-occurrence is lower confidence
            source: sourceLabel,
            evidence: text.slice(0, 200),
          });
        }
      }
    }
  }

  return edges;
}

/** Infer a relationship type based on the types of two entities. */
function inferRelationshipType(
  typeA: DiscoveredEntity["type"],
  typeB: DiscoveredEntity["type"]
): RelationshipType | null {
  // domain → ip: resolves_to
  if (typeA === "domain" && typeB === "ip") return "resolves_to";
  if (typeA === "ip" && typeB === "domain") return "hosts";
  // domain → email: registered_by or related
  if (typeA === "domain" && typeB === "email") return "registered_by";
  if (typeA === "email" && typeB === "domain") return "registered_by";
  // domain → wallet: related (crypto infrastructure)
  if (typeA === "domain" && typeB === "wallet") return "related_to";
  if (typeA === "wallet" && typeB === "domain") return "related_to";
  // domain → organization: registered_by
  if (typeA === "domain" && typeB === "organization") return "registered_by";
  if (typeA === "organization" && typeB === "domain") return "owns";
  // person → organization: employed_at
  if (typeA === "person" && typeB === "organization") return "employed_at";
  if (typeA === "organization" && typeB === "person") return "employed_at";
  // person → domain: owns
  if (typeA === "person" && typeB === "domain") return "owns";
  if (typeA === "domain" && typeB === "person") return "registered_by";
  // ip → organization: hosts
  if (typeA === "ip" && typeB === "organization") return "hosts";
  if (typeA === "organization" && typeB === "ip") return "hosts";
  // email → person: same_as (email belongs to person)
  if (typeA === "email" && typeB === "person") return "related_to";
  if (typeA === "person" && typeB === "email") return "related_to";
  // wallet → person: owns
  if (typeA === "wallet" && typeB === "person") return "owns";
  if (typeA === "person" && typeB === "wallet") return "owns";
  // Default: related_to
  return "related_to";
}

/** Get a human-readable label for a relationship type. */
function getRelationshipLabel(type: RelationshipType): string {
  const labels: Record<RelationshipType, string> = {
    owns: "owns",
    employed_at: "employed at",
    registered_by: "registered by",
    hosts: "hosts",
    resolves_to: "resolves to",
    mentions: "mentions",
    follows: "follows",
    commits_to: "commits to",
    shares_email: "shares email",
    shares_phone: "shares phone",
    shares_wallet: "shares wallet",
    same_as: "same as",
    discovered_by: "discovered by",
    links_to: "links to",
    related_to: "related to",
  };
  return labels[type] || type;
}

/**
 * Detect shared-attribute relationships across all entities.
 * If two entities share the same email/phone/wallet, create a "shares_*" edge.
 */
export function detectSharedAttributeRelationships(
  entities: DiscoveredEntity[]
): { edges: GraphEdge[]; sharedEmails: Map<string, string[]>; sharedWallets: Map<string, string[]> } {
  const edges: GraphEdge[] = [];

  // Group entities by email domain (for shares_email)
  const emailGroups = new Map<string, DiscoveredEntity[]>();
  const walletGroups = new Map<string, DiscoveredEntity[]>();

  for (const e of entities) {
    if (e.type === "email") {
      const domain = e.value.split("@")[1]?.toLowerCase();
      if (domain) {
        if (!emailGroups.has(domain)) emailGroups.set(domain, []);
        emailGroups.get(domain)!.push(e);
      }
    }
    if (e.type === "wallet") {
      const addr = e.value.toLowerCase();
      if (!walletGroups.has(addr)) walletGroups.set(addr, []);
      walletGroups.get(addr)!.push(e);
    }
  }

  // Create shares_email edges between entities that share an email domain
  const sharedEmails = new Map<string, string[]>();
  for (const [domain, group] of emailGroups) {
    if (group.length >= 2) {
      sharedEmails.set(domain, group.map((e) => e.value));
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          edges.push({
            from: group[i].id,
            to: group[j].id,
            type: "shares_email",
            label: `shares @${domain}`,
            confidence: 0.8,
            source: "graph-analysis",
            evidence: `Both entities use email domain ${domain}`,
          });
        }
      }
    }
  }

  // Create shares_wallet edges between entities that share a wallet address
  const sharedWallets = new Map<string, string[]>();
  for (const [addr, group] of walletGroups) {
    if (group.length >= 2) {
      sharedWallets.set(addr, group.map((e) => e.value));
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          edges.push({
            from: group[i].id,
            to: group[j].id,
            type: "shares_wallet",
            label: "shares wallet",
            confidence: 0.95,
            source: "graph-analysis",
            evidence: `Both entities reference wallet ${addr.slice(0, 10)}...`,
          });
        }
      }
    }
  }

  return { edges, sharedEmails, sharedWallets };
}
