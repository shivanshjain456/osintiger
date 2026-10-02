"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Brain,
  Crosshair,
  Database,
  GitBranch,
  Loader2,
  Network,
  Activity,
  Clock,
  Target,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  List,
  FileText,
} from "lucide-react";
import type { PlanPollResponse, PlanStep } from "@/lib/osint/client";
import { pollPlan } from "@/lib/osint/client";
import { ReportView } from "./ReportView";
import type { PollResponse } from "@/lib/osint/client";

interface Props {
  id: string;
  target: string;
  onHome: () => void;
}

export function PlanView({ id, target, onHome }: Props) {
  const [poll, setPoll] = useState<PlanPollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function pollLoop() {
      if (cancelledRef.current) return;
      try {
        const data = await pollPlan(id);
        if (cancelledRef.current) return;
        setPoll(data);
        setError(null);

        // Auto-expand the current running step
        if (data.plan && data.current_step > 0) {
          setExpandedSteps((prev) => {
            const next = new Set(prev);
            next.add(data.current_step);
            if (data.current_step > 1) next.add(data.current_step - 1);
            return next;
          });
        }

        if (data.status === "planning" || data.status === "executing") {
          const elapsed = data.stats.elapsed_seconds;
          const delay = elapsed < 10 ? 800 : elapsed < 30 ? 1500 : 2500;
          timeoutId = setTimeout(pollLoop, delay);
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : "Poll failed");
        timeoutId = setTimeout(pollLoop, 3000);
      }
    }

    pollLoop();
    return () => {
      cancelledRef.current = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id]);

  // Convert plan poll to standard PollResponse for ReportView
  function convertToPollResponse(): PollResponse | null {
    if (!poll || !poll.report) return null;
    return {
      investigation_id: poll.plan_id,
      status: poll.status === "completed" ? "completed" : "failed",
      progress: { current_step: poll.stats.total_steps, total_steps: poll.stats.total_steps, step_name: "Plan Complete" },
      steps: [],
      source_results: [],
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
            {"» initializing AI investigation planner..."}
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

  const isRunning = poll.status === "planning" || poll.status === "executing";
  const isComplete = poll.status === "completed";

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
              <Brain className="h-5 w-5 text-[var(--hack-cyan)]" />
              <h1 className="text-xl font-bold font-mono text-[var(--hack-green)]">
                AI Investigation Plan
              </h1>
              <StatusBadge status={poll.status} />
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

      {/* Planning notes */}
      {poll.planning_notes && (
        <div className="border border-[var(--hack-border)] bg-black/30 px-3 py-2 mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-3.5 w-3.5 text-[var(--hack-green)] shrink-0" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]">
              AI Planner Notes
            </span>
          </div>
          <p className="text-xs text-[var(--hack-green)] mt-1 font-mono">{poll.planning_notes}</p>
        </div>
      )}

      {/* Strategy summary */}
      {poll.plan && (
        <div className="border border-[var(--hack-green)]/20 bg-[var(--hack-green)]/5 px-3 py-2 mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-[var(--hack-green)] shrink-0" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-green)]">
              Strategy Summary
            </span>
            {poll.plan.categories.length > 0 && (
              <div className="flex gap-1 ml-2">
                {poll.plan.categories.map((cat, i) => (
                  <span key={i} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1.5 py-0.5 text-[var(--hack-cyan)]">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--hack-green)] mt-1">{poll.plan.strategySummary}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <StatCard icon={GitBranch} label="Steps" value={`${poll.stats.completed_steps}/${poll.stats.total_steps}`} color="cyan" />
        <StatCard icon={Database} label="Evidence" value={poll.evidence_count} color="green" />
        <StatCard icon={Network} label="Entities" value={poll.entity_count} color="green" />
        <StatCard icon={FileText} label="Findings" value={poll.finding_count} color="cyan" />
        <StatCard icon={Clock} label="Elapsed" value={`${poll.stats.elapsed_seconds}s`} color="gray" />
        <StatCard icon={XCircle} label="Failed" value={poll.stats.failed_steps} color="amber" />
      </div>

      {/* Plan steps */}
      <div className="space-y-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header flex items-center gap-2">
          <List className="h-3.5 w-3.5" />
          Investigation Plan
          <span className="text-[var(--hack-gray)] font-normal">
            ({poll.plan?.steps.length || 0} steps)
          </span>
        </h2>

        {poll.status === "planning" && !poll.plan ? (
          <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-3" />
            <p className="font-mono text-xs text-[var(--hack-gray)]">
              {"» AI is generating the investigation plan..."}
            </p>
            <p className="font-mono text-[10px] text-[var(--hack-gray)]/50 mt-1">
              This may take 10-20 seconds while the AI analyzes the objective and available sources.
            </p>
          </div>
        ) : poll.plan ? (
          <div className="border border-[var(--hack-border)] bg-black/20">
            {poll.plan.steps.map((step) => (
              <StepCard
                key={step.stepNumber}
                step={step}
                isExpanded={expandedSteps.has(step.stepNumber)}
                onToggle={() =>
                  setExpandedSteps((prev) => {
                    const next = new Set(prev);
                    if (next.has(step.stepNumber)) next.delete(step.stepNumber);
                    else next.add(step.stepNumber);
                    return next;
                  })
                }
              />
            ))}
          </div>
        ) : (
          <div className="border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10 p-4 text-center">
            <p className="font-mono text-xs text-[var(--hack-red)]">
              {poll.error || "Plan generation failed."}
            </p>
          </div>
        )}
      </div>

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
            {poll.status}...
          </span>
        </div>
      )}
    </div>
  );
}

// =====================
// Sub-components
// =====================

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "completed" ? "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10" :
    status === "executing" ? "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10" :
    status === "planning" ? "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10" :
    status === "failed" ? "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10" :
    "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20";
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border ${color}`}>
      {status}
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

function StepCard({
  step,
  isExpanded,
  onToggle,
}: {
  step: PlanStep;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const statusIcon =
    step.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--hack-cyan)]" /> :
    step.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5 text-[var(--hack-green)]" /> :
    step.status === "failed" ? <XCircle className="h-3.5 w-3.5 text-[var(--hack-red)]" /> :
    step.status === "skipped" ? <ChevronRight className="h-3.5 w-3.5 text-[var(--hack-gray)]" /> :
    <div className="h-3.5 w-3.5 rounded-full border border-[var(--hack-border)]" />;

  const statusColor =
    step.status === "running" ? "border-l-[var(--hack-cyan)]" :
    step.status === "completed" ? "border-l-[var(--hack-green)]" :
    step.status === "failed" ? "border-l-[var(--hack-red)]" :
    "border-l-[var(--hack-border)]";

  return (
    <div className={`border-b border-[var(--hack-border)]/30 border-l-2 ${statusColor} last:border-b-0`}>
      {/* Step header (clickable) */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-green)]/5 transition-colors text-left"
      >
        {statusIcon}
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">
          #{step.stepNumber}
        </span>
        <span className="font-mono text-xs text-[var(--hack-green)] truncate flex-1">
          {step.name}
        </span>
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">
          {step.sources.length} sources
        </span>
        {step.findingCount > 0 && (
          <span className="font-mono text-[9px] text-[var(--hack-green)]/60 shrink-0">
            {step.findingCount}f
          </span>
        )}
        {step.durationMs > 0 && (
          <span className="font-mono text-[9px] text-[var(--hack-gray)]/50 shrink-0">
            {step.durationMs}ms
          </span>
        )}
        {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
      </button>

      {/* Step details (expanded) */}
      {isExpanded && (
        <div className="px-3 pb-3 pl-10 space-y-2">
          {/* Reasoning */}
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-cyan)]">
              Reasoning:
            </span>
            <p className="text-xs text-[var(--hack-gray)] mt-0.5">{step.reasoning}</p>
          </div>

          {/* Target */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]">
              Target:
            </span>
            <span className="font-mono text-[10px] text-[var(--hack-green)]">{step.target}</span>
            <span className="font-mono text-[9px] text-[var(--hack-gray)]/50">[{step.targetType}]</span>
          </div>

          {/* Sources */}
          <div>
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]">
              Sources:
            </span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {step.sources.map((src, i) => (
                <span key={i} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1.5 py-0.5 text-[var(--hack-cyan)]">
                  {src}
                </span>
              ))}
            </div>
          </div>

          {/* Expected outcomes */}
          {step.expectedOutcomes.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]">
                Expected Outcomes:
              </span>
              <ul className="mt-0.5 space-y-0.5">
                {step.expectedOutcomes.map((outcome, i) => (
                  <li key={i} className="text-xs text-[var(--hack-gray)] flex items-start gap-1">
                    <span className="text-[var(--hack-green)] shrink-0">→</span>
                    {outcome}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Error */}
          {step.error && (
            <div className="font-mono text-[10px] text-[var(--hack-red)] border-l-2 border-[var(--hack-red)]/40 pl-2">
              Error: {step.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
