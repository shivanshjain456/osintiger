"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, Database, TrendingUp } from "lucide-react";

interface SourceStat {
  source: string;
  source_label: string;
  times_consulted: number;
  success_count: number;
  error_count: number;
  total_findings: number;
  avg_findings: number;
  avg_confidence: number;
}

export function SourceAnalytics() {
  const [stats, setStats] = useState<SourceStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analytics/sources", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStats(data.sources || []);
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
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Computing source analytics…
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">No source data available.</p>
    );
  }

  const maxFindings = Math.max(1, ...stats.map((s) => s.total_findings));

  return (
    <div className="space-y-1.5">
      {stats.map((s) => {
        const successRate = s.times_consulted > 0 ? (s.success_count / s.times_consulted) * 100 : 0;
        return (
          <div
            key={s.source}
            className=" border border-white/5 bg-black/20 p-2.5 fade-in"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-medium truncate">{s.source_label}</span>
              <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
                <span className="text-[var(--hack-green)]">{s.total_findings} findings</span>
                <span className="text-muted-foreground">·</span>
                <span className={successRate >= 80 ? "text-[var(--hack-green)]" : successRate >= 50 ? "text-[var(--hack-green)]" : "text-[var(--hack-red)]"}>
                  {Math.round(successRate)}% ok
                </span>
              </div>
            </div>
            {/* Findings bar */}
            <div className="h-1.5 w-full overflow-hidden  bg-black/40">
              <div
                className="h-full  bg-gradient-to-r from-var(--hack-green) to-var(--hack-green) transition-all duration-700"
                style={{ width: `${(s.total_findings / maxFindings) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              <span>{s.times_consulted} consultations</span>
              {s.error_count > 0 && <span className="text-[var(--hack-red)]/70">{s.error_count} errors</span>}
              <span>avg {s.avg_findings}/run</span>
              {s.avg_confidence > 0 && (
                <span className="flex items-center gap-0.5">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {Math.round(s.avg_confidence * 100)}% conf
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
