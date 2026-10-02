"use client";

import { useMemo } from "react";
import type { CryptoTransaction } from "@/lib/osint/types";
import { TrendingUp, TrendingDown, Activity, Clock } from "lucide-react";

// Transaction timeline chart — shows ETH volume over time (in vs out)
export function CryptoTimeline({ transactions }: { transactions: CryptoTransaction[] }) {
  const data = useMemo(() => {
    if (!transactions.length) return null;
    // Group by month
    const byMonth = new Map<string, { in: number; out: number; count: number }>();
    for (const t of transactions) {
      const d = new Date(t.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = byMonth.get(key) || { in: 0, out: 0, count: 0 };
      if (t.direction === "in") existing.in += t.value_eth;
      else existing.out += t.value_eth;
      existing.count++;
      byMonth.set(key, existing);
    }
    const sorted = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
    const maxVal = Math.max(
      1,
      ...sorted.map(([, v]) => Math.max(v.in, v.out))
    );
    return { sorted, maxVal, total: transactions.length };
  }, [transactions]);

  if (!data) {
    return (
      <div className=" border border-white/10 bg-black/20 p-6 text-center text-sm text-muted-foreground">
        No transaction data for timeline.
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const PAD = { l: 40, r: 12, t: 14, b: 28 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const barGroupW = chartW / Math.max(1, data.sorted.length);
  const barW = Math.min(14, barGroupW * 0.35);

  return (
    <div className=" border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--hack-green)]" />
          Transaction Timeline
        </h4>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-[var(--hack-green)]" /> Inflow
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-[var(--hack-red)]" /> Outflow
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <defs>
          <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00ff41" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#00ff41" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff0040" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff0040" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = PAD.t + chartH * (1 - p);
          return (
            <g key={p}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
              <text x={PAD.l - 6} y={y + 3} textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.4)" fontFamily="monospace">
                {(data.maxVal * p).toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.sorted.map(([month, v], i) => {
          const x = PAD.l + i * barGroupW + barGroupW / 2;
          const inH = (v.in / data.maxVal) * chartH;
          const outH = (v.out / data.maxVal) * chartH;
          const baseline = PAD.t + chartH;
          return (
            <g key={month}>
              <rect
                x={x - barW - 1}
                y={baseline - inH}
                width={barW}
                height={Math.max(1, inH)}
                fill="url(#inflowGrad)"
                rx={1.5}
              >
                <title>{month}: {v.in.toFixed(3)} ETH inflow ({v.count} txs)</title>
              </rect>
              <rect
                x={x + 1}
                y={baseline - outH}
                width={barW}
                height={Math.max(1, outH)}
                fill="url(#outflowGrad)"
                rx={1.5}
              >
                <title>{month}: {v.out.toFixed(3)} ETH outflow</title>
              </rect>
              {i % Math.ceil(data.sorted.length / 6) === 0 && (
                <text x={x} y={H - 10} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.5)" fontFamily="monospace">
                  {month.slice(2)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Activity heatmap — day-of-week × hour-of-day pattern
export function CryptoHeatmap({ transactions }: { transactions: CryptoTransaction[] }) {
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const t of transactions) {
      const d = new Date(t.timestamp);
      g[d.getDay()][d.getHours()]++;
    }
    return g;
  }, [transactions]);

  const max = Math.max(1, ...grid.flat());
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className=" border border-white/10 bg-black/20 p-4">
      <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
        <Clock className="h-4 w-4 text-[var(--hack-green)]" />
        Activity Pattern Heatmap
      </h4>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <div className="flex">
            <div className="w-8 shrink-0" />
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="flex-1 text-center text-[8px] font-mono text-muted-foreground/60 min-w-[14px]">
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>
          {grid.map((row, d) => (
            <div key={d} className="flex items-center">
              <div className="w-8 shrink-0 text-[9px] font-mono text-muted-foreground/70">{days[d]}</div>
              {row.map((count, h) => {
                const intensity = count / max;
                const bg =
                  intensity === 0
                    ? "rgba(255,255,255,0.03)"
                    : intensity < 0.33
                    ? `rgba(245,158,11,${0.2 + intensity * 0.3})`
                    : intensity < 0.66
                    ? `rgba(245,158,11,${0.4 + intensity * 0.4})`
                    : `rgba(249,115,22,${0.6 + intensity * 0.4})`;
                return (
                  <div
                    key={h}
                    className="h-4 flex-1 min-w-[14px] m-[1px] rounded-sm transition hover:ring-1 hover:ring-var(--hack-green)"
                    style={{ background: bg }}
                    title={`${days[d]} ${h}:00 — ${count} transactions`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-[2px]">
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
            <div key={i} className="h-2 w-3 rounded-sm" style={{ background: `rgba(245,158,11,${0.2 + i * 0.7})` }} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

// Flow summary — net flow, largest tx, averages
export function CryptoFlowStats({ transactions }: { transactions: CryptoTransaction[] }) {
  const stats = useMemo(() => {
    const ethTx = transactions.filter((t) => !t.token && t.value_eth > 0);
    const inflow = ethTx.filter((t) => t.direction === "in").reduce((s, t) => s + t.value_eth, 0);
    const outflow = ethTx.filter((t) => t.direction === "out").reduce((s, t) => s + t.value_eth, 0);
    const largest = ethTx.reduce((max, t) => (t.value_eth > max.value_eth ? t : max), ethTx[0]);
    const avg = ethTx.length ? (inflow + outflow) / ethTx.length : 0;
    return { inflow, outflow, net: inflow - outflow, largest, avg, count: ethTx.length };
  }, [transactions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <FlowCard
        icon={TrendingDown}
        label="Total Inflow"
        value={`${stats.inflow.toFixed(3)} ETH`}
        cls="text-[var(--hack-green)]"
      />
      <FlowCard
        icon={TrendingUp}
        label="Total Outflow"
        value={`${stats.outflow.toFixed(3)} ETH`}
        cls="text-[var(--hack-red)]"
      />
      <FlowCard
        icon={Activity}
        label="Net Flow"
        value={`${stats.net >= 0 ? "+" : ""}${stats.net.toFixed(3)} ETH`}
        cls={stats.net >= 0 ? "text-[var(--hack-green)]" : "text-[var(--hack-red)]"}
      />
      <FlowCard
        icon={TrendingUp}
        label="Avg Tx Size"
        value={`${stats.avg.toFixed(4)} ETH`}
        cls="text-[var(--hack-green)]"
      />
      {stats.largest && (
        <div className="col-span-2 md:col-span-4  border border-[var(--hack-green)]/20 bg-[var(--hack-green)]/5 p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--hack-green)]/70 mb-1">Largest Transaction</div>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-mono text-[var(--hack-cyan)]">{stats.largest.value_eth.toFixed(4)} ETH</span>
            <span className="text-[11px] text-muted-foreground">
              {stats.largest.direction === "in" ? "from" : "to"}{" "}
              <span className="font-mono">{(stats.largest.direction === "in" ? stats.largest.from : stats.largest.to).slice(0, 12)}…</span>
            </span>
            <span className="text-[11px] text-muted-foreground">{new Date(stats.largest.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FlowCard({
  icon: Icon,
  label,
  value,
  cls,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  cls: string;
}) {
  return (
    <div className=" border border-white/10 bg-black/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`mt-1 font-mono text-base font-bold ${cls}`}>{value}</div>
    </div>
  );
}
