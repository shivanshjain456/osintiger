// Dynamic Investigation Graph — domain models.
// A continuously expanding knowledge graph that maps entities (nodes) and their
// relationships (edges) discovered during an investigation.
//
// The graph is DERIVED from investigation state (discoveredEntities + evidence),
// not stored separately. This ensures it's always up-to-date with the latest
// discoveries and avoids data duplication.
//
// Node types cover 13 entity categories. Edge types cover 12+ relationship
// categories. Both are extensible — new types can be added without breaking
// existing code.

// =====================
// Node Types
// =====================

/** All supported node types in the knowledge graph. */
export type GraphNodeType =
  | "person"
  | "organization"
  | "domain"
  | "ip"
  | "email"
  | "wallet"
  | "social"        // social media account (username)
  | "repository"    // GitHub/GitLab repository
  | "certificate"   // SSL/TLS certificate
  | "dns"           // DNS record
  | "leak"          // data breach / leak
  | "document"      // archived document / file
  | "news"          // news article
  | "phone"
  | "url"
  | "cve"
  | "hash"
  | "location";

/** A node in the knowledge graph. */
export interface GraphNode {
  /** Stable unique ID (hash of value+type). */
  id: string;
  /** Display label (the entity value). */
  label: string;
  /** Node type. */
  type: GraphNodeType;
  /** Weight = number of connections (degree). Higher = more connected. */
  weight: number;
  /** Confidence that this entity is relevant (0-1). */
  confidence: number;
  /** Recursion depth (0 = original target). */
  depth: number;
  /** Source that discovered this node. */
  source: string;
  /** When this node was discovered. */
  discoveredAt: string;
  /** Context in which this node was discovered (finding text). */
  context?: string;
}

// =====================
// Edge Types (Relationships)
// =====================

/** All supported relationship types in the knowledge graph. */
export type RelationshipType =
  | "owns"           // person/organization owns a domain/wallet/organization
  | "employed_at"    // person employed at organization
  | "registered_by"  // domain registered by person/organization
  | "hosts"          // IP hosts domain / organization hosts infrastructure
  | "resolves_to"    // domain resolves to IP
  | "mentions"       // news/document mentions entity
  | "follows"        // social account follows another
  | "commits_to"     // person commits to repository
  | "shares_email"   // two entities share the same email
  | "shares_phone"   // two entities share the same phone
  | "shares_wallet"  // two entities share the same wallet
  | "same_as"        // two entities are the same (alias)
  | "discovered_by"  // entity was discovered by investigating another entity
  | "links_to"       // generic link (URL → page, document → URL)
  | "related_to";    // generic relationship (fallback)

/** An edge in the knowledge graph. */
export interface GraphEdge {
  /** Source node ID. */
  from: string;
  /** Target node ID. */
  to: string;
  /** Relationship type. */
  type: RelationshipType;
  /** Human-readable label for the edge. */
  label: string;
  /** Confidence in this relationship (0-1). */
  confidence: number;
  /** Source that provided evidence for this relationship. */
  source: string;
  /** The finding text that revealed this relationship. */
  evidence?: string;
}

// =====================
// Knowledge Graph
// =====================

/** The complete knowledge graph for an investigation. */
export interface KnowledgeGraph {
  /** Investigation ID this graph belongs to. */
  investigationId: string;
  /** All nodes in the graph. */
  nodes: GraphNode[];
  /** All edges in the graph. */
  edges: GraphEdge[];
  /** Graph metadata. */
  meta: {
    nodeCount: number;
    edgeCount: number;
    typeDistribution: Record<GraphNodeType, number>;
    relationshipDistribution: Record<RelationshipType, number>;
    maxDepth: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

/** Response for the graph API endpoint. */
export interface GraphApiResponse {
  investigation_id: string;
  graph: KnowledgeGraph;
}

// =====================
// Node type metadata (colors, icons, radii for visualization)
// =====================

/** Visual metadata for each node type. */
export const NODE_TYPE_META: Record<GraphNodeType, {
  color: string;
  radius: number;
  label: string;
}> = {
  person:        { color: "#00ff41", radius: 22, label: "Person" },
  organization:  { color: "#00ffff", radius: 26, label: "Organization" },
  domain:        { color: "#ffaa00", radius: 18, label: "Domain" },
  ip:            { color: "#ff0040", radius: 16, label: "IP Address" },
  email:         { color: "#bb88ff", radius: 14, label: "Email" },
  wallet:        { color: "#ffcc00", radius: 20, label: "Crypto Wallet" },
  social:        { color: "#ff66aa", radius: 14, label: "Social Account" },
  repository:    { color: "#ff8866", radius: 16, label: "Repository" },
  certificate:   { color: "#66ffcc", radius: 15, label: "Certificate" },
  dns:           { color: "#88ccff", radius: 13, label: "DNS Record" },
  leak:          { color: "#ff4444", radius: 17, label: "Data Leak" },
  document:      { color: "#cccccc", radius: 14, label: "Document" },
  news:          { color: "#ffdd44", radius: 15, label: "News Article" },
  phone:         { color: "#66ffcc", radius: 14, label: "Phone" },
  url:           { color: "#4488ff", radius: 14, label: "URL" },
  cve:           { color: "#ff6600", radius: 18, label: "CVE" },
  hash:          { color: "#888888", radius: 13, label: "File Hash" },
  location:      { color: "#88ccff", radius: 16, label: "Location" },
};

/** Visual metadata for each relationship type. */
export const RELATIONSHIP_TYPE_META: Record<RelationshipType, {
  color: string;
  label: string;
  dashArray?: string;
}> = {
  owns:           { color: "#00ff41", label: "owns" },
  employed_at:    { color: "#00ffff", label: "employed at" },
  registered_by:  { color: "#ffaa00", label: "registered by" },
  hosts:          { color: "#ff0040", label: "hosts" },
  resolves_to:    { color: "#88ccff", label: "resolves to" },
  mentions:       { color: "#ffdd44", label: "mentions" },
  follows:        { color: "#ff66aa", label: "follows" },
  commits_to:     { color: "#ff8866", label: "commits to" },
  shares_email:   { color: "#bb88ff", label: "shares email", dashArray: "4 2" },
  shares_phone:   { color: "#66ffcc", label: "shares phone", dashArray: "4 2" },
  shares_wallet:  { color: "#ffcc00", label: "shares wallet", dashArray: "4 2" },
  same_as:        { color: "#ffffff", label: "same as", dashArray: "2 2" },
  discovered_by:  { color: "#444444", label: "discovered by", dashArray: "1 3" },
  links_to:       { color: "#4488ff", label: "links to" },
  related_to:     { color: "#666666", label: "related to", dashArray: "6 3" },
};
