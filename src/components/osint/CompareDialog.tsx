"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GitCompare, Loader2, ArrowRight, ShieldCheck, AlertTriangle } from "lucide-react";
import { fetchRecentWithFilters, pollInvestigation, type HistoryItem, type PollResponse } from "@/lib/osint/client";
import { ConfidenceMeter } from "./ConfidenceMeter";

export function CompareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [leftPoll, setLeftPoll] = useState<PollResponse | null>(null);
  const [rightPoll, setRightPoll] = useState<PollResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(0);

  // Load history list when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchRecentWithFilters("", "all", 50).then((d) => {
      if (cancelled) return;
      const done = d.investigations.filter((i) => i.status === "completed");
      setItems(done);
      if (done.length >= 1 && !leftId) {
        setLeftId(done[0].id);
        void loadPoll(done[0].id, "left");
      }
      if (done.length >= 2 && !rightId) {
        setRightId(done[1].id);
        void loadPoll(done[1].id, "right");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, leftId, rightId]);

  async function loadPoll(id: string, side: "left" | "right") {
    if (!id) {
      if (side === "left") setLeftPoll(null);
      else setRightPoll(null);
      return;
    }
    const myToken = ++loadingRef.current;
    setLoading(true);
    try {
      const p = await pollInvestigation(id);
      if (myToken !== loadingRef.current) return; // superseded
      if (side === "left") setLeftPoll(p);
      else setRightPoll(p);
    } catch {
      // ignore
    } finally {
      if (myToken === loadingRef.current) setLoading(false);
    }
  }

  function handleLeftChange(id: string) {
    setLeftId(id);
    void loadPoll(id, "left");
  }
  function handleRightChange(id: string) {
    setRightId(id);
    void loadPoll(id, "right");
  }

  const leftReport = leftPoll?.report;
  const rightReport = rightPoll?.report;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col bg-card/95 backdrop-blur-xl border-[var(--hack-green)]/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <GitCompare className="h-5 w-5 text-[var(--hack-green)]" />
            Compare Investigations
          </DialogTitle>
          <DialogDescription className="sr-only">
            Compare two completed investigations side-by-side with metric diffs and source overlap analysis.
          </DialogDescription>
        </DialogHeader>

        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-end pb-3 border-b border-white/10">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
              Investigation A
            </label>
            <Select value={leftId} onValueChange={handleLeftChange}>
              <SelectTrigger className="bg-black/40">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.target} ({i.input_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden md:flex items-center justify-center pb-2">
            <ArrowRight className="h-4 w-4 text-[var(--hack-green)]" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
              Investigation B
            </label>
            <Select value={rightId} onValueChange={handleRightChange}>
              <SelectTrigger className="bg-black/40">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.target} ({i.input_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Comparison body */}
        <div className="flex-1 overflow-y-auto -mr-2 pr-2 mt-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading reports…
            </div>
          ) : !leftReport || !rightReport ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <GitCompare className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Select two completed investigations to compare.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header comparison */}
              <div className="grid grid-cols-2 gap-3">
                <CompareCard poll={leftPoll!} side="A" />
                <CompareCard poll={rightPoll!} side="B" />
              </div>

              {/* Metric diffs */}
              <div className=" border border-white/10 bg-black/30 p-4">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Metric Comparison
                </h4>
                <div className="space-y-2">
                  <MetricRow
                    label="Confidence"
                    left={Math.round((leftReport.confidence_score || 0) * 100) + "%"}
                    right={Math.round((rightReport.confidence_score || 0) * 100) + "%"}
                    higherBetter
                  />
                  <MetricRow
                    label="Key Findings"
                    left={String(leftReport.key_findings.length)}
                    right={String(rightReport.key_findings.length)}
                  />
                  <MetricRow
                    label="Sources Consulted"
                    left={String(leftReport.sources_consulted.length)}
                    right={String(rightReport.sources_consulted.length)}
                  />
                  <MetricRow
                    label="Hypotheses"
                    left={String(leftReport.ach_analysis.hypotheses.length)}
                    right={String(rightReport.ach_analysis.hypotheses.length)}
                  />
                  <MetricRow
                    label="Geo Signals"
                    left={String(leftReport.geopoints.length)}
                    right={String(rightReport.geopoints.length)}
                  />
                  <MetricRow
                    label="Attribution"
                    left={leftReport.attribution_valid ? "Valid ✓" : "Needs Review"}
                    right={rightReport.attribution_valid ? "Valid ✓" : "Needs Review"}
                  />
                </div>
              </div>

              {/* Source overlap */}
              <SourceOverlap
                leftSources={leftReport.sources_consulted.map((s) => s.source)}
                rightSources={rightReport.sources_consulted.map((s) => s.source)}
              />

              {/* Top hypotheses comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className=" border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--hack-green)]/70 mb-2">
                    Top Hypothesis — {leftPoll!.target}
                  </div>
                  {leftReport.ach_analysis.hypotheses[0] ? (
                    <div>
                      <p className="text-sm font-medium">{leftReport.ach_analysis.hypotheses[0].statement}</p>
                      <div className="mt-2 w-32">
                        <ConfidenceMeter value={leftReport.ach_analysis.hypotheses[0].confidence} size="sm" showLabel={false} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No hypotheses</p>
                  )}
                </div>
                <div className=" border border-white/10 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--hack-green)]/70 mb-2">
                    Top Hypothesis — {rightPoll!.target}
                  </div>
                  {rightReport.ach_analysis.hypotheses[0] ? (
                    <div>
                      <p className="text-sm font-medium">{rightReport.ach_analysis.hypotheses[0].statement}</p>
                      <div className="mt-2 w-32">
                        <ConfidenceMeter value={rightReport.ach_analysis.hypotheses[0].confidence} size="sm" showLabel={false} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No hypotheses</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompareCard({ poll, side }: { poll: PollResponse; side: "A" | "B" }) {
  const report = poll.report!;
  return (
    <div className={` border p-3 ${side === "A" ? "border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5" : "border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5"}`}>
      <div className="flex items-center justify-between mb-1">
        <Badge variant="outline" className={`text-[9px] ${side === "A" ? "border-[var(--hack-green)]/40 text-[var(--hack-green)]" : "border-[var(--hack-green)]/40 text-[var(--hack-green)]"}`}>
          {side}
        </Badge>
        {report.attribution_valid ? (
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--hack-green)]" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-[var(--hack-red)]" />
        )}
      </div>
      <div className="font-semibold text-sm truncate">{poll.target}</div>
      <div className="text-[11px] text-muted-foreground font-mono uppercase">{poll.input_type}</div>
    </div>
  );
}

function MetricRow({
  label,
  left,
  right,
  higherBetter,
}: {
  label: string;
  left: string;
  right: string;
  higherBetter?: boolean;
}) {
  const leftNum = parseFloat(left);
  const rightNum = parseFloat(right);
  const bothNum = !isNaN(leftNum) && !isNaN(rightNum);
  const leftBetter = bothNum && higherBetter ? leftNum > rightNum : false;
  const rightBetter = bothNum && higherBetter ? rightNum > leftNum : false;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`font-mono text-right ${leftBetter ? "text-[var(--hack-green)] font-bold" : ""}`}>{left}</span>
      <span className="text-muted-foreground/40 text-xs">vs</span>
      <span className={`font-mono text-right ${rightBetter ? "text-[var(--hack-green)] font-bold" : ""}`}>{right}</span>
      <span className="w-4">
        {bothNum && leftNum !== rightNum && (
          <span className="text-[10px] text-muted-foreground">
            Δ{Math.abs(leftNum - rightNum).toFixed(left.includes("%") ? 0 : 0)}
          </span>
        )}
      </span>
    </div>
  );
}

function SourceOverlap({ leftSources, rightSources }: { leftSources: string[]; rightSources: string[] }) {
  const leftSet = new Set(leftSources);
  const rightSet = new Set(rightSources);
  const overlap = leftSources.filter((s) => rightSet.has(s));
  const leftOnly = leftSources.filter((s) => !rightSet.has(s));
  const rightOnly = rightSources.filter((s) => !leftSet.has(s));

  return (
    <div className=" border border-white/10 bg-black/30 p-4">
      <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        Source Overlap Analysis
      </h4>
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <div className="text-[var(--hack-green)] font-mono mb-1">A only ({leftOnly.length})</div>
          <div className="space-y-0.5">
            {leftOnly.map((s) => (
              <div key={s} className="text-muted-foreground">{s}</div>
            ))}
            {!leftOnly.length && <div className="text-muted-foreground/50 italic">none</div>}
          </div>
        </div>
        <div>
          <div className="text-[var(--hack-green)] font-mono mb-1">Shared ({overlap.length})</div>
          <div className="space-y-0.5">
            {overlap.map((s) => (
              <div key={s} className="text-[var(--hack-green)]">{s}</div>
            ))}
            {!overlap.length && <div className="text-muted-foreground/50 italic">none</div>}
          </div>
        </div>
        <div>
          <div className="text-[var(--hack-green)] font-mono mb-1">B only ({rightOnly.length})</div>
          <div className="space-y-0.5">
            {rightOnly.map((s) => (
              <div key={s} className="text-muted-foreground">{s}</div>
            ))}
            {!rightOnly.length && <div className="text-muted-foreground/50 italic">none</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
