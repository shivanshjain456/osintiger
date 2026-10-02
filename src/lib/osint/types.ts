// OSINTiger core types — shared across backend + frontend

export type InputType =
  | "person"
  | "organization"
  | "domain"
  | "ip"
  | "wallet"
  | "cve"
  | "email"
  | "username"
  | "phone"
  | "url"
  | "hash"
  | "auto";

export type LanguageScript =
  | "latin"
  | "arabic"
  | "hebrew"
  | "cyrillic"
  | "cjk"
  | "devanagari"
  | "greek";

export interface DetectionResult {
  inputType: Exclude<InputType, "auto">;
  script: LanguageScript;
  languageGuess: string;
  regionHints: string[];
  sanitized: string;
  valid: boolean;
  reason?: string;
  detectionConfidence?: number;
}

export type SourceStatus = "loading" | "success" | "error" | "skipped" | "timeout";

export interface NormalizedFinding {
  data: string;
  source_url: string;
  confidence: number;
  timestamp: string;
  extra?: Record<string, unknown>;
}

export interface SourceResult {
  source: string;
  source_label: string;
  target: string;
  status: SourceStatus;
  error?: string;
  latency_ms?: number;
  findings: NormalizedFinding[];
  raw?: unknown;
}

export interface SourceConsulted {
  source: string;
  source_label: string;
  status: SourceStatus;
  url?: string;
  finding_count: number;
  error?: string;
}

export interface KeyFinding {
  claim: string;
  source: string;
  source_url: string;
  confidence: number;
}

export interface ACHHypothesis {
  id: string;
  statement: string;
  confidence: number;
  rationale: string;
}

export interface ACHMatrixCell {
  evidence: string;
  source: string;
  consistency: "consistent" | "inconsistent" | "neutral";
}

export interface ACHAnalysis {
  hypotheses: ACHHypothesis[];
  evidence: { text: string; source: string }[];
  matrix: ACHMatrixCell[][];
}

export interface Geopoint {
  label: string;
  country?: string;
  lat?: number;
  lon?: number;
  weight: number;
  note?: string;
  source: string;
}

// BLUF — Bottom Line Up Front: one-paragraph strategic summary.
export interface BLUFSection {
  text: string;
  key_judgment: string;
  confidence_level: "low" | "moderate" | "high" | "very_high";
}

// Timeline event — chronological intelligence item.
export interface TimelineEvent {
  date: string;
  event: string;
  source: string;
  source_url: string;
  confidence: number;
}

// 5W1H — Who, What, When, Where, Why, How.
export interface FiveW1HSection {
  who: string;
  what: string;
  when: string;
  where: string;
  why: string;
  how: string;
}

// Risk Matrix item — threat/risk with likelihood × impact.
export interface RiskItem {
  risk: string;
  category: "financial" | "operational" | "reputational" | "legal" | "technical" | "geopolitical";
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  score: number; // 1-9
  rationale: string;
  source: string;
}

// Link Analysis — entity relationship graph node + edge.
export interface LinkNode {
  id: string;
  label: string;
  type: "person" | "organization" | "domain" | "ip" | "email" | "wallet" | "location" | "repository" | "social" | "document" | "phone";
  weight: number;
  source: string;
}

export interface LinkEdge {
  from: string;
  to: string;
  label: string;
  confidence: number;
  source: string;
}

export interface LinkGraph {
  nodes: LinkNode[];
  edges: LinkEdge[];
}

// Collection Gaps — areas where intelligence is missing.
export interface CollectionGap {
  area: string;
  description: string;
  recommended_sources: string[];
  priority: "low" | "medium" | "high";
}

// Monitoring Recommendation — follow-up action.
export interface MonitoringRecommendation {
  action: string;
  frequency: string;
  rationale: string;
  source: string;
}

// Contradiction — conflicting evidence between sources.
export interface Contradiction {
  topic: string;
  claim_a: string;
  source_a: string;
  claim_b: string;
  source_b: string;
  resolution: string;
}

export interface ReportData {
  executive_summary: string;
  bluf?: BLUFSection;
  timeline?: TimelineEvent[];
  five_w1h?: FiveW1HSection;
  key_findings: KeyFinding[];
  detailed_analysis: string;
  contradictions?: Contradiction[];
  risk_matrix?: RiskItem[];
  sources_consulted: SourceConsulted[];
  ach_analysis: ACHAnalysis;
  geopoints: Geopoint[];
  link_graph?: LinkGraph;
  collection_gaps?: CollectionGap[];
  monitoring_recommendations?: MonitoringRecommendation[];
  confidence_score: number;
  attribution_valid: boolean;
  needs_manual_review: boolean;
  input_type: string;
  script: string;
  language_guess: string;
  target: string;
}

export type PipelineStepId =
  | "parse"
  | "route"
  | "query"
  | "normalize"
  | "synthesize"
  | "ach"
  | "attribute"
  | "format";

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  status: SourceStatus;
  detail?: string;
}

export type InvestigationStatus = "queued" | "in_progress" | "completed" | "failed";

export interface InvestigationRecord {
  id: string;
  target: string;
  input_type: string;
  language: string;
  script: string;
  modules: string[];
  status: InvestigationStatus;
  created_at: string;
  completed_at?: string;
  current_step: number;
  total_steps: number;
  steps: PipelineStep[];
  playbook?: string; // Feature 24 — playbook type used for this investigation
  source_results: SourceResult[];
  report: ReportData | null;
  error?: string;
  cache_expires_at: string;
  starred?: boolean;
  tags?: string[];
  notes?: string;
  bookmarked_findings?: number[]; // indices of bookmarked key findings
  finding_annotations?: Record<number, string>; // finding index -> annotation text
  userId?: string | null; // user who initiated (for notification routing)
}

export interface SanctionsMatch {
  sdn_name: string;
  similarity: number;
  program: string;
  entity_type?: string;
  remarks?: string;
  details_url: string;
}

export interface SanctionsResult {
  query: string;
  match_status: "no_match" | "possible_match" | "likely_match";
  matches: SanctionsMatch[];
  list_size: number;
  checked_at: string;
}

export interface CryptoTransaction {
  hash: string;
  block: number;
  timestamp: string;
  from: string;
  to: string;
  value_eth: number;
  token?: string;
  direction: "in" | "out" | "internal";
}

export interface CryptoCounterparty {
  address: string;
  count: number;
  total_eth: number;
  direction: "in" | "out" | "both";
}

export interface CryptoResult {
  wallet: string;
  valid: boolean;
  balance_eth: number;
  balance_usd: number;
  eth_price_usd: number;
  transaction_count: number;
  first_seen?: string;
  last_active?: string;
  top_counterparties: CryptoCounterparty[];
  total_volume_eth: number;
  risk_score: number;
  risk_label: "low" | "moderate" | "elevated" | "high";
  ai_assessment: string;
  transactions: CryptoTransaction[];
  sources: SourceConsulted[];
}

export interface VisualIntelResult {
  analysis: string;
  entities: string[];
  geolocation: string;
  confidence: number;
  warnings: string[];
  sources: SourceConsulted[];
}
