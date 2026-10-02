// Temporal Intelligence Engine — domain models and timeline generator.
// Generates chronological timelines from collected evidence and tracks historical evolution.
//
// Features:
// 1. Date extraction from finding text (ISO, natural language, timestamps)
// 2. Event classification (registration, expiration, change, detection, publication)
// 3. Chronologically ordered timeline construction
// 4. Temporal clustering (groups events into time periods)
// 5. Evolution phase identification (distinct phases in entity history)
// 6. Historical evolution tracking

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Event Types
// =====================

/** The type of temporal event. */
export type EventType =
  | "registration"     // Domain/entity registered
  | "expiration"       // Domain/entity expires
  | "modification"     // Record modified/updated
  | "transfer"         // Domain transferred
  | "detection"        // Entity detected/listed by a source
  | "publication"      // News article or document published
  | "archival"         // Content archived
  | "certificate"      // Certificate issued
  | "last_seen"        // Last seen/active
  | "first_seen"       // First seen/active
  | "unknown";         // Unclassified dated event

/** The category of a temporal event for grouping. */
export type EventCategory =
  | "lifecycle"     // Registration, expiration, transfer
  | "infrastructure" // Certificate, DNS changes
  | "detection"     // Threat intel detections
  | "media"         // News, publications
  | "archive"       // Archived content
  | "other";

// =====================
// Timeline Event
// =====================

/** A single event on the timeline. */
export interface TimelineEvent {
  /** Unique ID. */
  id: string;
  /** ISO date string (or "unknown" if no date extracted). */
  date: string;
  /** Unix timestamp for sorting (0 if unknown). */
  timestamp: number;
  /** Event type. */
  type: EventType;
  /** Event category. */
  category: EventCategory;
  /** Event description (from finding text). */
  description: string;
  /** Source that reported this event. */
  source: string;
  /** Source label. */
  sourceLabel: string;
  /** Source URL. */
  sourceUrl: string;
  /** Source reliability tier. */
  tier: ReliabilityTier;
  /** Confidence in this event (0-1). */
  confidence: number;
  /** The original finding data. */
  findingText: string;
  /** Whether this date was explicitly stated or inferred. */
  dateInferred: boolean;
}

// =====================
// Temporal Cluster
// =====================

/** A cluster of events in a time period. */
export interface TemporalCluster {
  /** Cluster ID. */
  id: string;
  /** Start date of the cluster. */
  startDate: string;
  /** End date of the cluster. */
  endDate: string;
  /** Number of events in this cluster. */
  eventCount: number;
  /** Events in this cluster. */
  events: TimelineEvent[];
  /** Cluster label (e.g., "March 2024 activity"). */
  label: string;
  /** Dominant event type in this cluster. */
  dominantType: EventType;
  /** Cluster description. */
  description: string;
}

// =====================
// Evolution Phase
// =====================

/** A distinct phase in the entity's historical evolution. */
export interface EvolutionPhase {
  /** Phase ID. */
  id: string;
  /** Phase name (e.g., "Initial Registration", "Infrastructure Expansion"). */
  name: string;
  /** Start date. */
  startDate: string;
  /** End date. */
  endDate: string;
  /** Number of events in this phase. */
  eventCount: number;
  /** Phase description. */
  description: string;
  /** Key events that define this phase. */
  keyEvents: TimelineEvent[];
  /** Phase significance (low/medium/high). */
  significance: "low" | "medium" | "high";
}

// =====================
// Timeline Report
// =====================

/** The complete temporal intelligence report. */
export interface TimelineReport {
  /** All timeline events sorted chronologically. */
  events: TimelineEvent[];
  /** Temporal clusters (grouped by time period). */
  clusters: TemporalCluster[];
  /** Evolution phases. */
  phases: EvolutionPhase[];
  /** Summary statistics. */
  summary: {
    totalEvents: number;
    datedEvents: number;
    undatedEvents: number;
    earliestDate: string | null;
    latestDate: string | null;
    timespanDays: number;
    byType: Record<EventType, number>;
    byCategory: Record<EventCategory, number>;
  };
  /** Overall temporal assessment. */
  assessment: {
    /** Whether the entity has a rich history (many dated events). */
    hasRichHistory: boolean;
    /** Temporal coverage (what percentage of findings have dates). */
    temporalCoverage: number;
    /** Whether recent activity is detected. */
    hasRecentActivity: boolean;
    /** Explanation. */
    explanation: string;
  };
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

export interface TimelineApiResponse {
  investigation_id: string;
  report: TimelineReport;
}

// =====================
// Timeline Generator
// =====================

/**
 * Generate a temporal intelligence report from source results.
 * @param sourceResults All source results from the investigation.
 * @returns The complete timeline report.
 */
export function generateTimeline(sourceResults: SourceResult[]): TimelineReport {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; sourceUrl: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({
        finding: f,
        source: sr.source,
        sourceLabel: sr.source_label,
        sourceUrl: f.source_url,
        tier,
      });
    }
  }

  // Extract events from findings
  const events: TimelineEvent[] = [];
  for (const { finding, source, sourceLabel, sourceUrl, tier } of allFindings) {
    const extractedDates = extractDates(finding.data);
    const eventType = classifyEvent(finding.data);
    const category = categorizeEvent(eventType);

    if (extractedDates.length > 0) {
      for (const date of extractedDates) {
        events.push({
          id: `ev_${events.length + 1}`,
          date: date.iso,
          timestamp: date.timestamp,
          type: eventType,
          category,
          description: finding.data.slice(0, 200),
          source,
          sourceLabel,
          sourceUrl,
          tier,
          confidence: finding.confidence,
          findingText: finding.data,
          dateInferred: date.inferred,
        });
      }
    } else {
      // Undated event — still include if it has temporal keywords
      if (hasTemporalKeywords(finding.data)) {
        events.push({
          id: `ev_${events.length + 1}`,
          date: "unknown",
          timestamp: 0,
          type: eventType,
          category,
          description: finding.data.slice(0, 200),
          source,
          sourceLabel,
          sourceUrl,
          tier,
          confidence: finding.confidence,
          findingText: finding.data,
          dateInferred: true,
        });
      }
    }
  }

  // Sort by timestamp (dated events first, then undated)
  events.sort((a, b) => {
    if (a.timestamp === 0 && b.timestamp === 0) return 0;
    if (a.timestamp === 0) return 1;
    if (b.timestamp === 0) return -1;
    return a.timestamp - b.timestamp;
  });

  // Build clusters
  const clusters = buildClusters(events);

  // Build evolution phases
  const phases = buildEvolutionPhases(events);

  // Build summary
  const datedEvents = events.filter((e) => e.timestamp > 0);
  const undatedEvents = events.filter((e) => e.timestamp === 0);
  const timestamps = datedEvents.map((e) => e.timestamp).sort();
  const earliestDate = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : null;
  const latestDate = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : null;
  const timespanDays = earliestDate && latestDate
    ? Math.round((new Date(latestDate).getTime() - new Date(earliestDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const byType = {} as Record<EventType, number>;
  const byCategory = {} as Record<EventCategory, number>;
  for (const e of events) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    byCategory[e.category] = (byCategory[e.category] || 0) + 1;
  }

  // Assessment
  const temporalCoverage = allFindings.length > 0
    ? Math.round((datedEvents.length / allFindings.length) * 100)
    : 0;
  const hasRichHistory = datedEvents.length >= 5;
  const hasRecentActivity = latestDate
    ? (Date.now() - new Date(latestDate).getTime()) < 30 * 24 * 60 * 60 * 1000 // Within 30 days
    : false;

  const explanation = buildAssessmentExplanation(
    events.length, datedEvents.length, undatedEvents.length,
    earliestDate, latestDate, timespanDays,
    temporalCoverage, hasRichHistory, hasRecentActivity
  );

  return {
    events,
    clusters,
    phases,
    summary: {
      totalEvents: events.length,
      datedEvents: datedEvents.length,
      undatedEvents: undatedEvents.length,
      earliestDate,
      latestDate,
      timespanDays,
      byType,
      byCategory,
    },
    assessment: {
      hasRichHistory,
      temporalCoverage,
      hasRecentActivity,
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
// Date Extraction
// =====================

interface ExtractedDate {
  iso: string;
  timestamp: number;
  inferred: boolean;
}

/** Extract dates from finding text using multiple patterns. */
function extractDates(text: string): ExtractedDate[] {
  const dates: ExtractedDate[] = [];

  // 1. ISO dates: 2024-01-15, 2024-01-15T10:30:00Z
  const isoMatches = text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2}))?Z?\b/g);
  for (const m of isoMatches) {
    const date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] || "00"}:${m[5] || "00"}:${m[6] || "00"}Z`);
    if (!isNaN(date.getTime())) {
      dates.push({ iso: date.toISOString(), timestamp: date.getTime(), inferred: false });
    }
  }

  // 2. Date with keywords: "registered on 2024-01-15", "expires on 2025-12-31", "created 2023-06-01"
  const keywordDateMatches = text.matchAll(/\b(?:registered|expires?|created|updated|modified|transferred|added|first\s+seen|last\s+seen|published|archived|detected|issued)\s+(?:on\s+)?(\d{4})-(\d{2})-(\d{2})\b/gi);
  for (const m of keywordDateMatches) {
    const date = new Date(`${m[1]}-${m[2]}-${m[3]}`);
    if (!isNaN(date.getTime())) {
      dates.push({ iso: date.toISOString(), timestamp: date.getTime(), inferred: false });
    }
  }

  // 3. Natural language dates: "January 15, 2024", "15 Jan 2024", "Jan 15 2024"
  const monthNames = "January|February|March|April|May|June|July|August|September|October|November|December";
  const monthAbbr = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
  const nlPatterns = [
    new RegExp(`\\b(${monthNames})\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "gi"),
    new RegExp(`\\b(\\d{1,2})\\s+(${monthAbbr})\\s+(\\d{4})\\b`, "gi"),
    new RegExp(`\\b(${monthAbbr})\\s+(\\d{1,2})\\s+(\\d{4})\\b`, "gi"),
  ];
  for (const pattern of nlPatterns) {
    const matches = text.matchAll(pattern);
    for (const m of matches) {
      const dateStr = m[0];
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        dates.push({ iso: date.toISOString(), timestamp: date.getTime(), inferred: false });
      }
    }
  }

  // 4. Year-only: "in 2024", "since 2020"
  const yearMatches = text.matchAll(/\b(?:in|since|from|year)\s+(\d{4})\b/gi);
  for (const m of yearMatches) {
    const year = parseInt(m[1]);
    if (year >= 1990 && year <= new Date().getFullYear() + 5) {
      const date = new Date(`${year}-01-01`);
      dates.push({ iso: date.toISOString(), timestamp: date.getTime(), inferred: true });
    }
  }

  // 5. Finding timestamp (as fallback)
  // The finding's timestamp field often contains the collection time

  // Deduplicate by timestamp
  const seen = new Set<number>();
  return dates.filter((d) => {
    if (seen.has(d.timestamp)) return false;
    seen.add(d.timestamp);
    return true;
  });
}

// =====================
// Event Classification
// =====================

/** Classify the type of event based on finding text. */
function classifyEvent(text: string): EventType {
  const lower = text.toLowerCase();
  if (/\b(?:registered|registration|created|domain\s+name\s+created)\b/i.test(text)) return "registration";
  if (/\b(?:expires?|expiration|expiring)\b/i.test(text)) return "expiration";
  if (/\b(?:modified|updated|changed|last\s+changed)\b/i.test(text)) return "modification";
  if (/\b(?:transferred|transfer)\b/i.test(text)) return "transfer";
  if (/\b(?:detected|listed|flagged|identified)\b/i.test(text)) return "detection";
  if (/\b(?:published|posted|released|article)\b/i.test(text)) return "publication";
  if (/\b(?:archived|snapshot|captured|wayback)\b/i.test(text)) return "archival";
  if (/\b(?:certificate|ssl|tls|issued|cert)\b/i.test(text)) return "certificate";
  if (/\b(?:last\s+seen|last\s+active|last\s+updated)\b/i.test(text)) return "last_seen";
  if (/\b(?:first\s+seen|first\s+active|first\s+detected)\b/i.test(text)) return "first_seen";
  return "unknown";
}

/** Categorize an event type into a broader category. */
function categorizeEvent(type: EventType): EventCategory {
  switch (type) {
    case "registration":
    case "expiration":
    case "transfer":
      return "lifecycle";
    case "modification":
    case "certificate":
      return "infrastructure";
    case "detection":
    case "first_seen":
    case "last_seen":
      return "detection";
    case "publication":
      return "media";
    case "archival":
      return "archive";
    default:
      return "other";
  }
}

/** Check if text has temporal keywords (even without a parseable date). */
function hasTemporalKeywords(text: string): boolean {
  return /\b(?:date|time|when|year|month|day|recent|ago|since|until|before|after|history|evolution|timeline|chronolog)\b/i.test(text);
}

// =====================
// Temporal Clustering
// =====================

/** Group events into temporal clusters (events within 7 days of each other). */
function buildClusters(events: TimelineEvent[]): TemporalCluster[] {
  const datedEvents = events.filter((e) => e.timestamp > 0);
  if (datedEvents.length === 0) return [];

  const clusters: TemporalCluster[] = [];
  let currentCluster: TimelineEvent[] = [datedEvents[0]];
  const CLUSTER_GAP_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  for (let i = 1; i < datedEvents.length; i++) {
    const prev = datedEvents[i - 1];
    const curr = datedEvents[i];
    if (curr.timestamp - prev.timestamp <= CLUSTER_GAP_MS) {
      currentCluster.push(curr);
    } else {
      clusters.push(buildClusterFromEvents(currentCluster, clusters.length + 1));
      currentCluster = [curr];
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(buildClusterFromEvents(currentCluster, clusters.length + 1));
  }

  return clusters;
}

function buildClusterFromEvents(events: TimelineEvent[], id: number): TemporalCluster {
  const startDate = new Date(events[0].timestamp).toISOString();
  const endDate = new Date(events[events.length - 1].timestamp).toISOString();

  // Find dominant type
  const typeCounts = {} as Record<EventType, number>;
  for (const e of events) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  }
  const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as EventType || "unknown";

  // Build label
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameDay = start.toDateString() === end.toDateString();
  const label = sameDay
    ? start.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const description = `${events.length} event${events.length > 1 ? "s" : ""} in this period. Dominant activity: ${dominantType.replace(/_/g, " ")}.`;

  return {
    id: `cluster_${id}`,
    startDate,
    endDate,
    eventCount: events.length,
    events,
    label,
    dominantType,
    description,
  };
}

// =====================
// Evolution Phases
// =====================

/** Identify distinct evolution phases from the timeline. */
function buildEvolutionPhases(events: TimelineEvent[]): EvolutionPhase[] {
  const datedEvents = events.filter((e) => e.timestamp > 0);
  if (datedEvents.length === 0) return [];

  const phases: EvolutionPhase[] = [];

  // Phase 1: Initial registration/creation
  const registrationEvents = datedEvents.filter((e) => e.type === "registration" || e.type === "first_seen");
  if (registrationEvents.length > 0) {
    const first = registrationEvents[0];
    phases.push({
      id: "phase_1",
      name: "Initial Registration",
      startDate: first.date,
      endDate: first.date,
      eventCount: registrationEvents.length,
      description: `Entity was first registered or detected. ${registrationEvents.length} event(s) mark the origin.`,
      keyEvents: registrationEvents.slice(0, 3),
      significance: "high",
    });
  }

  // Phase 2: Infrastructure development (certificates, modifications)
  const infraEvents = datedEvents.filter((e) => e.type === "certificate" || e.type === "modification");
  if (infraEvents.length > 0) {
    const first = infraEvents[0];
    const last = infraEvents[infraEvents.length - 1];
    phases.push({
      id: "phase_2",
      name: "Infrastructure Development",
      startDate: first.date,
      endDate: last.date,
      eventCount: infraEvents.length,
      description: `${infraEvents.length} infrastructure-related event(s): certificate issuance, DNS modifications, configuration changes.`,
      keyEvents: infraEvents.slice(0, 3),
      significance: "medium",
    });
  }

  // Phase 3: Detection / threat intel
  const detectionEvents = datedEvents.filter((e) => e.type === "detection" || e.type === "last_seen");
  if (detectionEvents.length > 0) {
    const first = detectionEvents[0];
    const last = detectionEvents[detectionEvents.length - 1];
    phases.push({
      id: "phase_3",
      name: "Detection & Monitoring",
      startDate: first.date,
      endDate: last.date,
      eventCount: detectionEvents.length,
      description: `${detectionEvents.length} detection/monitoring event(s) by threat intelligence sources.`,
      keyEvents: detectionEvents.slice(0, 3),
      significance: detectionEvents.length > 3 ? "high" : "medium",
    });
  }

  // Phase 4: Media coverage
  const mediaEvents = datedEvents.filter((e) => e.type === "publication" || e.type === "archival");
  if (mediaEvents.length > 0) {
    const first = mediaEvents[0];
    const last = mediaEvents[mediaEvents.length - 1];
    phases.push({
      id: "phase_4",
      name: "Media & Archive Activity",
      startDate: first.date,
      endDate: last.date,
      eventCount: mediaEvents.length,
      description: `${mediaEvents.length} media/archive event(s): news publications, content archiving.`,
      keyEvents: mediaEvents.slice(0, 3),
      significance: "low",
    });
  }

  // Phase 5: Recent activity (last 30 days)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentEvents = datedEvents.filter((e) => e.timestamp >= thirtyDaysAgo);
  if (recentEvents.length > 0) {
    const first = recentEvents[0];
    const last = recentEvents[recentEvents.length - 1];
    phases.push({
      id: "phase_5",
      name: "Recent Activity",
      startDate: first.date,
      endDate: last.date,
      eventCount: recentEvents.length,
      description: `${recentEvents.length} event(s) in the last 30 days. Entity is actively maintained or monitored.`,
      keyEvents: recentEvents.slice(0, 3),
      significance: "high",
    });
  }

  return phases;
}

// =====================
// Assessment
// =====================

function buildAssessmentExplanation(
  total: number,
  dated: number,
  undated: number,
  earliest: string | null,
  latest: string | null,
  timespanDays: number,
  coverage: number,
  hasRich: boolean,
  hasRecent: boolean
): string {
  if (total === 0) {
    return "No temporal events detected. Evidence does not contain dated information.";
  }

  const parts: string[] = [];
  parts.push(`${total} temporal event${total > 1 ? "s" : ""} identified (${dated} dated, ${undated} undated)`);

  if (earliest && latest) {
    const earliestStr = new Date(earliest).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    const latestStr = new Date(latest).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    parts.push(`spanning from ${earliestStr} to ${latestStr} (${timespanDays} days)`);
  }

  parts.push(`temporal coverage: ${coverage}% of findings have dates`);

  if (hasRich) {
    parts.push("Entity has a rich historical record");
  } else {
    parts.push("Entity has limited historical data");
  }

  if (hasRecent) {
    parts.push("with recent activity (within 30 days)");
  }

  return parts.join(", ") + ".";
}
