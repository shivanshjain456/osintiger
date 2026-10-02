"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  TrendingUp,
  Target,
  Database,
  Star,
  Clock,
  Globe,
  Network,
  Wallet,
  User,
  Building2,
  ShieldAlert,
  History,
  Download,
  X,
} from "lucide-react";
import { fetchRecentWithFilters, type HistoryItem } from "@/lib/osint/client";
import { AnimatedStat } from "./AnimatedStat";
import { SourceAnalytics } from "./SourceAnalytics";
import { MultiVersionSection } from "./MultiVersionSection";

export function DashboardDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (id: string, target: string) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchRecentWithFilters("", "all", 200)
      .then((d) => {
        if (!cancelled) setItems(d.investigations);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Compute stats
  const stats = computeStats(items);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-card/95 backdrop-blur-xl border-[var(--hack-green)]/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-[var(--hack-green)]" />
            Intelligence Dashboard
          </DialogTitle>
          <DialogDescription className="sr-only">
            Aggregate statistics and activity timeline across all OSINT investigations.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Activity className="h-5 w-5 animate-pulse mr-2" /> Computing analytics…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Activity className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No investigations yet to analyze.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-5">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <AnimatedStat value={stats.total} label="Total Investigations" icon={Target} />
              <AnimatedStat value={stats.completed} label="Completed" icon={TrendingUp} />
              <AnimatedStat value={stats.starred} label="Starred" icon={Star} />
              <AnimatedStat
                value={parseFloat((stats.avgConfidence * 100).toFixed(0))}
                label="Avg Confidence %"
                icon={ShieldAlert}
              />
            </div>

            {/* Bulk export button */}
            <div className="flex justify-end">
              <a
                href="/api/export/all"
                className="inline-flex items-center gap-1.5  border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/10 px-3 py-1.5 text-xs text-[var(--hack-green)] transition hover:bg-[var(--hack-green)]/20"
              >
                <Download className="h-3.5 w-3.5" />
                Export All ({items.length})
              </a>
            </div>

            {/* Activity timeline chart */}
            <div className=" border border-white/10 bg-black/30 p-4">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-[var(--hack-green)]" />
                Activity Timeline
                <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                  last 14 days
                </span>
              </h3>
              <TimelineChart items={items} />
            </div>

            {/* Type distribution + source distribution */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className=" border border-white/10 bg-black/30 p-4">
                <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Database className="h-4 w-4 text-[var(--hack-green)]" />
                  Input Type Distribution
                </h3>
                <TypeDistribution items={items} />
              </div>
              <div className=" border border-white/10 bg-black/30 p-4">
                <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <ShieldAlert className="h-4 w-4 text-[var(--hack-green)]" />
                  Confidence Distribution
                </h3>
                <ConfidenceDistribution items={items} />
              </div>
            </div>

            {/* Source reliability analytics */}
            <div className=" border border-white/10 bg-black/30 p-4">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Database className="h-4 w-4 text-[var(--hack-green)]" />
                Source Reliability Analytics
                <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                  across all investigations
                </span>
              </h3>
              <SourceAnalytics />
            </div>

            {/* Multi-version targets */}
            <div className=" border border-white/10 bg-black/30 p-4">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <History className="h-4 w-4 text-[var(--hack-green)]" />
                Multi-Version Targets
                <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                  re-run trends
                </span>
              </h3>
              <MultiVersionSection onSelect={() => onOpenChange(false)} />
            </div>

            {/* Recent activity list */}
            <div className=" border border-white/10 bg-black/30 p-4">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Activity className="h-4 w-4 text-[var(--hack-green)]" />
                Recent Activity
                <span className="ml-auto text-[11px] font-mono text-muted-foreground">
                  {items.length} total
                </span>
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {items.slice(0, 10).map((item) => {
                  const Icon = TYPE_ICONS[item.input_type] || Globe;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelect(item.id, item.target);
                        onOpenChange(false);
                      }}
                      className="group flex w-full items-center gap-3  px-2 py-1.5 text-left transition hover:bg-[var(--hack-green)]/5"
                    >
                      <Icon className="h-3.5 w-3.5 text-[var(--hack-green)]/70 shrink-0" />
                      <span className="text-sm truncate flex-1">{item.target}</span>
                      {item.starred && <Star className="h-3 w-3 fill-var(--hack-green) text-[var(--hack-green)] shrink-0" />}
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.confidence != null && (
                        <span className="font-mono text-xs text-[var(--hack-green)] shrink-0 w-10 text-right">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TYPE_ICONS: Record<string, typeof User> = {
  person: User,
  organization: Building2,
  domain: Globe,
  ip: Network,
  wallet: Wallet,
};

interface Stats {
  total: number;
  completed: number;
  starred: number;
  avgConfidence: number;
}

function computeStats(items: HistoryItem[]): Stats {
  const total = items.length;
  const completed = items.filter((i) => i.status === "completed").length;
  const starred = items.filter((i) => i.starred).length;
  const confs = items.filter((i) => i.confidence != null).map((i) => i.confidence!);
  const avgConfidence = confs.length ? confs.reduce((s, c) => s + c, 0) / confs.length : 0;
  return { total, completed, starred, avgConfidence };
}

// Timeline chart — bar chart of investigations per day (last 14 days)
function TimelineChart({ items }: { items: HistoryItem[] }) {
  const days = 14;
  const now = new Date();
  const buckets: { date: Date; count: number; label: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const count = items.filter((it) => {
      const c = new Date(it.created_at);
      return c >= d && c < next;
    }).length;
    buckets.push({
      date: d,
      count,
      label: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
    });
  }
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  const W = 600;
  const H = 140;
  const PAD = { l: 8, r: 8, t: 10, b: 24 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const barW = chartW / buckets.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00ff41" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#00ff41" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {buckets.map((b, i) => {
        const h = (b.count / maxCount) * chartH;
        const x = PAD.l + i * barW + barW * 0.15;
        const w = barW * 0.7;
        const y = PAD.t + chartH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={w}
              height={Math.max(b.count > 0 ? 3 : 0, h)}
              fill="url(#timelineGrad)"
              rx={2}
              className="transition-all"
            >
              <title>{`${b.label}: ${b.count} investigation${b.count !== 1 ? "s" : ""}`}</title>
            </rect>
            {b.count > 0 && (
              <text x={x + w / 2} y={y - 3} textAnchor="middle" fontSize={9} fill="#00ff41" fontFamily="monospace" fontWeight="bold">
                {b.count}
              </text>
            )}
            {i % 2 === 0 && (
              <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)" fontFamily="monospace">
                {b.label}
              </text>
            )}
          </g>
        );
      })}
      {/* Baseline */}
      <line x1={PAD.l} y1={PAD.t + chartH} x2={W - PAD.r} y2={PAD.t + chartH} stroke="rgba(255,255,255,0.1)" strokeWidth={0.5} />
    </svg>
  );
}

// Type distribution — horizontal bars
function TypeDistribution({ items }: { items: HistoryItem[] }) {
  const counts: Record<string, number> = {};
  for (const it of items) {
    counts[it.input_type] = (counts[it.input_type] || 0) + 1;
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  const colors: Record<string, string> = {
    person: "#00ff41",
    organization: "#00ff41",
    domain: "#00ffff",
    ip: "#00ffff",
    wallet: "#00ffff",
  };
  return (
    <div className="space-y-2">
      {entries.map(([type, count]) => (
        <div key={type} className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase w-20 shrink-0 text-muted-foreground">{type}</span>
          <div className="flex-1 h-5 rounded bg-black/40 overflow-hidden">
            <div
              className="h-full rounded transition-all duration-700 flex items-center justify-end px-1.5"
              style={{ width: `${(count / max) * 100}%`, background: colors[type] || "#00ff41" }}
            >
              <span className="text-[10px] font-mono font-bold text-black">{count}</span>
            </div>
          </div>
        </div>
      ))}
      {entries.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
    </div>
  );
}

// Confidence distribution — bucketed into ranges
function ConfidenceDistribution({ items }: { items: HistoryItem[] }) {
  const ranges = [
    { label: "0-40%", min: 0, max: 0.4, color: "#ff0040" },
    { label: "40-60%", min: 0.4, max: 0.6, color: "#00ff41" },
    { label: "60-80%", min: 0.6, max: 0.8, color: "#ffb000" },
    { label: "80-100%", min: 0.8, max: 1.01, color: "#00ff41" },
  ];
  const counts = ranges.map((r) => ({
    ...r,
    count: items.filter((i) => i.confidence != null && i.confidence >= r.min && i.confidence < r.max).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <div className="space-y-2">
      {counts.map((c) => (
        <div key={c.label} className="flex items-center gap-2">
          <span className="text-xs font-mono w-16 shrink-0 text-muted-foreground">{c.label}</span>
          <div className="flex-1 h-5 rounded bg-black/40 overflow-hidden">
            <div
              className="h-full rounded transition-all duration-700 flex items-center justify-end px-1.5"
              style={{ width: `${(c.count / max) * 100}%`, background: c.color }}
            >
              {c.count > 0 && <span className="text-[10px] font-mono font-bold text-black">{c.count}</span>}
            </div>
          </div>
        </div>
      ))}
      {items.filter((i) => i.confidence != null).length === 0 && (
        <p className="text-xs text-muted-foreground">No confidence data yet</p>
      )}
    </div>
  );
}
