"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkline } from "./Sparkline";
import { DiffDialog } from "./DiffDialog";
import { History, TrendingUp, TrendingDown, ChevronRight, Loader2, GitCompare } from "lucide-react";

interface Version {
  version: number;
  id: string;
  target: string;
  created_at: string;
  completed_at?: string;
  status: string;
  confidence: number | null;
  key_findings_count: number;
  sources_count: number;
  input_type: string;
  starred: boolean;
}

export function VersionHistory({
  target,
  currentId,
  onSelect,
}: {
  target: string;
  currentId: string;
  onSelect: (id: string, target: string) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [diffOpen, setDiffOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/analytics/versions?target=${encodeURIComponent(target)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setVersions(data.versions || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading versions…
      </div>
    );
  }

  if (versions.length <= 1) return null;

  const current = versions.find((v) => v.id === currentId);
  const currentIndex = versions.findIndex((v) => v.id === currentId);
  const prev = currentIndex > 0 ? versions[currentIndex - 1] : null;
  const confidenceDelta =
    current?.confidence != null && prev?.confidence != null
      ? current.confidence - prev.confidence
      : null;

  const sparkValues = versions
    .map((v) => v.confidence ?? 0)
    .filter((v) => v > 0);

  return (
    <div className=" border border-[var(--hack-green)]/20 bg-[var(--hack-green)]/5 p-3 fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--hack-green)]" />
          <span className="text-sm font-medium">Version History</span>
          <Badge variant="outline" className="text-[9px] border-[var(--hack-green)]/30 text-[var(--hack-cyan)]">
            {versions.length} runs
          </Badge>
        </div>
        {sparkValues.length > 1 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkline values={sparkValues} width={60} height={18} />
              <span className="text-[10px] uppercase text-muted-foreground">confidence trend</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDiffOpen(true)}
              className="h-7 text-[11px] border-[var(--hack-green)]/30 text-[var(--hack-green)] hover:bg-[var(--hack-green)]/10"
            >
              <GitCompare className="h-3 w-3" />
              Compare Versions
            </Button>
          </div>
        )}
      </div>

      {confidenceDelta != null && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">vs previous run:</span>
          <span
            className={`flex items-center gap-0.5 font-mono font-semibold ${
              confidenceDelta > 0
                ? "text-[var(--hack-green)]"
                : confidenceDelta < 0
                ? "text-[var(--hack-red)]"
                : "text-muted-foreground"
            }`}
          >
            {confidenceDelta > 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : confidenceDelta < 0 ? (
              <TrendingDown className="h-3 w-3" />
            ) : null}
            {confidenceDelta > 0 ? "+" : ""}
            {Math.round(confidenceDelta * 100)}%
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {versions.map((v, i) => {
          const isCurrent = v.id === currentId;
          return (
            <button
              key={v.id}
              onClick={() => !isCurrent && onSelect(v.id, v.target)}
              disabled={isCurrent}
              className={`flex items-center gap-1.5  border px-2 py-1 text-[11px] transition ${
                isCurrent
                  ? "border-[var(--hack-green)]/50 bg-[var(--hack-green)]/15 text-[var(--hack-cyan)] cursor-default"
                  : "border-white/10 bg-black/30 text-muted-foreground hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)]"
              }`}
              title={`v${v.version} — ${new Date(v.created_at).toLocaleString()}`}
            >
              <span className="font-mono">v{v.version}</span>
              {v.confidence != null && (
                <span className="font-mono font-semibold">{Math.round(v.confidence * 100)}%</span>
              )}
              {v.starred && <span className="text-[var(--hack-green)]">★</span>}
              {!isCurrent && <ChevronRight className="h-2.5 w-2.5 opacity-50" />}
            </button>
          );
        })}
      </div>

      <DiffDialog open={diffOpen} onOpenChange={setDiffOpen} target={target} />
    </div>
  );
}
