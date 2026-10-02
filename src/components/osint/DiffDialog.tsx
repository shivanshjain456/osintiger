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
import { GitCompare, Loader2, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { pollInvestigation, type PollResponse } from "@/lib/osint/client";
import { ConfidenceMeter } from "./ConfidenceMeter";

interface Version {
  version: number;
  id: string;
  target: string;
  created_at: string;
  confidence: number | null;
  key_findings_count: number;
  sources_count: number;
  input_type: string;
}

export function DiffDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target?: string;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [leftPoll, setLeftPoll] = useState<PollResponse | null>(null);
  const [rightPoll, setRightPoll] = useState<PollResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(0);
  const leftTokenRef = useRef(0);
  const rightTokenRef = useRef(0);

  // Load versions when dialog opens
  useEffect(() => {
    if (!open || !target) return;
    let cancelled = false;
    fetch(`/api/analytics/versions?target=${encodeURIComponent(target)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const vers = data.versions || [];
        setVersions(vers);
        if (vers.length >= 2) {
          setLeftId(vers[0].id);
          setRightId(vers[vers.length - 1].id);
          void loadPoll(vers[0].id, "left");
          void loadPoll(vers[vers.length - 1].id, "right");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, target]);

  async function loadPoll(id: string, side: "left" | "right") {
    if (!id) return;
    const myToken = ++loadingRef.current;
    const sideToken = side === "left" ? ++leftTokenRef.current : ++rightTokenRef.current;
    setLoading(true);
    try {
      const p = await pollInvestigation(id);
      // Only apply if this is the latest request for this side
      const currentSideToken = side === "left" ? leftTokenRef.current : rightTokenRef.current;
      if (sideToken !== currentSideToken) return;
      if (side === "left") setLeftPoll(p);
      else setRightPoll(p);
    } catch {
      // ignore
    } finally {
      // Clear loading when this is the most recent overall request
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
  const hasData = leftReport && rightReport;

  // Compute finding diffs
  const leftFindings = leftReport?.key_findings || [];
  const rightFindings = rightReport?.key_findings || [];
  const maxFindings = Math.max(leftFindings.length, rightFindings.length);

  // Compute source diffs
  const leftSources = new Set((leftReport?.sources_consulted || []).map((s) => s.source));
  const rightSources = new Set((rightReport?.sources_consulted || []).map((s) => s.source));
  const sharedSources = [...leftSources].filter((s) => rightSources.has(s));
  const leftOnlySources = [...leftSources].filter((s) => !rightSources.has(s));
  const rightOnlySources = [...rightSources].filter((s) => !leftSources.has(s));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-card/95 backdrop-blur-xl border-[var(--hack-green)]/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <GitCompare className="h-5 w-5 text-[var(--hack-green)]" />
            Version Diff
            {target && <span className="text-sm text-muted-foreground font-normal">— {target}</span>}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Compare two investigation versions of the same target side-by-side.
          </DialogDescription>
        </DialogHeader>

        {versions.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <GitCompare className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Need at least 2 versions to compare.</p>
            <p className="text-xs mt-1">This target has {versions.length} version{versions.length !== 1 ? "s" : ""}.</p>
          </div>
        ) : (
          <>
            {/* Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-end pb-3 border-b border-white/10">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
                  Version A (older)
                </label>
                <Select value={leftId} onValueChange={handleLeftChange}>
                  <SelectTrigger className="bg-black/40">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version} — {new Date(v.created_at).toLocaleDateString()} ({v.confidence != null ? Math.round(v.confidence * 100) + "%" : "?"})
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
                  Version B (newer)
                </label>
                <Select value={rightId} onValueChange={handleRightChange}>
                  <SelectTrigger className="bg-black/40">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        v{v.version} — {new Date(v.created_at).toLocaleDateString()} ({v.confidence != null ? Math.round(v.confidence * 100) + "%" : "?"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto -mr-2 pr-2 mt-3">
              {loading || !hasData ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading versions…
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Metric diffs */}
                  <div className=" border border-white/10 bg-black/30 p-4">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                      Metric Changes
                    </h4>
                    <div className="space-y-2">
                      <DiffRow
                        label="Confidence"
                        left={`${Math.round((leftReport!.confidence_score || 0) * 100)}%`}
                        right={`${Math.round((rightReport!.confidence_score || 0) * 100)}%`}
                        numeric
                      />
                      <DiffRow
                        label="Key Findings"
                        left={String(leftFindings.length)}
                        right={String(rightFindings.length)}
                        numeric
                      />
                      <DiffRow
                        label="Sources"
                        left={String(leftReport!.sources_consulted.length)}
                        right={String(rightReport!.sources_consulted.length)}
                        numeric
                      />
                      <DiffRow
                        label="Hypotheses"
                        left={String(leftReport!.ach_analysis.hypotheses.length)}
                        right={String(rightReport!.ach_analysis.hypotheses.length)}
                        numeric
                      />
                      <DiffRow
                        label="Geo Signals"
                        left={String(leftReport!.geopoints.length)}
                        right={String(rightReport!.geopoints.length)}
                        numeric
                      />
                    </div>
                  </div>

                  {/* Source changes */}
                  <div className=" border border-white/10 bg-black/30 p-4">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                      Source Changes
                    </h4>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-[var(--hack-red)] font-mono mb-1">Removed ({leftOnlySources.length})</div>
                        <div className="space-y-0.5">
                          {leftOnlySources.map((s) => (
                            <div key={s} className="text-muted-foreground line-through">{s}</div>
                          ))}
                          {!leftOnlySources.length && <div className="text-muted-foreground/50 italic">none</div>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--hack-green)] font-mono mb-1">Shared ({sharedSources.length})</div>
                        <div className="space-y-0.5">
                          {sharedSources.map((s) => (
                            <div key={s} className="text-[var(--hack-green)]/80">{s}</div>
                          ))}
                          {!sharedSources.length && <div className="text-muted-foreground/50 italic">none</div>}
                        </div>
                      </div>
                      <div>
                        <div className="text-[var(--hack-green)] font-mono mb-1">Added ({rightOnlySources.length})</div>
                        <div className="space-y-0.5">
                          {rightOnlySources.map((s) => (
                            <div key={s} className="text-[var(--hack-cyan)]/80">{s}</div>
                          ))}
                          {!rightOnlySources.length && <div className="text-muted-foreground/50 italic">none</div>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Findings comparison */}
                  <div className=" border border-white/10 bg-black/30 p-4">
                    <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                      Findings Comparison ({maxFindings} total)
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] uppercase text-[var(--hack-green)]/70 mb-1.5">
                          Version A — {leftFindings.length} findings
                        </div>
                        <div className="space-y-1.5">
                          {leftFindings.slice(0, 8).map((f, i) => (
                            <div key={i} className="rounded border border-white/5 bg-black/30 p-2 text-[11px]">
                              <div className="line-clamp-2">{f.claim.replace(/\[SOURCE:[^\]]*\]/gi, "").trim()}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-mono text-[9px] text-[var(--hack-green)]/60">{Math.round(f.confidence * 100)}%</span>
                                <span className="font-mono text-[9px] text-muted-foreground">{f.source}</span>
                              </div>
                            </div>
                          ))}
                          {leftFindings.length > 8 && (
                            <div className="text-[10px] text-muted-foreground/50">+{leftFindings.length - 8} more…</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase text-[var(--hack-green)]/70 mb-1.5">
                          Version B — {rightFindings.length} findings
                        </div>
                        <div className="space-y-1.5">
                          {rightFindings.slice(0, 8).map((f, i) => (
                            <div key={i} className="rounded border border-white/5 bg-black/30 p-2 text-[11px]">
                              <div className="line-clamp-2">{f.claim.replace(/\[SOURCE:[^\]]*\]/gi, "").trim()}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="font-mono text-[9px] text-[var(--hack-green)]/60">{Math.round(f.confidence * 100)}%</span>
                                <span className="font-mono text-[9px] text-muted-foreground">{f.source}</span>
                              </div>
                            </div>
                          ))}
                          {rightFindings.length > 8 && (
                            <div className="text-[10px] text-muted-foreground/50">+{rightFindings.length - 8} more…</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Hypothesis comparison */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className=" border border-white/10 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--hack-green)]/70 mb-2">
                        Top Hypothesis — v{versions.find((v) => v.id === leftId)?.version}
                      </div>
                      {leftReport!.ach_analysis.hypotheses[0] ? (
                        <div>
                          <p className="text-sm font-medium">{leftReport!.ach_analysis.hypotheses[0].statement}</p>
                          <div className="mt-2 w-32">
                            <ConfidenceMeter value={leftReport!.ach_analysis.hypotheses[0].confidence} size="sm" showLabel={false} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No hypotheses</p>
                      )}
                    </div>
                    <div className=" border border-white/10 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[var(--hack-green)]/70 mb-2">
                        Top Hypothesis — v{versions.find((v) => v.id === rightId)?.version}
                      </div>
                      {rightReport!.ach_analysis.hypotheses[0] ? (
                        <div>
                          <p className="text-sm font-medium">{rightReport!.ach_analysis.hypotheses[0].statement}</p>
                          <div className="mt-2 w-32">
                            <ConfidenceMeter value={rightReport!.ach_analysis.hypotheses[0].confidence} size="sm" showLabel={false} />
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiffRow({
  label,
  left,
  right,
  numeric,
}: {
  label: string;
  left: string;
  right: string;
  numeric?: boolean;
}) {
  const leftNum = numeric ? parseFloat(left) : NaN;
  const rightNum = numeric ? parseFloat(right) : NaN;
  const delta = !isNaN(leftNum) && !isNaN(rightNum) ? rightNum - leftNum : null;
  const increased = delta != null && delta > 0;
  const decreased = delta != null && delta < 0;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="font-mono text-right">{left}</span>
      <span className="text-muted-foreground/40 text-xs">→</span>
      <span className={`font-mono text-right ${increased ? "text-[var(--hack-green)] font-bold" : decreased ? "text-[var(--hack-red)] font-bold" : ""}`}>
        {right}
      </span>
      <span className="w-12 text-right">
        {delta != null && delta !== 0 && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${increased ? "text-[var(--hack-green)]" : "text-[var(--hack-red)]"}`}>
            {increased ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {increased ? "+" : ""}{delta.toFixed(left.includes("%") ? 0 : 0)}
          </span>
        )}
        {delta === 0 && <Minus className="h-2.5 w-2.5 text-muted-foreground/40" />}
      </span>
    </div>
  );
}
