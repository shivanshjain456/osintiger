"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, XCircle, AlertTriangle, MinusCircle } from "lucide-react";
import type { PipelineStep, SourceStatus } from "@/lib/osint/types";

const ICONS: Record<SourceStatus, typeof CheckCircle2> = {
  loading: Loader2,
  success: CheckCircle2,
  error: XCircle,
  timeout: AlertTriangle,
  skipped: MinusCircle,
};

export function PipelineStepper({ steps, current }: { steps: PipelineStep[]; current: number }) {
  return (
    <ol className="relative space-y-1">
      {steps.map((step, i) => {
        const Icon = ICONS[step.status];
        const isCurrent = i === current - 1 && step.status === "loading";
        const done = step.status === "success";
        const failed = step.status === "error" || step.status === "timeout";
        return (
          <li
            key={step.id}
            className={cn(
              "relative flex items-start gap-3  px-3 py-2.5 transition-all",
              isCurrent && "bg-[var(--hack-green)]/10 ring-1 ring-var(--hack-green)/30",
              done && "opacity-90",
              step.status === "skipped" && "opacity-40"
            )}
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center  ring-1 text-[10px] font-mono",
                  done && "bg-[var(--hack-green)]/15 text-[var(--hack-green)] ring-var(--hack-green)/40",
                  isCurrent && "bg-[var(--hack-green)]/20 text-[var(--hack-green)] ring-var(--hack-green)/50",
                  failed && "bg-[var(--hack-red)]/15 text-[var(--hack-red)] ring-var(--hack-red)/40",
                  step.status === "skipped" && "bg-zinc-700/40 text-zinc-500 ring-zinc-600/30"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", isCurrent && "animate-spin")} />
              </div>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "w-px flex-1 min-h-[14px] mt-1",
                    done ? "bg-[var(--hack-green)]/40" : "bg-white/10"
                  )}
                />
              )}
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  <span className="font-mono text-[10px] text-muted-foreground mr-1.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {step.label}
                </span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-mono",
                    done && "text-[var(--hack-green)]",
                    isCurrent && "text-[var(--hack-green)]",
                    failed && "text-[var(--hack-red)]",
                    step.status === "skipped" && "text-zinc-500"
                  )}
                >
                  {step.status}
                </span>
              </div>
              {step.detail && (
                <p className="mt-0.5 text-xs text-muted-foreground font-mono break-words">
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
