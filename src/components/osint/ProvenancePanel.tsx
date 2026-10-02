"use client";

import { useState, useEffect } from "react";
import {
  Loader2, ChevronDown, ChevronRight, Database, Clock, Server, Link2,
  FileText, ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Search,
  GitBranch, Lock, Hash, Zap, Download, Filter, Eye, Layers, Activity,
} from "lucide-react";
import {
  fetchProvenanceReport, fetchProvenanceChain,
  type ProvenanceReport, type ProvenanceEvent, type ProvenanceChain,
} from "@/lib/osint/client";

interface Props {
  investigationId: string;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  collection: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  validation: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  normalization: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  deduplication: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  entity_resolution: "text-[var(--hack-purple)] border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10",
  correlation: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  scoring: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  synthesis: "text-[var(--hack-purple)] border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10",
  reporting: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  enrichment: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  re_scoring: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  correction: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  historical_comparison: "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20",
};

const EVENT_TYPE_ICONS: Record<string, React.ElementType> = {
  collection: Database,
  normalization: FileText,
  scoring: Activity,
  synthesis: GitBranch,
  reporting: FileText,
  enrichment: Zap,
  entity_resolution: Layers,
  correlation: Link2,
};

export function ProvenancePanel({ investigationId }: Props) {
  const [report, setReport] = useState<ProvenanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "events" | "chains">("overview");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [chain, setChain] = useState<ProvenanceChain | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [filterCollector, setFilterCollector] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const r = await fetchProvenanceReport(investigationId);
        if (active) { setReport(r); setLoading(false); }
      } catch (e) {
        if (active) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [investigationId]);

  const toggleEvent = (id: string) => setExpandedEvents((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openChain = async (evidenceId: string) => {
    setChainLoading(true);
    setChain(null);
    try {
      const c = await fetchProvenanceChain(evidenceId);
      setChain(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chain failed");
    } finally {
      setChainLoading(false);
    }
  };

  const exportProvenance = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `provenance-${investigationId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» loading provenance chain..."}</p>
    </div>
  );
  if (error && !report) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No provenance data."}</p>;

  const filteredEvents = report.recentEvents.filter((e) => {
    if (filterType && e.eventType !== filterType) return false;
    if (filterCollector && !e.collectorName.includes(filterCollector)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Evidence Chain & Provenance</span>
            <span className="font-mono text-[9px] text-[var(--hack-green)] border border-[var(--hack-green)]/30 px-1.5 py-0.5">IMMUTABLE</span>
          </div>
          <button
            onClick={exportProvenance}
            className="flex items-center gap-1.5 border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 px-3 py-1 font-mono text-[10px] text-[var(--hack-cyan)] uppercase hover:bg-[var(--hack-cyan)]/20"
          >
            <Download className="h-3 w-3" /> Export Audit Trail
          </button>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">
          Complete, immutable, and auditable provenance for every finding, relationship, inference, and report.
          Every piece of intelligence is traceable back to its origin with full audit metadata.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        <Stat label="Total Events" value={report.totalEvents} icon={Activity} color="cyan" />
        <Stat label="Evidence IDs" value={report.uniqueEvidenceIds} icon={Database} color="green" />
        <Stat label="Avg Conf" value={`${(report.stats.avgConfidence * 100).toFixed(0)}%`} icon={ShieldCheck} color="green" />
        <Stat label="Low Conf" value={report.stats.lowConfidenceCount} icon={AlertTriangle} color="amber" />
        <Stat label="High Conf" value={report.stats.highConfidenceCount} icon={CheckCircle2} color="green" />
        <Stat label="Errors" value={report.stats.errorCount} icon={XCircle} color="red" />
        <Stat label="Truncated" value={report.stats.truncatedRawCount} icon={FileText} color="amber" />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 flex-wrap">
        <ViewTab active={viewMode === "overview"} onClick={() => setViewMode("overview")} icon={Activity} label="Overview" />
        <ViewTab active={viewMode === "events"} onClick={() => setViewMode("events")} icon={Database} label={`Events (${report.recentEvents.length})`} />
        <ViewTab active={viewMode === "chains"} onClick={() => setViewMode("chains")} icon={GitBranch} label={`Evidence Chains (${report.evidenceChains.length})`} />
      </div>

      {/* OVERVIEW VIEW */}
      {viewMode === "overview" && (
        <div className="space-y-4">
          {/* Events by type */}
          <div>
            <SectionHeader icon={Activity} title="Events by Type" color="cyan" />
            <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1.5">
              {Object.entries(report.stats.eventsByType).length === 0 ? (
                <p className="font-mono text-[10px] text-[var(--hack-gray)]/60 text-center py-2">No events</p>
              ) : (
                Object.entries(report.stats.eventsByType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => {
                    const max = Math.max(...Object.values(report.stats.eventsByType));
                    const Icon = EVENT_TYPE_ICONS[type] || Activity;
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <Icon className="h-3 w-3 shrink-0 text-[var(--hack-cyan)]" />
                        <span className="font-mono text-[10px] text-[var(--hack-gray)] w-32 shrink-0 capitalize">{type.replace(/_/g, " ")}</span>
                        <div className="flex-1 h-2 bg-black/40">
                          <div className="h-full bg-[var(--hack-cyan)]/40" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="font-mono text-[10px] text-[var(--hack-cyan)] w-8 text-right">{count}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Top collectors */}
          <div>
            <SectionHeader icon={Server} title="Top Collectors" color="green" />
            <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1">
              {Object.entries(report.stats.eventsByCollector).length === 0 ? (
                <p className="font-mono text-[10px] text-[var(--hack-gray)]/60 text-center py-2">No collectors</p>
              ) : (
                Object.entries(report.stats.eventsByCollector)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([collector, count]) => (
                    <div key={collector} className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-[var(--hack-green)] truncate">{collector}</span>
                      <span className="text-[var(--hack-gray)]/60 ml-2">{count} events</span>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Top tools */}
          <div>
            <SectionHeader icon={Zap} title="Top Tools" color="cyan" />
            <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1">
              {Object.entries(report.stats.eventsByTool).length === 0 ? (
                <p className="font-mono text-[10px] text-[var(--hack-gray)]/60 text-center py-2">No tools</p>
              ) : (
                Object.entries(report.stats.eventsByTool)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([tool, count]) => (
                    <div key={tool} className="flex items-center justify-between font-mono text-[10px]">
                      <span className="text-[var(--hack-cyan)] truncate">{tool}</span>
                      <span className="text-[var(--hack-gray)]/60 ml-2">{count} events</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* EVENTS VIEW */}
      {viewMode === "events" && (
        <div className="space-y-2">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap border border-[var(--hack-border)] bg-black/20 p-2">
            <Filter className="h-3 w-3 text-[var(--hack-gray)]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-black/40 border border-[var(--hack-border)] font-mono text-[10px] text-[var(--hack-cyan)] px-2 py-0.5"
            >
              <option value="">All Types</option>
              {Object.keys(report.stats.eventsByType).map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="filter collector..."
              value={filterCollector}
              onChange={(e) => setFilterCollector(e.target.value)}
              className="bg-black/40 border border-[var(--hack-border)] font-mono text-[10px] text-[var(--hack-green)] px-2 py-0.5 placeholder:text-[var(--hack-gray)]/40"
            />
            <span className="font-mono text-[9px] text-[var(--hack-gray)]/50 ml-auto">
              {filteredEvents.length} of {report.recentEvents.length} shown
            </span>
          </div>

          {/* Event list */}
          <div className="space-y-1 max-h-[600px] overflow-y-auto custom-scroll">
            {filteredEvents.length === 0 ? (
              <div className="border border-[var(--hack-border)] bg-black/20 p-6 text-center">
                <p className="font-mono text-xs text-[var(--hack-gray)]">No events match the filter.</p>
              </div>
            ) : (
              filteredEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  expanded={expandedEvents.has(event.id)}
                  onToggle={() => toggleEvent(event.id)}
                  onTrace={() => openChain(event.evidenceId)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* CHAINS VIEW */}
      {viewMode === "chains" && (
        <div className="space-y-2">
          <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scroll">
            {report.evidenceChains.length === 0 ? (
              <div className="border border-[var(--hack-border)] bg-black/20 p-6 text-center">
                <p className="font-mono text-xs text-[var(--hack-gray)]">No evidence chains found.</p>
              </div>
            ) : (
              report.evidenceChains.map((ec) => (
                <div key={ec.evidenceId} className="border border-[var(--hack-border)] bg-black/20 p-2 flex items-center gap-2">
                  <GitBranch className="h-3 w-3 text-[var(--hack-cyan)] shrink-0" />
                  <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">{ec.evidenceId}</span>
                  <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">{ec.eventCount} events</span>
                  <span className="font-mono text-[8px] border border-[var(--hack-border)] px-1 text-[var(--hack-cyan)] shrink-0">{ec.latestEventType.replace(/_/g, " ")}</span>
                  <span className="font-mono text-[9px] text-[var(--hack-green)] shrink-0">{(ec.latestConfidence * 100).toFixed(0)}%</span>
                  <button
                    onClick={() => openChain(ec.evidenceId)}
                    className="font-mono text-[9px] text-[var(--hack-cyan)] hover:underline shrink-0"
                  >
                    trace →
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Chain detail */}
          {chainLoading && (
            <div className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 p-3 text-center">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--hack-cyan)] mx-auto" />
              <p className="font-mono text-[10px] text-[var(--hack-cyan)] mt-1">Loading evidence chain...</p>
            </div>
          )}
          {chain && <ChainDetail chain={chain} />}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Event Card
// ============================================================================

function EventCard({
  event, expanded, onToggle, onTrace,
}: {
  event: ProvenanceEvent;
  expanded: boolean;
  onToggle: () => void;
  onTrace: () => void;
}) {
  const Icon = EVENT_TYPE_ICONS[event.eventType] || Activity;
  const colorClass = EVENT_TYPE_COLORS[event.eventType] || EVENT_TYPE_COLORS.collection;

  return (
    <div className={`border ${colorClass}`}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-2 hover:bg-white/5">
        {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono text-[9px] uppercase font-bold shrink-0">{event.eventType.replace(/_/g, " ")}</span>
        <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate flex-1">{event.evidenceId}</span>
        <span className="font-mono text-[9px] text-[var(--hack-cyan)] shrink-0">{(event.confidence * 100).toFixed(0)}%</span>
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/50 shrink-0">{formatTime(event.eventTime)}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Collector + Tool */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Collector:</span>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]/80">{event.collectorName}</p>
              <p className="font-mono text-[9px] text-[var(--hack-gray)]/50">method: {event.collectionMethod} · v{event.collectorVersion}</p>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Tool:</span>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]/80">{event.toolName}</p>
              <p className="font-mono text-[9px] text-[var(--hack-gray)]/50">v{event.toolVersion} · {event.toolMode}</p>
            </div>
          </div>

          {/* Source URL */}
          {event.sourceUrl && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Source URL:</span>
              <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px] text-[var(--hack-cyan)] hover:underline block truncate">
                {event.sourceUrl}
              </a>
              <span className="font-mono text-[8px] text-[var(--hack-gray)]/40">type: {event.sourceType}</span>
            </div>
          )}

          {/* Query */}
          {event.queryString && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Query:</span>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 font-mono">{event.queryString}</p>
            </div>
          )}

          {/* Raw response */}
          {event.rawPayload && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60 flex items-center gap-1">
                <Hash className="h-2.5 w-2.5" /> Raw Response ({event.rawSize} bytes {event.rawTruncated ? "· truncated" : ""}):
              </span>
              <div className="border border-[var(--hack-amber)]/20 bg-[var(--hack-amber)]/5 p-1.5 mt-0.5">
                <p className="font-mono text-[9px] text-[var(--hack-gray)]/70 line-clamp-3 break-all">{event.rawPayload}</p>
                <p className="font-mono text-[8px] text-[var(--hack-amber)]/50 mt-1">SHA-256: {event.rawHash}</p>
              </div>
            </div>
          )}

          {/* Normalized data */}
          {Object.keys(event.normalizedData).length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Normalized Data:</span>
              <pre className="font-mono text-[9px] text-[var(--hack-gray)]/70 mt-0.5 border border-[var(--hack-border)] bg-black/40 p-1.5 max-h-32 overflow-y-auto custom-scroll">
                {JSON.stringify(event.normalizedData, null, 2)}
              </pre>
            </div>
          )}

          {/* Transformation steps */}
          {event.transformationSteps.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Transformation Steps:</span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {event.transformationSteps.map((s, i) => (
                  <span key={i} className="font-mono text-[8px] border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 px-1 text-[var(--hack-green)]">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Confidence */}
          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Confidence: {(event.confidence * 100).toFixed(0)}%</span>
            <p className="font-mono text-[10px] text-[var(--hack-gray)]/70 mt-0.5">{event.confidenceRationale}</p>
            <div className="flex items-center gap-3 mt-1 font-mono text-[8px] text-[var(--hack-gray)]/50">
              <span>raw: {(event.rawConfidence * 100).toFixed(0)}%</span>
              <span>normalized: {(event.normalizedConfidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* Audit metadata */}
          <div className="flex items-center gap-3 font-mono text-[9px] text-[var(--hack-gray)]/50 border-t border-current/20 pt-1.5 flex-wrap">
            <span className="flex items-center gap-1"><Lock className="h-2.5 w-2.5" /> {event.actorType}</span>
            <span>stage: {event.pipelineStage}</span>
            {event.latencyMs > 0 && <span>latency: {event.latencyMs}ms</span>}
            <span className="text-[var(--hack-cyan)]/50">integrity: {event.integrityHash.slice(0, 12)}...</span>
            {event.parentEventId && <span className="text-[var(--hack-purple)]/50">parent: {event.parentEventId.slice(0, 12)}...</span>}
          </div>

          {/* Trace button */}
          <button
            onClick={onTrace}
            className="flex items-center gap-1 font-mono text-[9px] text-[var(--hack-cyan)] hover:underline"
          >
            <GitBranch className="h-2.5 w-2.5" /> Trace full evidence chain →
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Chain Detail
// ============================================================================

function ChainDetail({ chain }: { chain: ProvenanceChain }) {
  return (
    <div className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-[var(--hack-cyan)]" />
        <span className="font-mono text-xs text-[var(--hack-cyan)] uppercase">Evidence Chain</span>
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 ml-auto">{chain.totalEvents} events</span>
      </div>

      <div>
        <span className="font-mono text-[9px] text-[var(--hack-green)]">Evidence ID: </span>
        <span className="font-mono text-[10px] text-[var(--hack-gray)]">{chain.evidenceId}</span>
      </div>

      {/* Chain stats */}
      <div className="grid grid-cols-5 gap-2">
        <ChainStat label="Collection" value={chain.collectionEvents} />
        <ChainStat label="Normalization" value={chain.normalizationEvents} />
        <ChainStat label="Scoring" value={chain.scoringEvents} />
        <ChainStat label="Synthesis" value={chain.synthesisEvents} />
        <ChainStat label="Reporting" value={chain.reportingEvents} />
      </div>

      {/* Source chain */}
      {chain.sourceChain.length > 0 && (
        <div>
          <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Source Chain:</span>
          <div className="space-y-0.5 mt-0.5">
            {chain.sourceChain.map((s, i) => (
              <div key={i} className="font-mono text-[9px] flex items-center gap-2">
                <Link2 className="h-2.5 w-2.5 text-[var(--hack-cyan)] shrink-0" />
                <span className="text-[var(--hack-cyan)] truncate flex-1">{s.sourceUrl || "(no URL)"}</span>
                <span className="text-[var(--hack-gray)]/50 shrink-0">{s.sourceType}</span>
                <span className="text-[var(--hack-gray)]/40 shrink-0">{formatTime(s.collectedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confidence history */}
      {chain.confidenceHistory.length > 0 && (
        <div>
          <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Confidence History:</span>
          <div className="space-y-0.5 mt-0.5">
            {chain.confidenceHistory.map((c, i) => (
              <div key={i} className="font-mono text-[9px] flex items-center gap-2">
                <span className="text-[var(--hack-amber)] shrink-0 w-16">{(c.confidence * 100).toFixed(0)}%</span>
                <span className="text-[var(--hack-gray)]/50 shrink-0">{c.eventType}</span>
                <span className="text-[var(--hack-gray)]/40 truncate">{c.rationale.slice(0, 80)}</span>
                <span className="text-[var(--hack-gray)]/30 ml-auto shrink-0">{formatTime(c.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lineage */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <span className="font-mono text-[9px] uppercase text-[var(--hack-purple)]/60">Derived From ({chain.derivedFrom.length}):</span>
          {chain.derivedFrom.length === 0 ? (
            <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-0.5">(root evidence)</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {chain.derivedFrom.slice(0, 5).map((id, i) => (
                <li key={i} className="font-mono text-[9px] text-[var(--hack-purple)]/70 truncate">{id}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Derived Into ({chain.derivedInto.length}):</span>
          {chain.derivedInto.length === 0 ? (
            <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-0.5">(leaf evidence)</p>
          ) : (
            <ul className="mt-0.5 space-y-0.5">
              {chain.derivedInto.slice(0, 5).map((id, i) => (
                <li key={i} className="font-mono text-[9px] text-[var(--hack-green)]/70 truncate">{id}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Stat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : color === "red" ? "text-[var(--hack-red)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 p-2 text-center">
      <Icon className={`h-3 w-3 mx-auto mb-0.5 ${c}`} />
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
        active
          ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]"
          : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:border-[var(--hack-cyan)]/30"
      }`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className={`h-3.5 w-3.5 ${c}`} />
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">{title}</span>
    </div>
  );
}

function ChainStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/40 p-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${value > 0 ? "text-[var(--hack-cyan)]" : "text-[var(--hack-gray)]/40"}`}>{value}</div>
      <div className="font-mono text-[7px] uppercase text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
