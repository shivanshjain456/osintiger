"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pollInvestigation, type PollResponse } from "@/lib/osint/client";
import { PipelineStepper } from "./PipelineStepper";
import { SourceBadge } from "./SourceBadge";
import { ArrowLeft, Loader2, XCircle, CheckCircle2, AlertTriangle } from "lucide-react";

export function ProgressView({
  id,
  target,
  onHome,
  onComplete,
}: {
  id: string;
  target: string;
  onHome: () => void;
  onComplete: (poll: PollResponse) => void;
}) {
  const [poll, setPoll] = useState<PollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let pollTimer: NodeJS.Timeout;
    let completeTimer: NodeJS.Timeout;
    let cancelled = false; // local variable — resets on each Strict Mode mount
    let retryCount = 0;

    async function loop() {
      try {
        const p = await pollInvestigation(id);
        if (cancelled) return;
        setPoll(p);
        retryCount = 0;
        if (p.status === "completed") {
          completeTimer = setTimeout(() => !cancelled && onComplete(p), 600);
          return;
        }
        if (p.status === "failed") {
          setError(p.error || "Investigation failed");
          return;
        }
        // Poll faster initially (500ms), then slow down (1500ms after step 3)
        const pollInterval = p.progress.current_step <= 2 ? 500 : 1500;
        timer = setTimeout(loop, pollInterval);
      } catch (e) {
        if (cancelled) return;
        retryCount++;
        if (retryCount > 5) {
          setError(e instanceof Error ? e.message : "Polling failed after 5 retries");
        } else {
          timer = setTimeout(loop, 2000);
        }
      }
    }
    loop();
    pollTimer = setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(completeTimer);
      clearInterval(pollTimer);
    };
  }, [id, onComplete]);

  const pct = poll
    ? Math.round((poll.progress.current_step / poll.progress.total_steps) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="sm" onClick={onHome} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> New investigation
        </Button>
        <div className="font-mono text-xs text-muted-foreground">
          elapsed {(elapsed / 1000).toFixed(1)}s
        </div>
      </div>

      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-[var(--hack-green)] mb-1 font-mono">
          {"// investigating target"}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold break-all font-mono text-[var(--hack-green)]">
          {target}
          <span className="text-[var(--hack-green)] blink-cursor"></span>
        </h1>
        {poll && (
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-mono">
            <span className="border border-[var(--hack-border)] bg-[var(--hack-surface)] px-2 py-0.5 text-[var(--hack-gray)]">
              type: {poll.input_type}
            </span>
            <span className="border border-[var(--hack-border)] bg-[var(--hack-surface)] px-2 py-0.5 text-[var(--hack-gray)]">
              lang: {poll.language}
            </span>
            <span
              className={`status-badge ${
                poll.status === "in_progress"
                  ? "status-warning"
                  : poll.status === "completed"
                  ? "status-online"
                  : "status-error"
              }`}
            >
              {poll.status}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar — terminal style */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5 text-xs font-mono">
          <span className="text-[var(--hack-green)]">
            <span className="text-[var(--hack-gray)]">$</span> {poll?.progress.step_name || "Connecting to pipeline..."}
          </span>
          <span className="text-[var(--hack-green)]">
            [{poll?.progress.current_step || 0}/{poll?.progress.total_steps || 8}] {pct}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden bg-[var(--hack-surface)] border border-[var(--hack-border)]">
          <div
            className="h-full hack-progress transition-all duration-500"
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pipeline steps */}
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-2 w-2  bg-[var(--hack-green)] pulse-green" />
              Research Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {poll ? (
              <PipelineStepper steps={poll.steps} current={poll.progress.current_step} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Establishing connection…
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live source results */}
        <Card className="bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-2 w-2  bg-[var(--hack-green)]" />
              Live Source Activity
              {poll && poll.source_results.length > 0 && (
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                  {poll.source_results.filter((s) => s.status === "success").length}/{poll.source_results.length} done
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {poll && poll.source_results.length > 0 ? (
              <div className="space-y-1.5">
                {poll.source_results.map((s, idx) => (
                  <div
                    key={s.source}
                    className="group  border border-white/5 bg-black/20 px-3 py-2 transition hover:border-[var(--hack-green)]/30 fade-in"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <SourceBadge
                        label={s.source_label}
                        status={s.status}
                        url={s.findings?.[0]?.source_url}
                        error={s.error}
                        findingCount={s.findings?.length}
                      />
                      {s.latency_ms != null && s.status === "success" && (
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                          {s.latency_ms}ms
                        </span>
                      )}
                    </div>
                    {/* Findings preview on success */}
                    {s.status === "success" && s.findings.length > 0 && (
                      <div className="mt-2 max-h-0 group-hover:max-h-32 overflow-hidden transition-all duration-300 border-t border-white/5 pt-0 group-hover:pt-2">
                        <div className="space-y-1">
                          {s.findings.slice(0, 3).map((f, i) => (
                            <div key={i} className="text-[11px] text-muted-foreground truncate pl-1">
                              <span className="text-[var(--hack-green)]/60 mr-1">•</span>
                              {f.data.slice(0, 100)}{f.data.length > 100 ? "…" : ""}
                            </div>
                          ))}
                          {s.findings.length > 3 && (
                            <div className="text-[10px] text-muted-foreground/50 pl-1">
                              +{s.findings.length - 3} more…
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Awaiting source dispatch…
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-2  border border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5 p-3 text-sm text-[var(--hack-red)]">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">Investigation failed</div>
                  <div className="text-xs opacity-80">{error}</div>
                  <Button size="sm" variant="outline" onClick={onHome} className="mt-2">
                    Start over
                  </Button>
                </div>
              </div>
            )}

            {poll?.status === "completed" && !error && (
              <div className="mt-4 flex items-center gap-2  border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 p-3 text-sm text-[var(--hack-green)]">
                <CheckCircle2 className="h-4 w-4" /> Report ready — loading…
              </div>
            )}
            {poll?.steps.some((s) => s.status === "error") && !error && (
              <div className="mt-4 flex items-start gap-2  border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 p-3 text-xs text-[var(--hack-cyan)]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                A pipeline step reported an issue (e.g. attribution gaps). The report will be
                flagged for manual review if needed.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
