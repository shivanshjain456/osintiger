"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link2 } from "lucide-react";
import { HighlightedText } from "./HighlightedText";

// Renders an inline [SOURCE: label, URL: url] tag as a clickable chip with tooltip.
export function AttributionTag({ source, url }: { source: string; url: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="attr-chip inline-flex items-center gap-1 rounded border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/10 px-1.5 py-0.5 text-[var(--hack-green)] transition hover:bg-[var(--hack-green)]/20 hover:border-[var(--hack-green)]/50 align-middle"
            onClick={(e) => e.stopPropagation()}
          >
            <Link2 className="h-2.5 w-2.5" />
            <span className="truncate max-w-[120px]">{source}</span>
          </a>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="text-xs">
            <div className="font-semibold text-[var(--hack-green)]">Source attribution</div>
            <div className="break-all text-zinc-300">{url}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Splits a claim string on [SOURCE: ...] markers and renders chips inline.
// Optional `highlight` prop highlights matching keywords in the claim text.
export function ClaimText({
  text,
  fallbackSource,
  fallbackUrl,
  highlight,
}: {
  text: string;
  fallbackSource?: string;
  fallbackUrl?: string;
  highlight?: string;
}) {
  const parts = text.split(/(\[SOURCE:\s*[^,\]]+,\s*URL:\s*[^\]]+\])/gi);
  return (
    <span>
      {parts.map((p, i) => {
        const m = p.match(/\[SOURCE:\s*([^,\]]+),\s*URL:\s*([^\]]+)\]/i);
        if (m) {
          return <AttributionTag key={i} source={m[1].trim()} url={m[2].trim()} />;
        }
        if (highlight && highlight.trim()) {
          return <HighlightedText key={i} text={p} query={highlight} />;
        }
        return <span key={i}>{p}</span>;
      })}
      {fallbackSource && fallbackUrl && parts.length <= 1 && (
        <>
          {" "}
          <AttributionTag source={fallbackSource} url={fallbackUrl} />
        </>
      )}
    </span>
  );
}
