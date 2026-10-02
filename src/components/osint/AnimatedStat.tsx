"use client";

import { useCountUp } from "@/hooks/use-count-up";

// Animated stat counter — counts up from 0 when scrolled into view.
export function AnimatedStat({
  value,
  label,
  suffix = "",
  decimals = 0,
  icon: Icon,
}: {
  value: number;
  label: string;
  suffix?: string;
  decimals?: number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const { value: v, ref } = useCountUp(value, 1100);
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className=" border border-white/10 bg-black/20 p-3 transition hover:border-[var(--hack-green)]/30 hover:bg-[var(--hack-green)]/5"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xl font-bold text-[var(--hack-green)] tabular-nums">
        {v.toFixed(decimals)}
        {suffix}
      </div>
    </div>
  );
}
