"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "./Sparkline";
import { History, Loader2, ChevronRight } from "lucide-react";

interface MultiVersionTarget {
  target: string;
  input_type: string;
  count: number;
  latest_confidence: number | null;
  latest_date: string;
  confidence_trend: number[];
}

export function MultiVersionSection({
  onSelect,
}: {
  onSelect: (target: string) => void;
}) {
  const [targets, setTargets] = useState<MultiVersionTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics/versions", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setTargets(data.multi_version_targets || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading multi-version targets…
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center italic">
        No targets with multiple versions yet. Re-run an investigation to see version trends here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {targets.map((t) => {
        const trend = t.confidence_trend.filter((v) => v > 0);
        const firstConf = trend[0] ?? 0;
        const lastConf = trend[trend.length - 1] ?? 0;
        const delta = lastConf - firstConf;
        return (
          <button
            key={t.target}
            onClick={() => onSelect(t.target)}
            className="group flex w-full items-center gap-3  border border-white/5 bg-black/20 px-3 py-2.5 text-left transition hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 fade-in"
          >
            <div className="flex h-8 w-8 items-center justify-center  bg-[var(--hack-green)]/10 ring-1 ring-var(--hack-green)/20 shrink-0">
              <History className="h-4 w-4 text-[var(--hack-green)]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{t.target}</span>
                <Badge variant="outline" className="text-[9px] border-[var(--hack-green)]/30 text-[var(--hack-cyan)] shrink-0">
                  {t.count} runs
                </Badge>
                <span className="font-mono text-[10px] uppercase text-muted-foreground shrink-0">{t.input_type}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {trend.length > 1 && (
                  <>
                    <Sparkline values={trend} width={70} height={18} />
                    <span className="text-[10px] text-muted-foreground">confidence trend</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-sm font-bold text-[var(--hack-green)]">
                {lastConf != null ? Math.round(lastConf * 100) + "%" : "—"}
              </div>
              {delta !== 0 && trend.length > 1 && (
                <div className={`text-[10px] font-mono ${delta > 0 ? "text-[var(--hack-green)]" : "text-[var(--hack-red)]"}`}>
                  {delta > 0 ? "↑" : "↓"} {Math.abs(Math.round(delta * 100))}%
                </div>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[var(--hack-green)] transition shrink-0" />
          </button>
        );
      })}
    </div>
  );
}
