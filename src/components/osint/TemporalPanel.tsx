"use client";

import { useState, useEffect } from "react";
import { Loader2, Clock, Calendar, Activity, Layers, TrendingUp, ChevronDown, ChevronRight } from "lucide-react";

// =====================
// Types
// =====================

interface TimelineEvent {
  id: string;
  date: string;
  timestamp: number;
  type: string;
  category: string;
  description: string;
  source: string;
  sourceLabel: string;
  sourceUrl: string;
  tier: number;
  confidence: number;
  findingText: string;
  dateInferred: boolean;
}

interface TemporalCluster {
  id: string;
  startDate: string;
  endDate: string;
  eventCount: number;
  events: TimelineEvent[];
  label: string;
  dominantType: string;
  description: string;
}

interface EvolutionPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  eventCount: number;
  description: string;
  keyEvents: TimelineEvent[];
  significance: string;
}

interface TimelineReport {
  events: TimelineEvent[];
  clusters: TemporalCluster[];
  phases: EvolutionPhase[];
  summary: {
    totalEvents: number;
    datedEvents: number;
    undatedEvents: number;
    earliestDate: string | null;
    latestDate: string | null;
    timespanDays: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  };
  assessment: {
    hasRichHistory: boolean;
    temporalCoverage: number;
    hasRecentActivity: boolean;
    explanation: string;
  };
  meta: {
    sourcesAnalyzed: number;
    findingsAnalyzed: number;
    generatedAt: string;
  };
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

const TYPE_ICONS: Record<string, string> = {
  registration: "🟢",
  expiration: "🔴",
  modification: "🔧",
  transfer: "🔄",
  detection: "⚠️",
  publication: "📰",
  archival: "📦",
  certificate: "🔐",
  last_seen: "👁️",
  first_seen: "🔍",
  unknown: "📅",
};

const TYPE_COLORS: Record<string, string> = {
  registration: "text-[var(--hack-green)]",
  expiration: "text-[var(--hack-red)]",
  modification: "text-[var(--hack-amber)]",
  transfer: "text-[var(--hack-cyan)]",
  detection: "text-[var(--hack-orange)]",
  publication: "text-[var(--hack-purple)]",
  archival: "text-[var(--hack-gray)]",
  certificate: "text-teal-400",
  last_seen: "text-[var(--hack-cyan)]",
  first_seen: "text-[var(--hack-cyan)]",
  unknown: "text-[var(--hack-gray)]",
};

const CATEGORY_COLORS: Record<string, string> = {
  lifecycle: "var(--hack-green)",
  infrastructure: "var(--hack-cyan)",
  detection: "orange",
  media: "purple",
  archive: "var(--hack-gray)",
  other: "var(--hack-gray)",
};

const SIGNIFICANCE_COLORS: Record<string, string> = {
  high: "text-[var(--hack-red)] border-[var(--hack-red)]/40",
  medium: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40",
  low: "text-[var(--hack-gray)] border-[var(--hack-border)]",
};

function formatDate(iso: string): string {
  if (iso === "unknown") return "Unknown date";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string): string {
  if (iso === "unknown") return "Unknown";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TemporalPanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<TimelineReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"timeline" | "phases">("timeline");

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/timeline`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data.report) {
          setReport(data.report);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load timeline");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]">
          {"» generating temporal intelligence timeline..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">
        {`» Error: ${error}`}
      </p>
    );
  }

  if (!report) {
    return (
      <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">
        {"» No temporal data available."}
      </p>
    );
  }

  const { events, clusters, phases, summary, assessment } = report;

  return (
    <div className="space-y-4">
      {/* Assessment */}
      <div className={`border p-4 ${
        assessment.hasRichHistory
          ? "border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5"
          : "border-[var(--hack-border)] bg-black/30"
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-5 w-5 text-[var(--hack-cyan)]" />
          <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">
            Temporal Assessment
          </span>
          {assessment.hasRecentActivity && (
            <span className="font-mono text-[9px] border border-[var(--hack-green)]/40 text-[var(--hack-green)] px-1.5 py-0.5 bg-[var(--hack-green)]/10">
              RECENT ACTIVITY
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
        {/* Temporal coverage bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Temporal Coverage</span>
            <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{assessment.temporalCoverage}%</span>
          </div>
          <div className="h-1.5 bg-black/40 border border-[var(--hack-border)]">
            <div className="h-full bg-[var(--hack-cyan)]" style={{ width: `${assessment.temporalCoverage}%` }} />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard icon={Calendar} label="Total Events" value={summary.totalEvents} color="cyan" />
        <StatCard icon={Clock} label="Dated" value={summary.datedEvents} color="green" />
        <StatCard icon={Activity} label="Clusters" value={clusters.length} color="amber" />
        <StatCard icon={Layers} label="Phases" value={phases.length} color="cyan" />
        <StatCard icon={TrendingUp} label="Timespan" value={`${summary.timespanDays}d`} color="green" />
      </div>

      {/* Date range */}
      {summary.earliestDate && summary.latestDate && (
        <div className="border border-[var(--hack-border)] bg-black/20 px-3 py-2 flex items-center justify-between">
          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Earliest: </span>
            <span className="font-mono text-[10px] text-[var(--hack-green)]">{formatDate(summary.earliestDate)}</span>
          </div>
          <div className="flex-1 mx-3 h-px bg-gradient-to-r from-[var(--hack-green)]/40 via-[var(--hack-cyan)]/40 to-[var(--hack-red)]/40" />
          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Latest: </span>
            <span className="font-mono text-[10px] text-[var(--hack-red)]">{formatDate(summary.latestDate)}</span>
          </div>
        </div>
      )}

      {/* View mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("timeline")}
          className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
            viewMode === "timeline"
              ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]"
              : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-cyan)]"
          }`}
        >
          <Clock className="h-3 w-3" />
          Timeline
        </button>
        <button
          onClick={() => setViewMode("phases")}
          className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
            viewMode === "phases"
              ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]"
              : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-cyan)]"
          }`}
        >
          <Layers className="h-3 w-3" />
          Evolution Phases
        </button>
      </div>

      {/* Timeline View */}
      {viewMode === "timeline" && (
        <div>
          {events.length === 0 ? (
            <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
              <Clock className="h-8 w-8 text-[var(--hack-gray)]/40 mx-auto mb-2" />
              <p className="font-mono text-xs text-[var(--hack-gray)]">
                {"» No temporal events detected in collected evidence."}
              </p>
            </div>
          ) : (
            <div className="border border-[var(--hack-border)] bg-black/20 max-h-[600px] overflow-y-auto">
              {/* Vertical timeline */}
              <div className="relative pl-6">
                {/* Timeline line */}
                <div className="absolute left-3 top-0 bottom-0 w-px bg-[var(--hack-cyan)]/20" />

                {events.map((event) => {
                  const isExpanded = expandedEvents.has(event.id);
                  const typeColor = TYPE_COLORS[event.type] || "text-[var(--hack-gray)]";
                  const categoryColor = CATEGORY_COLORS[event.category] || "var(--hack-gray)";
                  return (
                    <div key={event.id} className="relative pb-3">
                      {/* Timeline dot */}
                      <div
                        className="absolute -left-3 top-2 h-2.5 w-2.5 rounded-full border-2"
                        style={{ borderColor: categoryColor, backgroundColor: "var(--hack-bg)" }}
                      />

                      {/* Event card */}
                      <button
                        onClick={() => setExpandedEvents((prev) => {
                          const next = new Set(prev);
                          if (next.has(event.id)) next.delete(event.id);
                          else next.add(event.id);
                          return next;
                        })}
                        className="w-full text-left border border-[var(--hack-border)] bg-black/30 px-3 py-1.5 hover:bg-[var(--hack-cyan)]/5 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] shrink-0">{TYPE_ICONS[event.type] || "📅"}</span>
                          <span className={`font-mono text-[10px] font-bold shrink-0 ${typeColor}`}>
                            {formatDateTime(event.date)}
                          </span>
                          <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">
                            [{event.type}]
                          </span>
                          <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate flex-1">
                            {event.description.slice(0, 80)}...
                          </span>
                          {event.dateInferred && (
                            <span className="font-mono text-[8px] text-[var(--hack-amber)]/60 shrink-0">inferred</span>
                          )}
                          {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="mt-1 ml-2 border-l-2 border-[var(--hack-cyan)]/20 pl-3 space-y-1">
                          <p className="text-xs text-[var(--hack-gray)]">{event.description}</p>
                          <div className="flex flex-wrap gap-3 font-mono text-[9px] text-[var(--hack-gray)]/60">
                            <span>Source: <span className="text-[var(--hack-cyan)]">{event.sourceLabel}</span></span>
                            <span>Tier: <span className="text-[var(--hack-green)]">T{event.tier}</span></span>
                            <span>Confidence: <span className="text-[var(--hack-green)]">{(event.confidence * 100).toFixed(0)}%</span></span>
                            <span>Category: <span style={{ color: categoryColor }}>{event.category}</span></span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evolution Phases View */}
      {viewMode === "phases" && (
        <div className="space-y-2">
          {phases.length === 0 ? (
            <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
              <Layers className="h-8 w-8 text-[var(--hack-gray)]/40 mx-auto mb-2" />
              <p className="font-mono text-xs text-[var(--hack-gray)]">
                {"» No evolution phases identified — insufficient dated evidence."}
              </p>
            </div>
          ) : (
            phases.map((phase, idx) => (
              <div key={phase.id} className={`border-l-2 border border-[var(--hack-border)] bg-black/20 ${
                phase.significance === "high" ? "border-l-[var(--hack-red)]" :
                phase.significance === "medium" ? "border-l-[var(--hack-amber)]" :
                "border-l-[var(--hack-border)]"
              }`}>
                {/* Phase header */}
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 shrink-0">
                      Phase {idx + 1}
                    </span>
                    <span className="font-mono text-xs font-bold text-[var(--hack-cyan)]">
                      {phase.name}
                    </span>
                    <span className={`font-mono text-[8px] px-1.5 py-0.5 border shrink-0 ${SIGNIFICANCE_COLORS[phase.significance] || ""}`}>
                      {phase.significance.toUpperCase()}
                    </span>
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 ml-auto shrink-0">
                      {phase.eventCount} event{phase.eventCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="font-mono text-[9px] text-[var(--hack-gray)]/60 mt-0.5">
                    {formatDate(phase.startDate)} → {formatDate(phase.endDate)}
                  </div>
                  <p className="text-xs text-[var(--hack-gray)] mt-1">{phase.description}</p>
                </div>

                {/* Key events */}
                {phase.keyEvents.length > 0 && (
                  <div className="border-t border-[var(--hack-border)]/30 px-3 py-1.5">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]/50">
                      Key Events:
                    </span>
                    <div className="space-y-0.5 mt-0.5">
                      {phase.keyEvents.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="text-[var(--hack-gray)]/60 shrink-0">{formatDateTime(e.date)}</span>
                          <span className={TYPE_COLORS[e.type] || "text-[var(--hack-gray)]"}>{TYPE_ICONS[e.type]}</span>
                          <span className="text-[var(--hack-gray)] truncate">{e.description.slice(0, 70)}...</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Type Distribution */}
      {Object.keys(summary.byType).length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
              {"» Event Type Distribution"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summary.byType).map(([type, count]) => (
              <span key={type} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1.5 py-0.5 text-[var(--hack-gray)]">
                {TYPE_ICONS[type] || "•"} {type.replace(/_/g, " ")}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =====================
// Sub-components
// =====================

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const colorClass =
    color === "green" ? "text-[var(--hack-green)]" :
    color === "cyan" ? "text-[var(--hack-cyan)]" :
    color === "amber" ? "text-[var(--hack-amber)]" :
    "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <Icon className={`h-3 w-3 mx-auto ${colorClass} mb-0.5`} />
      <div className={`font-mono text-sm font-bold ${colorClass}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}
