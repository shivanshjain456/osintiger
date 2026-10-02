"use client";

import { cn } from "@/lib/utils";

function colorFor(pct: number) {
  if (pct >= 0.75) return { bar: "bg-[var(--hack-green)]", text: "text-[var(--hack-green)]", glow: "glow-green" };
  if (pct >= 0.45) return { bar: "bg-[var(--hack-green)]", text: "text-[var(--hack-green)]", glow: "" };
  return { bar: "bg-[var(--hack-red)]", text: "text-[var(--hack-red)]", glow: "" };
}

export function ConfidenceMeter({
  value,
  label,
  size = "md",
  showLabel = true,
}: {
  value: number; // 0..1
  label?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const pctNum = Math.round(pct * 100);
  const c = colorFor(pct);
  const h = size === "lg" ? "h-3" : size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {label || "Confidence"}
          </span>
          <span className={cn("font-mono text-xs font-semibold", c.text)}>{pctNum}%</span>
        </div>
      )}
      <div className={cn("w-full overflow-hidden  bg-black/40 ring-1 ring-white/5", h)}>
        <div
          className={cn("h-full  transition-all duration-700", c.bar, c.glow)}
          style={{ width: `${pctNum}%` }}
        />
      </div>
    </div>
  );
}

export function ConfidenceRing({
  value,
  size = 120,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  const c = colorFor(pct);
  const stroke =
    pct >= 0.75 ? "#00ff41" : pct >= 0.45 ? "#00ff41" : "#ff0040";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-mono text-2xl font-bold", c.text)}>
          {Math.round(pct * 100)}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label || "confidence"}
        </span>
      </div>
    </div>
  );
}
