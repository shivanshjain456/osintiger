// Frontend API client for OSINTiger. Calls the Next.js API routes (relative paths).

import type {
  InvestigationRecord,
  SanctionsResult,
  CryptoResult,
  VisualIntelResult,
  DetectionResult,
} from "./types";

export interface InitiateResponse {
  investigation_id: string;
  status: string;
  estimated_time: number;
  detection: {
    input_type: string;
    script: string;
    language: string;
    region_hints: string[];
  };
}

export interface PollResponse {
  investigation_id: string;
  status: InvestigationRecord["status"];
  progress: { current_step: number; total_steps: number; step_name: string };
  steps: InvestigationRecord["steps"];
  source_results: InvestigationRecord["source_results"];
  report: InvestigationRecord["report"];
  error?: string;
  target: string;
  input_type: string;
  language: string;
  created_at: string;
  completed_at?: string;
}

export async function initiateInvestigation(
  target: string,
  opts?: { input_type?: string; language?: string; modules?: string[]; playbook?: string }
): Promise<InitiateResponse> {
  const r = await fetch("/api/investigate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, ...opts }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${r.status})`);
  }
  return r.json();
}

export async function pollInvestigation(id: string): Promise<PollResponse> {
  const r = await fetch(`/api/investigate/${id}`, { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Poll failed (${r.status})`);
  }
  return r.json();
}

export async function fetchRecent() {
  const r = await fetch("/api/recent", { cache: "no-store" });
  return r.json() as Promise<{
    investigations: {
      id: string;
      target: string;
      input_type: string;
      status: string;
      created_at: string;
      completed_at?: string;
      confidence: number | null;
    }[];
  }>;
}

export interface HistoryItem {
  id: string;
  target: string;
  input_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
  confidence: number | null;
  key_findings_count: number;
  sources_count: number;
  needs_review: boolean;
  starred: boolean;
  tags: string[];
  notes: string;
  bookmarked_findings: number[];
  finding_annotations: Record<number, string>;
}

export async function fetchRecentWithFilters(
  q: string,
  type: string,
  limit = 50,
  starredOnly = false
): Promise<{ investigations: HistoryItem[]; total: number }> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type && type !== "all") params.set("type", type);
  if (starredOnly) params.set("starred", "true");
  params.set("limit", String(limit));
  const r = await fetch(`/api/recent?${params}`, { cache: "no-store" });
  return r.json();
}

export async function deleteInvestigation(id: string): Promise<boolean> {
  const r = await fetch(`/api/investigate/${id}`, { method: "DELETE" });
  return r.ok;
}

export async function patchInvestigationMetadata(
  id: string,
  patch: {
    starred?: boolean;
    tags?: string[];
    notes?: string;
    bookmarked_findings?: number[];
    finding_annotations?: Record<number, string>;
  }
): Promise<{
  success: boolean;
  starred: boolean;
  tags: string[];
  notes: string;
  bookmarked_findings: number[];
  finding_annotations: Record<number, string>;
}> {
  const r = await fetch(`/api/investigate/${id}/metadata`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Patch failed (${r.status})`);
  }
  return r.json();
}

export async function fetchSanctions(name: string): Promise<SanctionsResult> {
  const r = await fetch(`/api/sanctions/${encodeURIComponent(name)}`, { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Sanctions request failed (${r.status})`);
  }
  return r.json();
}

export async function fetchCrypto(wallet: string): Promise<CryptoResult> {
  const r = await fetch(`/api/crypto/${encodeURIComponent(wallet)}`, { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Crypto request failed (${r.status})`);
  }
  return r.json();
}

export async function analyzeImageFile(file: File): Promise<VisualIntelResult> {
  const fd = new FormData();
  fd.append("image", file);
  const r = await fetch("/api/analyze-image", { method: "POST", body: fd });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Image analysis failed (${r.status})`);
  }
  return r.json();
}

export async function analyzeImageUrl(url: string): Promise<VisualIntelResult> {
  const r = await fetch("/api/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl: url }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Image analysis failed (${r.status})`);
  }
  return r.json();
}

export type { DetectionResult };

// =====================
// Autonomous Agent API
// =====================

export interface AgentConfig {
  maxIterations: number;
  maxEntities: number;
  maxTimeSeconds: number;
  maxDepth: number;
  maxActionsPerIteration: number;
  enableRecursiveExpansion: boolean;
  enableReportSynthesis: boolean;
}

export interface AgentDiscoveredEntity {
  id: string;
  value: string;
  type: string;
  depth: number;
  discoveredBy: string;
  discoveredByLabel: string;
  discoveredAt: string;
  confidence: number;
  context: string;
}

export interface AgentEvidence {
  id: string;
  source: string;
  sourceLabel: string;
  target: string;
  findings: { data: string; source_url: string; confidence: number; timestamp: string }[];
  status: string;
  error?: string;
  iteration: number;
  collectedAt: string;
  latencyMs?: number;
}

export interface AgentFrontierItem {
  entityValue: string;
  entityType: string;
  depth: number;
  priority: number;
  reason: string;
  addedAt: string;
}

export interface AgentTraceEntry {
  iteration: number;
  phase: "planning" | "executing" | "extracting" | "stopping" | "synthesizing";
  timestamp: string;
  actions?: { source: string; target: string; reason: string; targetType: string }[];
  strategyNote?: string;
  action?: { source: string; target: string; reason: string; targetType: string };
  result?: {
    status: string;
    findingCount: number;
    newEntitiesFound: number;
    summary: string;
    latencyMs?: number;
  };
  entitiesDiscovered?: AgentDiscoveredEntity[];
  stopReason?: string;
}

export interface AgentPollResponse {
  investigation_id: string;
  status: "queued" | "running" | "completed" | "failed" | "stopped";
  current_phase: "planning" | "executing" | "extracting" | "synthesizing" | "idle" | "complete";
  iteration: number;
  objective: string;
  target: string;
  input_type: string;
  config: AgentConfig;
  discovered_entities: AgentDiscoveredEntity[];
  evidence: AgentEvidence[];
  frontier: AgentFrontierItem[];
  trace: AgentTraceEntry[];
  current_strategy?: string;
  started_at: string;
  completed_at?: string;
  error?: string;
  report?: import("./types").ReportData | null;
  stats: {
    entities_count: number;
    evidence_count: number;
    actions_count: number;
    iterations: number;
    elapsed_seconds: number;
  };
}

export async function initiateAgentInvestigation(
  target: string,
  opts?: { objective?: string; input_type?: string; config?: Partial<AgentConfig> }
): Promise<{ investigation_id: string; status: string; objective: string; target: string; input_type: string; config: AgentConfig }> {
  const r = await fetch("/api/agent/investigate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, ...opts }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${r.status})`);
  }
  return r.json();
}

export async function pollAgentInvestigation(id: string): Promise<AgentPollResponse> {
  const r = await fetch(`/api/agent/investigate/${id}`, { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Poll failed (${r.status})`);
  }
  return r.json();
}

// =====================
// Recursive Discovery Engine API (Feature 3)
// =====================

export interface DiscoveryConfig {
  maxDepth: number;
  typeDepthOverrides: Record<string, number>;
  maxEntities: number;
  maxTimeSeconds: number;
  maxSourcesPerEntity: number;
  allowSameTypeExpansion: boolean;
  expandTypes: string[];
  skipTypes: string[];
}

export interface DiscoveryTreeNode {
  entityId: string;
  value: string;
  type: string;
  depth: number;
  parentEntityId: string | null;
  discoveredBy: string;
  discoveredByLabel: string;
  discoveredAt: string;
  confidence: number;
  context: string;
  children: DiscoveryTreeNode[];
  expanded: boolean;
  findingCount: number;
  expanding: boolean;
}

export interface DiscoveryTraceEntry {
  timestamp: string;
  entityValue: string;
  entityType: string;
  depth: number;
  sources: string[];
  newEntities: { id: string; value: string; type: string; depth: number; confidence: number }[];
  findingCount: number;
  durationMs: number;
  status: string;
  note?: string;
}

export interface DiscoveryPollResponse {
  discovery_id: string;
  status: "queued" | "running" | "completed" | "failed" | "stopped";
  current_phase: "expanding" | "extracting" | "idle" | "complete";
  root_target: string;
  root_type: string;
  config: DiscoveryConfig;
  tree: DiscoveryTreeNode | null;
  all_entities: { id: string; value: string; type: string; depth: number; confidence: number; discoveredByLabel: string }[];
  trace: DiscoveryTraceEntry[];
  started_at: string;
  completed_at?: string;
  error?: string;
  currently_expanding?: string;
  stats: {
    total_entities: number;
    total_expanded: number;
    max_depth_reached: number;
    total_findings: number;
    elapsed_seconds: number;
  };
}

export async function startDiscovery(
  target: string,
  opts?: { input_type?: string; config?: Partial<DiscoveryConfig> }
): Promise<{ discovery_id: string; status: string; root_target: string; root_type: string; config: DiscoveryConfig }> {
  const r = await fetch("/api/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, ...opts }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${r.status})`);
  }
  return r.json();
}

export async function pollDiscovery(id: string): Promise<DiscoveryPollResponse> {
  const r = await fetch(`/api/discover/${id}`, { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Poll failed (${r.status})`);
  }
  return r.json();
}

// =====================
// AI Investigation Planner API (Feature 4)
// =====================

export interface PlanConfig {
  maxSteps: number;
  maxSourcesPerStep: number;
  maxTimeSeconds: number;
  enableReportSynthesis: boolean;
  allowParallelExecution: boolean;
}

export interface PlanStep {
  stepNumber: number;
  name: string;
  reasoning: string;
  target: string;
  targetType: string;
  sources: string[];
  expectedOutcomes: string[];
  parallelizable: boolean;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  findingCount: number;
  durationMs: number;
  error?: string;
}

export interface InvestigationPlan {
  objective: string;
  target: string;
  inputType: string;
  strategySummary: string;
  steps: PlanStep[];
  categories: string[];
  estimatedTimeSeconds: number;
}

export interface PlanPollResponse {
  plan_id: string;
  status: "planning" | "executing" | "completed" | "failed";
  objective: string;
  target: string;
  input_type: string;
  config: PlanConfig;
  plan: InvestigationPlan | null;
  current_step: number;
  evidence_count: number;
  entity_count: number;
  finding_count: number;
  started_at: string;
  completed_at?: string;
  error?: string;
  report?: import("./types").ReportData | null;
  planning_notes: string;
  stats: {
    total_steps: number;
    completed_steps: number;
    failed_steps: number;
    elapsed_seconds: number;
  };
}

export async function startPlan(
  target: string,
  opts?: { objective?: string; input_type?: string; config?: Partial<PlanConfig> }
): Promise<{ plan_id: string; status: string; objective: string; target: string; input_type: string }> {
  const r = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, ...opts }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${r.status})`);
  }
  return r.json();
}

export async function pollPlan(id: string): Promise<PlanPollResponse> {
  const r = await fetch(`/api/plan/${id}`, { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Poll failed (${r.status})`);
  }
  return r.json();
}

// =====================
// Live Monitoring API (Feature 17)
// =====================

export interface MonitorConfig {
  categories: string[];
  intervalSeconds: number;
  maxSnapshots: number;
  alertThreshold: string;
}

export interface SnapshotEntry {
  data: string;
  source: string;
  sourceLabel: string;
  confidence: number;
  timestamp: string;
}

export interface MonitorSnapshot {
  id: string;
  timestamp: string;
  category: string;
  entries: SnapshotEntry[];
  entryCount: number;
}

export interface ChangeAlert {
  id: string;
  timestamp: string;
  category: string;
  changeType: string;
  severity: string;
  entity: string;
  source: string;
  sourceLabel: string;
  previousState: string;
  currentState: string;
  confidence: number;
  significance: string;
  relatedEntities: string[];
}

export interface MonitorPollResponse {
  monitor_id: string;
  status: string;
  target: string;
  config: MonitorConfig;
  snapshots: MonitorSnapshot[];
  alerts: ChangeAlert[];
  last_scan_at: string | null;
  started_at: string;
  error?: string;
  stats: {
    total_snapshots: number;
    total_alerts: number;
    alerts_by_severity: Record<string, number>;
    alerts_by_category: Record<string, number>;
    elapsed_seconds: number;
  };
}

export async function startMonitor(
  target: string,
  opts?: { input_type?: string; config?: Partial<MonitorConfig> }
): Promise<{ monitor_id: string; status: string; target: string; config: MonitorConfig }> {
  const r = await fetch("/api/monitor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, ...opts }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Request failed (${r.status})`);
  }
  return r.json();
}

export async function pollMonitor(id: string): Promise<MonitorPollResponse> {
  const r = await fetch(`/api/monitor/${id}`, { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Poll failed (${r.status})`);
  }
  return r.json();
}

export async function triggerMonitorScan(id: string): Promise<{ monitor_id: string; status: string }> {
  const r = await fetch(`/api/monitor/${id}/scan`, { method: "POST" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Scan failed (${r.status})`);
  }
  return r.json();
}

// =====================
// Knowledge Base API (Feature 19)
// =====================

export interface KBEntity {
  id: string;
  type: string;
  primaryName: string;
  normalizedName: string;
  aliases: string[];
  attributes: Record<string, string>;
  confidence: number;
  tier: number;
  status: string;
  mergedIntoId?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  observationCount: number;
  investigationCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface KBRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  fromName: string;
  toName: string;
  relationType: string;
  label: string;
  confidence: number;
  tier: number;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  observationCount: number;
  investigationCount: number;
}

export interface KBEvidence {
  id: string;
  entityId?: string;
  relationshipId?: string;
  investigationId: string;
  investigationKind: string;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: number;
  rawText: string;
  normalizedText: string;
  confidence: number;
  observedAt: string;
  createdAt: string;
}

export interface KBVersion {
  id: string;
  recordType: string;
  recordId: string;
  versionNumber: number;
  snapshot: Record<string, unknown>;
  validFrom: string;
  validTo?: string;
  changeType: string;
  changeReason: string;
  investigationId: string;
  createdAt: string;
}

export interface KBConflict {
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
  status: string;
  resolution: string;
  detectedAt: string;
  resolvedAt?: string;
}

export interface KBStats {
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

export interface KBReport {
  stats: KBStats;
  recentEntities: KBEntity[];
  recentRelationships: KBRelationship[];
  recentInvestigations: { investigationId: string; investigationKind: string; target: string; timestamp: string; entityCount: number }[];
  topEntities: KBEntity[];
  generatedAt: string;
}

export interface KBSearchResult {
  entities: KBEntity[];
  relationships: KBRelationship[];
  evidence: KBEvidence[];
  totalMatches: number;
  query: string;
}

export interface KBEntityDetail {
  entity: KBEntity;
  evidence: KBEvidence[];
  relationships: KBRelationship[];
  conflicts: KBConflict[];
  versions: KBVersion[];
  investigations: { investigationId: string; investigationKind: string; contributionType: string; timestamp: string }[];
}

export interface KBIngestResult {
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

export async function fetchKBStats(): Promise<KBStats> {
  const r = await fetch("/api/kb/stats", { cache: "no-store" });
  if (!r.ok) throw new Error(`KB stats failed (${r.status})`);
  return r.json();
}

export async function fetchKBReport(): Promise<KBReport> {
  const r = await fetch("/api/kb/report", { cache: "no-store" });
  if (!r.ok) throw new Error(`KB report failed (${r.status})`);
  return r.json();
}

export async function searchKB(query: string, limit = 30): Promise<KBSearchResult> {
  const r = await fetch(`/api/kb/search?q=${encodeURIComponent(query)}&limit=${limit}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`KB search failed (${r.status})`);
  return r.json();
}

export async function fetchKBEntity(id: string): Promise<KBEntityDetail> {
  const r = await fetch(`/api/kb/entity/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`KB entity failed (${r.status})`);
  return r.json();
}

export async function fetchKBRecent(limit = 20): Promise<{ recent: { investigationId: string; investigationKind: string; target: string; timestamp: string; entityCount: number; relCount: number }[] }> {
  const r = await fetch(`/api/kb/recent?limit=${limit}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`KB recent failed (${r.status})`);
  return r.json();
}

export async function ingestInvestigationToKB(
  id: string,
  kind: "standard" | "agent" | "discovery" | "plan" | "monitor" = "standard"
): Promise<KBIngestResult> {
  const r = await fetch(`/api/kb/ingest/${id}?kind=${kind}`, { cache: "no-store" });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `KB ingest failed (${r.status})`);
  }
  return r.json();
}

// =====================
// AI Question Answering API (Feature 21)
// =====================

export type QuestionIntent =
  | "factual_lookup" | "comparative" | "timeline" | "relationship"
  | "risk" | "synthesis" | "evidence_request" | "follow_up"
  | "disambiguation" | "unknown";

export type AnswerMode =
  | "short" | "detailed" | "bullet_summary" | "tabular_comparison"
  | "evidence_digest" | "refusal" | "clarification";

export interface QuestionInterpretation {
  intent: QuestionIntent;
  targetEntities: string[];
  scope: "current_investigation" | "knowledge_base" | "both";
  timeRange?: { start?: string; end?: string };
  requestedMode: AnswerMode;
  subQuestions: string[];
  isFollowUp: boolean;
  needsClarification: boolean;
  clarificationQuestion?: string;
  reasoning: string;
}

export interface RetrievedEvidence {
  id: string;
  source: string;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: number;
  content: string;
  confidence: number;
  observedAt: string;
  relevanceScore: number;
  credibilityScore: number;
  recencyScore: number;
  diversityBonus: number;
  overallRank: number;
  entityId?: string;
  relationshipId?: string;
  investigationId?: string;
}

export interface Citation {
  index: number;
  evidenceId: string;
  sourceKey: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: number;
  snippet: string;
  confidence: number;
}

export interface ReasoningStep {
  step: number;
  description: string;
  evidenceUsed: string[];
  reasoning: string;
}

export interface ContradictionSummary {
  topic: string;
  claimA: string;
  sourceA: string;
  claimB: string;
  sourceB: string;
  strongerSide: "a" | "b" | "neither";
  rationale: string;
  additionalEvidenceNeeded: string;
}

export interface QAAnswer {
  question: string;
  interpretation: QuestionInterpretation;
  answerMode: AnswerMode;
  answer: string;
  citations: Citation[];
  reasoningChain: ReasoningStep[];
  contradictions: ContradictionSummary[];
  evidenceUsed: RetrievedEvidence[];
  evidenceRejected: { evidence: RetrievedEvidence; reason: string }[];
  confidence: number;
  confidenceLabel: "low" | "moderate" | "high" | "very_high";
  evidenceSufficiency: "sufficient" | "partial" | "insufficient";
  limitations: string[];
  followUpSuggestions: string[];
  answeredAt: string;
  durationMs: number;
}

export interface ConversationTurn {
  question: string;
  answer: string;
  interpretation?: QuestionInterpretation;
  timestamp: string;
}

export interface QAResponse {
  investigation_id?: string;
  question: string;
  answer: QAAnswer;
}

export async function askQuestion(
  question: string,
  opts?: {
    investigationId?: string;
    investigationKind?: "standard" | "agent" | "discovery" | "plan" | "monitor";
    conversationHistory?: ConversationTurn[];
    useKnowledgeBase?: boolean;
  }
): Promise<QAResponse> {
  const r = await fetch("/api/qa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, ...opts }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `QA failed (${r.status})`);
  }
  return r.json();
}

// Legacy ask endpoint (backward compat — returns structured_answer too)
export async function askQuestionLegacy(
  investigationId: string,
  question: string,
  opts?: {
    conversationHistory?: ConversationTurn[];
    useKnowledgeBase?: boolean;
  }
): Promise<{
  investigation_id: string;
  question: string;
  answer: string;
  evidence_based: boolean;
  sources_cited: string[];
  answered_at: string;
  structured_answer: QAAnswer;
}> {
  const r = await fetch(`/api/investigate/${investigationId}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, ...opts }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Ask failed (${r.status})`);
  }
  return r.json();
}

// =====================
// Multi-Agent Debate API (Feature 22)
// =====================

export type DebateAgentType =
  | "research" | "technical" | "cybersecurity" | "business"
  | "fact_checker" | "risk" | "ach";

export interface DebateAgentObservation {
  observation: string;
  evidenceRefs: string[];
  confidence: number;
  uncertainty: string;
}

export interface DebateAgentAnalysis {
  agentType: DebateAgentType;
  agentName: string;
  applicable: boolean;
  keyObservations: DebateAgentObservation[];
  supportingEvidence: { ref: string; relevance: string }[];
  confidenceLevel: "low" | "moderate" | "high" | "very_high";
  confidenceScore: number;
  uncertainties: string[];
  contradictions: { topic: string; description: string }[];
  recommendedNextSteps: string[];
  summary: string;
  reasoningTimeMs: number;
  error?: string;
}

export type DebateConflictType = "agreement" | "partial_agreement" | "direct_contradiction" | "unsupported_claim" | "missing_evidence";

export interface DebateConflictItem {
  id: string;
  type: DebateConflictType;
  topic: string;
  description: string;
  agents: { agentType: DebateAgentType; position: string; confidence: number }[];
  resolution: string;
  strongerSide?: DebateAgentType;
  resolutionRationale: string;
}

export interface DebateRound {
  roundNumber: number;
  startedAt: string;
  completedAt: string;
  agentAnalyses: DebateAgentAnalysis[];
  conflicts: DebateConflictItem[];
  durationMs: number;
}

export interface DebateCoordinatorSynthesis {
  finalConclusion: string;
  supportingRationale: string;
  areasOfAgreement: { topic: string; agents: DebateAgentType[]; summary: string }[];
  areasOfDisagreement: { topic: string; positions: { agent: DebateAgentType; position: string }[]; resolution: string }[];
  unresolvedUncertainties: string[];
  agentContributions: { agentType: DebateAgentType; contribution: string; weight: number }[];
  evidenceReferences: { ref: string; supportingAgents: DebateAgentType[]; significance: string }[];
  recommendedNextActions: string[];
  overallConfidence: number;
  confidenceLabel: "low" | "moderate" | "high" | "very_high";
  debateRoundsNeeded: number;
  stoppingReason: string;
  synthesisTimeMs: number;
}

export interface DebateResult {
  investigationId: string;
  objective: string;
  target: string;
  inputType: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  rounds: DebateRound[];
  finalSynthesis: DebateCoordinatorSynthesis;
  agentSummaries: { agentType: DebateAgentType; agentName: string; applicable: boolean; summary: string; confidence: number }[];
  evidenceBundleSummary: {
    totalFindings: number;
    totalSources: number;
    evidencePreview: string;
  };
  debateStats: {
    agentsRun: number;
    agentsApplicable: number;
    totalConflicts: number;
    agreements: number;
    contradictions: number;
    roundsCompleted: number;
  };
}

export async function runMultiAgentDebate(
  investigationId: string,
  opts?: {
    apiPath?: "standard" | "agent";
    maxRounds?: number;
    objective?: string;
  }
): Promise<DebateResult> {
  const apiPath = opts?.apiPath || "standard";
  const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
  const r = await fetch(`${basePath}/${investigationId}/debate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      maxRounds: opts?.maxRounds,
      objective: opts?.objective,
    }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || `Debate failed (${r.status})`);
  }
  return r.json();
}

// =====================
// Investigation Playbooks API (Feature 24)
// =====================

export type PlaybookType =
  | "corporate_due_diligence" | "executive_background" | "threat_actor_profiling"
  | "infrastructure_recon" | "brand_protection" | "vendor_risk" | "supply_chain"
  | "incident_response" | "ma_due_diligence" | "fraud_investigation";

export interface PlaybookSummary {
  type: PlaybookType;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  applicableInputTypes: string[];
  expectedCertainty: string;
  typicalQuestions: string[];
  collectionRationale: string;
  scoringRationale: string;
  reportingRationale: string;
  workflowRationale: string;
}

export interface PlaybookConfig {
  prioritizedSources: string[];
  deferredSources: string[];
  skippedSources: string[];
  focusEntityTypes: string[];
  discoveryPaths: string[];
  rationale: string;
}

export interface PlaybookScoring {
  recencyWeight: number;
  credibilityWeight: number;
  corroborationWeight: number;
  technicalRelevanceWeight: number;
  reputationalImpactWeight: number;
  anomalyWeight: number;
  confirmedThreshold: number;
  probableThreshold: number;
  riskLenses: string[];
  rationale: string;
}

export interface PlaybookReporting {
  templateType: string;
  summaryStyle: string;
  keySections: string[];
  riskFlags: string[];
  includeOwnershipStructure: boolean;
  includeTimeline: boolean;
  includeAttribution: boolean;
  includeConfidenceExplanations: boolean;
  rationale: string;
}

export interface PlaybookWorkflow {
  style: string;
  stepSequence: string[];
  escalationRules: string[];
  reviewCheckpoints: string[];
  stoppingConditions: string[];
  maxDepth: number;
  continuousMonitoring: boolean;
  rationale: string;
}

export interface PlaybookPrioritization {
  utilityWeight: number;
  confidenceWeight: number;
  riskRelevanceWeight: number;
  downstreamWeight: number;
  pivotThreshold: number;
  favorBreadth: boolean;
  rationale: string;
}

export interface PlaybookDefinition {
  type: PlaybookType;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  applicableInputTypes: string[];
  collection: PlaybookConfig;
  prioritization: PlaybookPrioritization;
  scoring: PlaybookScoring;
  reporting: PlaybookReporting;
  workflow: PlaybookWorkflow;
  typicalQuestions: string[];
  failureModes: string[];
  expectedCertainty: string;
}

export interface PlaybookDetailResponse {
  investigation_id: string;
  target: string;
  input_type: string;
  playbook_type: PlaybookType;
  playbook: PlaybookDefinition;
  is_default: boolean;
}

export async function fetchPlaybooks(inputType?: string): Promise<{
  playbooks: PlaybookSummary[];
  byCategory: Record<string, { type: PlaybookType; name: string; shortName: string; color: string; icon: string }[]>;
  recommended: PlaybookType | null;
  total: number;
}> {
  const url = inputType ? `/api/playbooks?input_type=${inputType}` : "/api/playbooks";
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Playbooks fetch failed (${r.status})`);
  return r.json();
}

export async function fetchPlaybookDetail(investigationId: string): Promise<PlaybookDetailResponse> {
  const r = await fetch(`/api/investigate/${investigationId}/playbook`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Playbook detail failed (${r.status})`);
  return r.json();
}

// =====================
// Provenance API (Feature 25)
// =====================

export interface ProvenanceEvent {
  id: string;
  investigationId: string;
  evidenceId: string;
  parentEventId?: string;
  eventType: string;
  eventTime: string;
  collectorName: string;
  collectionMethod: string;
  executionContext: Record<string, string>;
  collectorVersion: string;
  toolName: string;
  toolVersion: string;
  toolConfig: Record<string, unknown>;
  toolMode: string;
  toolLimitations: string;
  collectedAt: string;
  sourceObservedAt?: string;
  ingestedAt: string;
  normalizedAt?: string;
  scoredAt?: string;
  queryString: string;
  queryParams: Record<string, unknown>;
  investigationContext: string;
  queryNormalized: string;
  sourceUrl: string;
  sourceUrls: string[];
  sourceType: string;
  canonicalization: string;
  rawPayload: string;
  rawHash: string;
  rawSize: number;
  rawTruncated: boolean;
  rawOmissionReason: string;
  normalizedData: Record<string, unknown>;
  transformationSteps: string[];
  fieldMappings: Record<string, string>;
  normalizationVersion: string;
  confidence: number;
  confidenceRationale: string;
  rawConfidence: number;
  normalizedConfidence: number;
  confidencePropagation: Record<string, unknown>;
  derivedEntities: string[];
  derivedRelationships: string[];
  corroboratingEvidence: string[];
  contradictingEvidence: string[];
  actorId: string;
  actorType: string;
  accessContext: Record<string, unknown>;
  processingStatus: string;
  retentionPolicy: string;
  integrityHash: string;
  retryCount: number;
  errorState: string;
  latencyMs: number;
  pipelineStage: string;
  createdAt: string;
}

export interface ProvenanceStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByCollector: Record<string, number>;
  eventsByTool: Record<string, number>;
  uniqueEvidenceIds: number;
  uniqueSourceUrls: number;
  avgConfidence: number;
  lowConfidenceCount: number;
  highConfidenceCount: number;
  errorCount: number;
  truncatedRawCount: number;
  timeline: { timestamp: string; eventType: string; count: number }[];
}

export interface ProvenanceReport {
  investigationId: string;
  totalEvents: number;
  uniqueEvidenceIds: number;
  stats: ProvenanceStats;
  recentEvents: ProvenanceEvent[];
  evidenceChains: { evidenceId: string; eventCount: number; latestEventType: string; latestConfidence: number }[];
  generatedAt: string;
}

export interface ProvenanceChain {
  evidenceId: string;
  events: ProvenanceEvent[];
  totalEvents: number;
  collectionEvents: number;
  normalizationEvents: number;
  scoringEvents: number;
  synthesisEvents: number;
  reportingEvents: number;
  earliestEvent: string;
  latestEvent: string;
  sourceChain: { sourceUrl: string; sourceType: string; collectedAt: string; collector: string }[];
  confidenceHistory: { timestamp: string; confidence: number; rationale: string; eventType: string }[];
  derivedFrom: string[];
  derivedInto: string[];
}

export async function fetchProvenanceReport(investigationId: string): Promise<ProvenanceReport> {
  const r = await fetch(`/api/provenance/${investigationId}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Provenance report failed (${r.status})`);
  return r.json();
}

export async function fetchProvenanceChain(evidenceId: string): Promise<ProvenanceChain> {
  const r = await fetch(`/api/provenance/trace/${encodeURIComponent(evidenceId)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Provenance chain failed (${r.status})`);
  return r.json();
}

// =====================
// Visual Intelligence Dashboard API (Feature 28)
// =====================

export interface DashboardEntity {
  id: string; label: string; type: string; confidence: number; tier: number;
  source: string; sourceLabel: string; sourceUrl: string; weight: number;
  isObserved: boolean; isInferred: boolean; evidenceCount: number;
  firstSeen: string; lastSeen: string; attributes: Record<string, string>; cluster?: string;
}
export interface DashboardRelationship {
  id: string; from: string; to: string; fromLabel: string; toLabel: string;
  type: string; label: string; confidence: number; tier: number;
  source: string; sourceLabel: string; sourceUrl: string;
  isObserved: boolean; isInferred: boolean; weight: number; timestamp: string;
}
export interface DashboardTimelineEvent {
  id: string; timestamp: string; date: string; event: string;
  source: string; sourceLabel: string; sourceUrl: string; confidence: number;
  category: string; entityId?: string; evidenceId?: string;
}
export interface DashboardGeopoint {
  id: string; label: string; country?: string; lat?: number; lon?: number;
  weight: number; confidence: number; note?: string; source: string; sourceLabel: string;
  isApproximate: boolean; entityId?: string;
}
export interface DashboardSourceCoverage {
  sourceKey: string; sourceLabel: string; tier: number; status: string;
  findingCount: number; latencyMs?: number; error?: string; lastCollected: string; category: string;
}
export interface DashboardConfidenceCell {
  rowId: string; rowLabel: string; rowType: string; colId: string; colLabel: string;
  confidence: number; evidenceCount: number; hasContradiction: boolean;
}
export interface DashboardProgress {
  overallPercent: number; currentStep: number; totalSteps: number; stepName: string;
  steps: { id: string; label: string; status: string; detail?: string }[];
  evidenceCollected: number; entitiesResolved: number; relationshipsFound: number;
  contradictionsDetected: number; contradictionsResolved: number; coveragePercent: number;
  gapsRemaining: number; isComplete: boolean; isStalled: boolean;
}
export interface DashboardCluster {
  id: string; label: string; entityIds: string[]; entityCount: number;
  dominantType: string; avgConfidence: number; evidenceDensity: number; rationale: string;
}
export interface DashboardSankeyLink {
  source: string; target: string; value: number; sourceType: string; targetType: string;
}
export interface DashboardInfrastructureNode {
  id: string; label: string; type: string; parent?: string; children: string[];
  confidence: number; isExposed: boolean; source: string; metadata: Record<string, string>;
}
export interface DashboardData {
  investigationId: string; target: string; inputType: string; generatedAt: string;
  entities: DashboardEntity[]; relationships: DashboardRelationship[];
  timelineEvents: DashboardTimelineEvent[]; geopoints: DashboardGeopoint[];
  sourceCoverage: DashboardSourceCoverage[]; confidenceMatrix: DashboardConfidenceCell[];
  progress: DashboardProgress; clusters: DashboardCluster[]; sankeyLinks: DashboardSankeyLink[];
  infrastructureNodes: DashboardInfrastructureNode[];
  stats: {
    totalEntities: number; totalRelationships: number; totalTimelineEvents: number;
    totalGeopoints: number; totalSources: number; successfulSources: number;
    avgConfidence: number; highConfidenceEntities: number; lowConfidenceEntities: number;
    observedEntities: number; inferredEntities: number; observedRelationships: number;
    inferredRelationships: number; contradictionsCount: number;
  };
}

export async function fetchDashboard(
  investigationId: string,
  apiPath: "standard" | "agent" = "standard"
): Promise<DashboardData> {
  const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
  const r = await fetch(`${basePath}/${investigationId}/dashboard`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Dashboard fetch failed (${r.status})`);
  const data = await r.json();
  return data.dashboard;
}

// =====================
// Social Media Intelligence API
// =====================

export type SocialPlatform = string;

export interface SocialProfile {
  platform: string; platformLabel: string; username: string; displayName?: string;
  bio?: string; profileUrl: string; avatarUrl?: string; verified?: boolean;
  followerCount?: number; followingCount?: number; postCount?: number;
  accountCreated?: string; location?: string; website?: string;
  confidence: number; authenticityScore: number; trustScore: number;
  freshnessScore: number; influenceScore: number; relevanceScore: number;
}

export interface SocialPost {
  platform: string; platformLabel: string; author: string; authorUrl?: string;
  content: string; postUrl: string; timestamp: string;
  likes?: number; comments?: number; shares?: number;
  mediaType?: string; mediaUrls?: string[]; hashtags?: string[];
  mentions?: string[]; language?: string;
  confidence: number; authenticityScore: number; relevanceScore: number;
  engagementScore: number; viralityScore: number;
}

export interface SocialEntity {
  id: string; name: string; type: string; platforms: string[];
  profiles: SocialProfile[]; aliases: string[]; description?: string;
  crossPlatformConfidence: number; relationshipCount: number;
}

export interface SocialCommunity {
  platform: string; platformLabel: string; name: string; url: string;
  memberCount?: number; description?: string; relevance: number;
}

export interface SocialSentiment {
  overall: string; positiveRatio: number; negativeRatio: number; neutralRatio: number;
  controversyScore: number; polarizationScore: number; topEmotions: string[];
}

export interface SocialTopic {
  name: string; mentionCount: number; trend: string;
  sentiment: string; relatedTopics: string[];
}

export interface SocialIntelligenceReport {
  investigationId: string; target: string; inputType: string; generatedAt: string;
  profiles: SocialProfile[]; posts: SocialPost[]; entities: SocialEntity[];
  relationships: { fromEntity: string; toEntity: string; type: string; platform: string; evidence: string; confidence: number }[];
  communities: SocialCommunity[]; topics: SocialTopic[]; sentiment: SocialSentiment;
  conversationGraph: { nodes: { id: string; label: string; type: string }[]; edges: { from: string; to: string; label: string }[] };
  influencers: { username: string; platform: string; influenceScore: number; profileUrl: string }[];
  mediaItems: { url: string; platform: string; type: string; caption?: string }[];
  summary: string;
  keyFindings: { finding: string; source: string; confidence: number }[];
  confidence: number;
  platformCoverage: { platform: string; status: string; findingCount: number }[];
  totalFindings: number; durationMs: number;
}

export async function fetchSocialIntelligence(
  investigationId: string,
  apiPath: "standard" | "agent" = "standard"
): Promise<SocialIntelligenceReport> {
  const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
  const r = await fetch(`${basePath}/${investigationId}/social`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Social intelligence fetch failed (${r.status})`);
  const data = await r.json();
  return data.report;
}
