"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, AlertTriangle, Loader2, XCircle, MinusCircle } from "lucide-react";
import type { SourceStatus } from "@/lib/osint/types";

const STATUS_META: Record<
  SourceStatus,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  loading: { label: "Querying", cls: "border-[var(--hack-green)]/40 text-[var(--hack-green)] bg-[var(--hack-green)]/10", Icon: Loader2 },
  success: { label: "OK", cls: "border-[var(--hack-green)]/40 text-[var(--hack-green)] bg-[var(--hack-green)]/10", Icon: CheckCircle2 },
  error: { label: "Error", cls: "border-[var(--hack-red)]/40 text-[var(--hack-red)] bg-[var(--hack-red)]/10", Icon: XCircle },
  timeout: { label: "Timeout", cls: "border-[var(--hack-red)]/40 text-[var(--hack-red)] bg-[var(--hack-red)]/10", Icon: AlertTriangle },
  skipped: { label: "Skipped", cls: "border-zinc-500/30 text-zinc-400 bg-zinc-500/5", Icon: MinusCircle },
};

export function SourceBadge({
  label,
  status,
  url,
  error,
  findingCount,
}: {
  label: string;
  status: SourceStatus;
  url?: string;
  error?: string;
  findingCount?: number;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;
  const inner = (
    <Badge
      variant="outline"
      className={`gap-1.5 font-mono text-[11px] px-2 py-0.5 ${meta.cls} ${status === "loading" ? "" : ""}`}
    >
      <Icon className={`h-3 w-3 ${status === "loading" ? "animate-spin" : ""}`} />
      <span className="truncate max-w-[140px]">{label}</span>
      {typeof findingCount === "number" && status === "success" && (
        <span className="opacity-70">·{findingCount}</span>
      )}
    </Badge>
  );
  if (!url && !error) return inner;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{inner}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1 text-xs">
            <div className="font-semibold">{label}</div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-[var(--hack-green)] hover:underline"
              >
                {url}
              </a>
            )}
            {error && <div className="text-[var(--hack-red)]">Error: {error}</div>}
            {typeof findingCount === "number" && (
              <div className="text-zinc-400">{findingCount} findings</div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
