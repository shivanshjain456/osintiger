"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Bot,
  Brain,
  Crosshair,
  Database,
  GitBranch,
  Loader2,
  Network,
  Activity,
  Clock,
  Target,
  Zap,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Network as NetworkIcon,
  List,
} from "lucide-react";
import type { AgentPollResponse, AgentTraceEntry, AgentDiscoveredEntity } from "@/lib/osint/client";
import { pollAgentInvestigation } from "@/lib/osint/client";
import { ReportView } from "./ReportView";
import { KnowledgeGraphPanel } from "./KnowledgeGraphPanel";
import { ConfidenceEnginePanel } from "./ConfidenceEnginePanel";
import type { PollResponse } from "@/lib/osint/client";
import type { KnowledgeGraph } from "@/lib/osint/agent/graph-types";

interface Props {
  id: string;
  target: string;
  onHome: () => void;
}

export function AgentView({ id, target, onHome }: Props) {
  const [poll, setPoll] = useState<AgentPollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [viewMode, setViewMode] = useState<"trace" | "graph" | "confidence">("trace");
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [expandedIterations, setExpandedIterations] = useState<Set<number>>(new Set([1]));
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function pollLoop() {
      if (cancelledRef.current) return;
      try {
        const data = await pollAgentInvestigation(id);
        if (cancelledRef.current) return;
        setPoll(data);
        setError(null);

        // Auto-expand the latest iteration
        setExpandedIterations((prev) => {
          const next = new Set(prev);
          if (data.iteration > 0) next.add(data.iteration);
          return next;
        });

        // Continue polling if not complete
        if (data.status === "running" || data.status === "queued") {
          // Adaptive polling: faster early, slower later
          const elapsed = data.stats.elapsed_seconds;
          const delay = elapsed < 10 ? 800 : elapsed < 30 ? 1500 : 2500;
          timeoutId = setTimeout(pollLoop, delay);
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : "Poll failed");
        // Retry after 3s on error
        timeoutId = setTimeout(pollLoop, 3000);
      }
    }

    pollLoop();
    return () => {
      cancelledRef.current = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id]);

  // Fetch knowledge graph when switching to graph view
  useEffect(() => {
    if (viewMode !== "graph" || !poll) return;
    let cancelled = false;
    fetch(`/api/agent/investigate/${id}/graph`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.graph) {
          setGraph(data.graph);
          setGraphLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error("Graph fetch failed:", e);
          setGraphLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [viewMode, id, poll?.iteration]); // Re-fetch when iteration changes

  // Convert agent poll to standard PollResponse for ReportView
  function convertToPollResponse(): PollResponse | null {
    if (!poll || !poll.report) return null;
    return {
      investigation_id: poll.investigation_id,
      status: poll.status === "completed" ? "completed" : "failed",
      progress: { current_step: 8, total_steps: 8, step_name: "Agent Complete" },
      steps: [],
      source_results: poll.evidence.map((ev) => ({
        source: ev.source,
        source_label: ev.sourceLabel,
        target: ev.target,
        status: ev.status as "success" | "error" | "skipped" | "timeout",
        error: ev.error,
        findings: ev.findings,
      })),
      report: poll.report,
      target: poll.target,
      input_type: poll.input_type,
      language: "en",
      created_at: poll.started_at,
      completed_at: poll.completed_at,
    };
  }

  if (showReport && poll?.report) {
    const reportPoll = convertToPollResponse();
    if (reportPoll) {
      return (
        <ReportView
          poll={reportPoll}
          onHome={onHome}
          onNewInvestigation={() => setShowReport(false)}
        />
      );
    }
  }

  if (!poll && !error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--hack-green)]" />
          <span className="font-mono text-sm text-[var(--hack-gray)]">
            {"» initializing autonomous agent..."}
          </span>
        </div>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-[var(--hack-red)] mx-auto" />
          <p className="font-mono text-sm text-[var(--hack-red)]">{error}</p>
          <Button onClick={onHome} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const isRunning = poll.status === "running" || poll.status === "queued";
  const isComplete = poll.status === "completed" || poll.status === "stopped";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button onClick={onHome} variant="ghost" size="sm" className="text-[var(--hack-gray)] hover:text-[var(--hack-green)]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-[var(--hack-cyan)]" />
              <h1 className="text-xl font-bold font-mono text-[var(--hack-green)]">
                Autonomous Agent
              </h1>
              <StatusBadge status={poll.status} phase={poll.current_phase} />
            </div>
            <p className="text-xs text-[var(--hack-gray)] font-mono mt-0.5">
              {poll.target} · {poll.input_type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && poll.report && (
            <Button
              onClick={() => setShowReport(true)}
              size="sm"
              className="bg-[var(--hack-green)]/10 border border-[var(--hack-green)]/40 text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 font-mono"
            >
              <CheckCircle2 className="h-4 w-4" /> View Report
            </Button>
          )}
        </div>
      </div>

      {/* Objective */}
      <div className="border border-[var(--hack-cyan)]/20 bg-[var(--hack-cyan)]/5 px-3 py-2 mb-4">
        <div className="flex items-start gap-2">
          <Crosshair className="h-3.5 w-3.5 text-[var(--hack-cyan)] mt-0.5 shrink-0" />
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-cyan)]">
              Investigation Objective
            </span>
            <p className="text-sm text-[var(--hack-gray)] mt-0.5">{poll.objective}</p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <StatCard icon={Activity} label="Iterations" value={`${poll.iteration}/${poll.config.maxIterations}`} color="cyan" />
        <StatCard icon={Network} label="Entities" value={`${poll.stats.entities_count}/${poll.config.maxEntities}`} color="green" />
        <StatCard icon={Database} label="Evidence" value={poll.stats.evidence_count} color="green" />
        <StatCard icon={Zap} label="Actions" value={poll.stats.actions_count} color="cyan" />
        <StatCard icon={Clock} label="Elapsed" value={`${poll.stats.elapsed_seconds}s`} color="gray" />
        <StatCard icon={Target} label="Frontier" value={poll.frontier.length} color="amber" />
      </div>

      {/* Current strategy */}
      {poll.current_strategy && (
        <div className="border border-[var(--hack-border)] bg-black/30 px-3 py-2 mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-[var(--hack-green)] shrink-0" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]">
              Current Strategy
            </span>
          </div>
          <p className="text-xs text-[var(--hack-green)] mt-1 font-mono">{poll.current_strategy}</p>
        </div>
      )}

      {/* View mode toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode("trace")}
          className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
            viewMode === "trace"
              ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
              : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-green)]"
          }`}
        >
          <List className="h-3 w-3" />
          Trace View
        </button>
        <button
          onClick={() => {
            setViewMode("graph");
            setGraphLoading(true);
          }}
          className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
            viewMode === "graph"
              ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
              : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-green)]"
          }`}
        >
          <NetworkIcon className="h-3 w-3" />
          Knowledge Graph
          {poll.discovered_entities.length > 0 && (
            <span className="ml-1 text-[var(--hack-gray)]/60">
              ({poll.discovered_entities.length})
            </span>
          )}
        </button>
        <button
          onClick={() => setViewMode("confidence")}
          className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
            viewMode === "confidence"
              ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
              : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-green)]"
          }`}
        >
          <CheckCircle2 className="h-3 w-3" />
          Confidence
        </button>
      </div>

      {/* Graph view */}
      {viewMode === "graph" ? (
        <div className="space-y-3">
          {graphLoading ? (
            <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-green)] mx-auto mb-2" />
              <p className="font-mono text-xs text-[var(--hack-gray)]">
                {"» building knowledge graph..."}
              </p>
            </div>
          ) : graph ? (
            <KnowledgeGraphPanel graph={graph} target={poll.target} />
          ) : (
            <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
              <p className="font-mono text-xs text-[var(--hack-gray)]">
                {"» no graph data available"}
              </p>
            </div>
          )}
          {/* Also show entities list below the graph */}
          <div className="space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header flex items-center gap-2">
              <Network className="h-3.5 w-3.5" />
              Discovered Entities
              <span className="text-[var(--hack-gray)] font-normal">
                ({poll.discovered_entities.length})
              </span>
            </h2>
            <div className="max-h-64 overflow-y-auto border border-[var(--hack-border)] bg-black/20">
              {poll.discovered_entities.length === 0 ? (
                <p className="p-4 text-center font-mono text-xs text-[var(--hack-gray)]">
                  {"» no entities discovered yet"}
                </p>
              ) : (
                <EntityList entities={poll.discovered_entities} />
              )}
            </div>
          </div>
        </div>
      ) : viewMode === "confidence" ? (
        /* Confidence view */
        <ConfidenceEnginePanel investigationId={id} apiPath="agent" />
      ) : (
        /* Trace view (original two-column layout) */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Trace — takes 2 columns */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5" />
              Reasoning Trace
              <span className="text-[var(--hack-gray)] font-normal">
                ({poll.trace.length} entries)
              </span>
            </h2>
            <div className="max-h-[600px] overflow-y-auto border border-[var(--hack-border)] bg-black/20">
              {poll.trace.length === 0 ? (
                <div className="p-6 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--hack-green)] mx-auto mb-2" />
                  <p className="font-mono text-xs text-[var(--hack-gray)]">
                    {"» agent thinking..."}
                  </p>
                </div>
              ) : (
                <TraceTimeline
                  trace={poll.trace}
                  expandedIterations={expandedIterations}
                  onToggle={(iter) =>
                    setExpandedIterations((prev) => {
                      const next = new Set(prev);
                      if (next.has(iter)) next.delete(iter);
                      else next.add(iter);
                      return next;
                    })
                  }
                />
              )}
            </div>
          </div>

        {/* Discovered entities — takes 1 column */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header flex items-center gap-2">
            <Network className="h-3.5 w-3.5" />
            Discovered Entities
            <span className="text-[var(--hack-gray)] font-normal">
              ({poll.discovered_entities.length})
            </span>
          </h2>
          <div className="max-h-[600px] overflow-y-auto border border-[var(--hack-border)] bg-black/20">
            {poll.discovered_entities.length === 0 ? (
              <p className="p-4 text-center font-mono text-xs text-[var(--hack-gray)]">
                {"» no entities discovered yet"}
              </p>
            ) : (
              <EntityList entities={poll.discovered_entities} />
            )}
          </div>

          {/* Frontier */}
          {poll.frontier.length > 0 && (
            <>
              <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-amber)] section-header flex items-center gap-2 mt-4">
                <Target className="h-3.5 w-3.5" />
                Frontier Queue
                <span className="text-[var(--hack-gray)] font-normal">
                  ({poll.frontier.length})
                </span>
              </h2>
              <div className="max-h-48 overflow-y-auto border border-[var(--hack-border)] bg-black/20">
                {poll.frontier.slice(0, 20).map((f, i) => (
                  <div key={i} className="border-b border-[var(--hack-border)]/50 px-2 py-1.5 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-[var(--hack-green)] truncate">
                        {f.entityValue}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--hack-gray)] ml-1">
                        P:{f.priority}
                      </span>
                    </div>
                    <div className="font-mono text-[9px] text-[var(--hack-gray)]/70 truncate">
                      [{f.entityType}] d:{f.depth} — {f.reason.slice(0, 50)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Error display */}
      {poll.error && (
        <div className="mt-4 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[var(--hack-red)]" />
            <span className="font-mono text-xs text-[var(--hack-red)]">{poll.error}</span>
          </div>
        </div>
      )}

      {/* Phase indicator */}
      {isRunning && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 border border-[var(--hack-green)]/40 bg-[var(--hack-bg)]/95 px-3 py-2 backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--hack-green)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">
            {poll.current_phase}...
          </span>
        </div>
      )}
    </div>
  );
}

// =====================
// Sub-components
// =====================

function StatusBadge({ status, phase }: { status: string; phase: string }) {
  const color =
    status === "completed" ? "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10" :
    status === "running" ? "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10" :
    status === "failed" ? "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10" :
    status === "stopped" ? "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10" :
    "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20";
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border ${color}`}>
      {status === "running" ? phase : status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const colorClass =
    color === "green" ? "text-[var(--hack-green)]" :
    color === "cyan" ? "text-[var(--hack-cyan)]" :
    color === "amber" ? "text-[var(--hack-amber)]" :
    "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${colorClass}`} />
        <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">
          {label}
        </span>
      </div>
      <div className={`font-mono text-sm font-bold mt-0.5 ${colorClass}`}>{value}</div>
    </div>
  );
}

function TraceTimeline({
  trace,
  expandedIterations,
  onToggle,
}: {
  trace: AgentTraceEntry[];
  expandedIterations: Set<number>;
  onToggle: (iter: number) => void;
}) {
  // Group trace entries by iteration
  const byIteration = new Map<number, AgentTraceEntry[]>();
  for (const entry of trace) {
    const iter = entry.iteration;
    if (!byIteration.has(iter)) byIteration.set(iter, []);
    byIteration.get(iter)!.push(entry);
  }

  const iterations = [...byIteration.keys()].sort((a, b) => a - b);

  return (
    <div className="divide-y divide-[var(--hack-border)]/30">
      {iterations.map((iter) => {
        const entries = byIteration.get(iter)!;
        const isExpanded = expandedIterations.has(iter);
        return (
          <div key={iter}>
            {/* Iteration header */}
            <button
              onClick={() => onToggle(iter)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-green)]/5 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
                Iteration {iter}
              </span>
              <span className="font-mono text-[9px] text-[var(--hack-gray)]">
                {entries.length} entries
              </span>
            </button>
            {/* Entries */}
            {isExpanded && (
              <div className="pl-6 pr-2 pb-2 space-y-1">
                {entries.map((entry, i) => (
                  <TraceEntry key={i} entry={entry} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TraceEntry({ entry }: { entry: AgentTraceEntry }) {
  const phaseColors: Record<string, string> = {
    planning: "text-[var(--hack-cyan)]",
    executing: "text-[var(--hack-green)]",
    extracting: "text-[var(--hack-amber)]",
    stopping: "text-[var(--hack-red)]",
    synthesizing: "text-[var(--hack-cyan)]",
  };
  const phaseIcons: Record<string, React.ElementType> = {
    planning: Brain,
    executing: Zap,
    extracting: Network,
    stopping: XCircle,
    synthesizing: CheckCircle2,
  };
  const Icon = phaseIcons[entry.phase] || Activity;
  const color = phaseColors[entry.phase] || "text-[var(--hack-gray)]";
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false });

  return (
    <div className="border-l border-[var(--hack-border)]/50 pl-2 py-1">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${color} shrink-0`} />
        <span className={`font-mono text-[9px] uppercase tracking-wider ${color}`}>
          {entry.phase}
        </span>
        <span className="font-mono text-[8px] text-[var(--hack-gray)]/50 ml-auto">
          {time}
        </span>
      </div>

      {/* Planning phase: show actions */}
      {entry.phase === "planning" && entry.actions && (
        <div className="mt-1 space-y-0.5">
          {entry.strategyNote && (
            <p className="font-mono text-[10px] text-[var(--hack-gray)] italic">
              {entry.strategyNote.slice(0, 120)}
            </p>
          )}
          {entry.actions.map((a, i) => (
            <div key={i} className="flex items-start gap-1 font-mono text-[10px]">
              <span className="text-[var(--hack-green)]">→</span>
              <span className="text-[var(--hack-cyan)]">{a.source}</span>
              <span className="text-[var(--hack-gray)]">for</span>
              <span className="text-[var(--hack-green)] truncate">{a.target}</span>
            </div>
          ))}
        </div>
      )}

      {/* Executing phase: show action + result */}
      {entry.phase === "executing" && entry.action && entry.result && (
        <div className="mt-1">
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <span className="text-[var(--hack-cyan)]">{entry.action.source}</span>
            <span className="text-[var(--hack-gray)]">→</span>
            <span className="text-[var(--hack-green)] truncate">{entry.action.target}</span>
            <ResultIcon status={entry.result.status} />
          </div>
          {entry.action.reason && (
            <p className="font-mono text-[9px] text-[var(--hack-gray)]/70 mt-0.5 italic">
              {entry.action.reason.slice(0, 100)}
            </p>
          )}
          <div className="font-mono text-[9px] text-[var(--hack-gray)] mt-0.5">
            {entry.result.summary}
            {entry.result.latencyMs && ` · ${entry.result.latencyMs}ms`}
          </div>
        </div>
      )}

      {/* Extracting phase: show entities */}
      {entry.phase === "extracting" && entry.entitiesDiscovered && (
        <div className="mt-1">
          <p className="font-mono text-[10px] text-[var(--hack-amber)]">
            {entry.entitiesDiscovered.length} new entities discovered
          </p>
          {entry.entitiesDiscovered.slice(0, 5).map((e, i) => (
            <div key={i} className="font-mono text-[9px] text-[var(--hack-gray)] pl-2">
              + [{e.type}] {e.value} (depth: {e.depth})
            </div>
          ))}
          {entry.entitiesDiscovered.length > 5 && (
            <div className="font-mono text-[9px] text-[var(--hack-gray)]/50 pl-2">
              ... and {entry.entitiesDiscovered.length - 5} more
            </div>
          )}
        </div>
      )}

      {/* Stopping phase: show reason */}
      {entry.phase === "stopping" && entry.stopReason && (
        <p className="font-mono text-[10px] text-[var(--hack-red)] mt-1">
          {entry.stopReason}
        </p>
      )}

      {/* Synthesizing phase */}
      {entry.phase === "synthesizing" && entry.strategyNote && (
        <p className="font-mono text-[10px] text-[var(--hack-cyan)] mt-1">
          {entry.strategyNote}
        </p>
      )}
    </div>
  );
}

function ResultIcon({ status }: { status: string }) {
  if (status === "success") return <CheckCircle2 className="h-3 w-3 text-[var(--hack-green)] shrink-0" />;
  if (status === "error" || status === "timeout") return <XCircle className="h-3 w-3 text-[var(--hack-red)] shrink-0" />;
  if (status === "skipped") return <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />;
  return <Activity className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />;
}

function EntityList({ entities }: { entities: AgentDiscoveredEntity[] }) {
  // Group by type
  const byType = new Map<string, AgentDiscoveredEntity[]>();
  for (const e of entities) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type)!.push(e);
  }

  const typeColors: Record<string, string> = {
    domain: "text-[var(--hack-amber)]",
    ip: "text-[var(--hack-red)]",
    email: "text-[var(--hack-purple)]",
    wallet: "text-[var(--hack-amber)]",
    cve: "text-[var(--hack-orange)]",
    hash: "text-[var(--hack-gray)]",
    person: "text-[var(--hack-green)]",
    organization: "text-[var(--hack-cyan)]",
    username: "text-[var(--hack-purple)]",
    phone: "text-teal-400",
    url: "text-[var(--hack-cyan)]",
  };

  return (
    <div className="divide-y divide-[var(--hack-border)]/30">
      {[...byType.entries()].map(([type, ents]) => (
        <div key={type} className="px-2 py-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className={`font-mono text-[9px] uppercase tracking-wider ${typeColors[type] || "text-[var(--hack-gray)]"}`}>
              {type}
            </span>
            <span className="font-mono text-[9px] text-[var(--hack-gray)]">
              {ents.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {ents.slice(0, 15).map((e, i) => (
              <div key={i} className="font-mono text-[10px] text-[var(--hack-gray)] truncate" title={e.value}>
                <span className="text-[var(--hack-green)]/50">d{e.depth}</span>{" "}
                {e.value}
              </div>
            ))}
            {ents.length > 15 && (
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/50">
                ... +{ents.length - 15} more
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
