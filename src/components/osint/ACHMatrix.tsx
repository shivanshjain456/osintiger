"use client";

import { cn } from "@/lib/utils";
import type { ACHAnalysis } from "@/lib/osint/types";

const CELL_META = {
  consistent: { label: "C", cls: "bg-[var(--hack-green)]/20 text-[var(--hack-green)] border-[var(--hack-green)]/40" },
  inconsistent: { label: "I", cls: "bg-[var(--hack-red)]/20 text-[var(--hack-red)] border-[var(--hack-red)]/40" },
  neutral: { label: "N", cls: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30" },
} as const;

export function ACHMatrix({ analysis }: { analysis: ACHAnalysis }) {
  const { hypotheses, evidence, matrix } = analysis;
  if (!hypotheses.length) {
    return <p className="text-sm text-muted-foreground">No competing hypotheses generated.</p>;
  }
  return (
    <div className="space-y-4">
      {/* Hypotheses ranked */}
      <div className="space-y-2">
        {hypotheses.map((h, i) => (
          <div
            key={h.id}
            className={cn(
              " border p-3 fade-in",
              i === 0
                ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5"
                : "border-white/10 bg-black/20"
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-[var(--hack-green)]">{h.id}</span>
                  {i === 0 && (
                    <span className="rounded bg-[var(--hack-green)]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--hack-green)]">
                      Most supported
                    </span>
                  )}
                  {i === hypotheses.length - 1 && hypotheses.length > 1 && (
                    <span className="rounded bg-[var(--hack-red)]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--hack-red)]">
                      Least supported
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-medium">{h.statement}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-lg font-bold text-[var(--hack-green)]">
                  {Math.round(h.confidence * 100)}%
                </div>
                <div className="text-[10px] uppercase text-muted-foreground">confidence</div>
              </div>
            </div>
            {/* Confidence bar */}
            <div className="mt-2 h-1 w-full overflow-hidden  bg-black/40">
              <div
                className={`h-full  transition-all duration-700 ${
                  h.confidence >= 0.7 ? "bg-[var(--hack-green)]" : h.confidence >= 0.4 ? "bg-[var(--hack-green)]" : "bg-[var(--hack-red)]"
                }`}
                style={{ width: `${Math.round(h.confidence * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{h.rationale}</p>
          </div>
        ))}
      </div>

      {/* Evidence × Hypothesis matrix */}
      {evidence.length > 0 && (
        <div className="overflow-x-auto  border border-white/10">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-black/30">
                <th className="sticky left-0 bg-black/30 p-2 text-left font-medium text-muted-foreground min-w-[220px] max-w-[300px]">
                  Evidence
                </th>
                {hypotheses.map((h) => (
                  <th key={h.id} className="p-2 text-center font-mono text-[var(--hack-green)] min-w-[60px]">
                    {h.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {evidence.map((ev, ei) => (
                <tr key={ei} className="border-t border-white/5">
                  <td className="p-2 text-left align-top max-w-[300px]">
                    <div className="line-clamp-2 text-[11px]">{ev.text}</div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{ev.source}</div>
                  </td>
                  {hypotheses.map((_, hi) => {
                    const cell = matrix[ei]?.[hi];
                    const meta = cell ? CELL_META[cell.consistency] : CELL_META.neutral;
                    return (
                      <td key={hi} className="p-2 text-center">
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded border font-mono text-[11px] font-bold",
                            meta.cls
                          )}
                          title={cell?.consistency || "neutral"}
                        >
                          {meta.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/20 text-[var(--hack-green)]">C</span>
          Consistent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/20 text-[var(--hack-red)]">I</span>
          Inconsistent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-zinc-500/30 bg-zinc-500/10 text-zinc-400">N</span>
          Neutral
        </span>
      </div>
    </div>
  );
}
