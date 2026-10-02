"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Radio, ChevronDown, ChevronRight, AlertTriangle, Plus, Minus, RefreshCw, Clock, Activity } from "lucide-react";
import type { MonitorPollResponse, ChangeAlert, MonitorSnapshot } from "@/lib/osint/client";
import { pollMonitor, triggerMonitorScan } from "@/lib/osint/client";

interface Props {
  id: string;
  target: string;
  onHome: () => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10",
  high: "text-[var(--hack-orange)] border-[var(--hack-orange)]/40 bg-[var(--hack-orange)]/10",
  medium: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10",
  low: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
  info: "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20",
};

const CHANGE_ICONS: Record<string, React.ElementType> = {
  addition: Plus, removal: Minus, modification: RefreshCw, new_discovery: AlertTriangle,
};

const CATEGORY_LABELS: Record<string, string> = {
  news: "News", dns: "DNS", whois: "WHOIS", certificates: "Certificates",
  github: "GitHub", leaks: "Leaks", security_advisories: "Security Advisories",
};

export function LiveMonitoringView({ id, target, onHome }: Props) {
  const [poll, setPoll] = useState<MonitorPollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"alerts" | "snapshots">("alerts");
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function pollLoop() {
      if (cancelledRef.current) return;
      try {
        const data = await pollMonitor(id);
        if (cancelledRef.current) return;
        setPoll(data);
        setError(null);
        if (data.status === "active") {
          const delay = 5000;
          timeoutId = setTimeout(pollLoop, delay);
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : "Poll failed");
        timeoutId = setTimeout(pollLoop, 5000);
      }
    }
    pollLoop();
    return () => { cancelledRef.current = true; if (timeoutId) clearTimeout(timeoutId); };
  }, [id]);

  async function manualScan() {
    setScanning(true);
    try { await triggerMonitorScan(id); } catch { /* ignore */ }
    finally { setScanning(false); }
  }

  if (!poll && !error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--hack-green)]" />
          <span className="font-mono text-sm text-[var(--hack-gray)]">{"» initializing live monitoring..."}</span>
        </div>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-[var(--hack-red)] mx-auto" />
          <p className="font-mono text-sm text-[var(--hack-red)]">{error}</p>
          <Button onClick={onHome} variant="outline" size="sm">Back to Home</Button>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const isRunning = poll.status === "active";
  const stats = poll.stats;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button onClick={onHome} variant="ghost" size="sm" className="text-[var(--hack-gray)] hover:text-[var(--hack-green)]">
            ←
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Radio className={`h-5 w-5 ${isRunning ? "text-[var(--hack-green)]" : "text-[var(--hack-gray)]"}`} />
              <h1 className="text-xl font-bold font-mono text-[var(--hack-green)]">Live Monitoring</h1>
              {isRunning && <span className="h-2 w-2 rounded-full bg-[var(--hack-green)] animate-pulse" />}
              <span className={`font-mono text-[9px] px-2 py-0.5 border ${isRunning ? "text-[var(--hack-green)] border-[var(--hack-green)]/40" : "text-[var(--hack-gray)] border-[var(--hack-border)]"}`}>
                {poll.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-[var(--hack-gray)] font-mono mt-0.5">{poll.target} · {poll.config.categories.length} categories</p>
          </div>
        </div>
        <Button onClick={manualScan} disabled={scanning} size="sm" className="bg-[var(--hack-green)]/10 border border-[var(--hack-green)]/40 text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 font-mono">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Re-scan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        <StatCard icon={Activity} label="Snapshots" value={stats.total_snapshots} color="cyan" />
        <StatCard icon={AlertTriangle} label="Alerts" value={stats.total_alerts} color="amber" />
        <StatCard icon={AlertTriangle} label="High+" value={(stats.alerts_by_severity.high || 0) + (stats.alerts_by_severity.critical || 0)} color="red" />
        <StatCard icon={Clock} label="Elapsed" value={`${stats.elapsed_seconds}s`} color="gray" />
        <StatCard icon={Radio} label="Last Scan" value={poll.last_scan_at ? new Date(poll.last_scan_at).toLocaleTimeString() : "—"} color="green" />
      </div>

      {/* Severity Distribution */}
      {stats.total_alerts > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-3 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--hack-amber)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-amber)]">{"» Alert Distribution"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {["critical", "high", "medium", "low", "info"].map((sev) => {
              const count = stats.alerts_by_severity[sev] || 0;
              if (count === 0) return null;
              return (
                <span key={sev} className={`font-mono text-[10px] px-2 py-0.5 border ${SEVERITY_COLORS[sev] || ""}`}>
                  {count} {sev.toUpperCase()}
                </span>
              );
            })}
          </div>
          {/* Category distribution */}
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(stats.alerts_by_category).map(([cat, count]) => (
              <span key={cat} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1.5 py-0.5 text-[var(--hack-gray)]">
                {CATEGORY_LABELS[cat] || cat}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setViewMode("alerts")} className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${viewMode === "alerts" ? "border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10 text-[var(--hack-amber)]" : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)]"}`}>
          <AlertTriangle className="h-3 w-3" /> Alerts ({poll.alerts.length})
        </button>
        <button onClick={() => setViewMode("snapshots")} className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${viewMode === "snapshots" ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]" : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)]"}`}>
          <Activity className="h-3 w-3" /> Snapshots ({poll.snapshots.length})
        </button>
      </div>

      {/* Alerts View */}
      {viewMode === "alerts" && (
        <div>
          {poll.alerts.length === 0 ? (
            <div className="border border-[var(--hack-green)]/20 bg-[var(--hack-green)]/5 p-8 text-center">
              <Activity className="h-8 w-8 text-[var(--hack-green)]/40 mx-auto mb-2" />
              <p className="font-mono text-xs text-[var(--hack-gray)]">
                {"» No changes detected. Monitoring is active — alerts will appear when sources change."}
              </p>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]/50 mt-1">
                First scan establishes baseline. Subsequent scans compare against it to detect changes.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {[...poll.alerts].reverse().map((alert) => {
                const isExpanded = expandedAlerts.has(alert.id);
                const Icon = CHANGE_ICONS[alert.changeType] || AlertTriangle;
                return (
                  <div key={alert.id} className="border border-[var(--hack-border)] bg-black/20">
                    <button
                      onClick={() => setExpandedAlerts((prev) => {
                        const next = new Set(prev);
                        if (next.has(alert.id)) next.delete(alert.id); else next.add(alert.id);
                        return next;
                      })}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-amber)]/5 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${alert.changeType === "addition" ? "text-[var(--hack-green)]" : alert.changeType === "removal" ? "text-[var(--hack-red)]" : "text-[var(--hack-amber)]"}`} />
                      <span className={`font-mono text-[8px] px-1 py-0.5 border shrink-0 ${SEVERITY_COLORS[alert.severity] || ""}`}>
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--hack-gray)]/50 shrink-0">[{CATEGORY_LABELS[alert.category] || alert.category}]</span>
                      <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">{alert.currentState.slice(0, 60)}</span>
                      <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 shrink-0">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 pl-10 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div className="border-l-2 border-[var(--hack-red)] pl-2 bg-black/30 p-2">
                            <span className="font-mono text-[9px] uppercase text-[var(--hack-red)]/60">Previous State:</span>
                            <p className="text-[10px] text-[var(--hack-gray)] mt-0.5">{alert.previousState}</p>
                          </div>
                          <div className="border-l-2 border-[var(--hack-green)] pl-2 bg-black/30 p-2">
                            <span className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60">Current State:</span>
                            <p className="text-[10px] text-[var(--hack-gray)] mt-0.5">{alert.currentState}</p>
                          </div>
                        </div>
                        <div>
                          <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)]/60">Significance: </span>
                          <span className="text-[10px] text-[var(--hack-gray)]">{alert.significance}</span>
                        </div>
                        {alert.relatedEntities.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="font-mono text-[9px] text-[var(--hack-gray)]/50">Related:</span>
                            {alert.relatedEntities.map((e, i) => (
                              <span key={i} className="font-mono text-[8px] border border-[var(--hack-border)] bg-black/40 px-1 text-[var(--hack-cyan)]">{e}</span>
                            ))}
                          </div>
                        )}
                        <div className="font-mono text-[9px] text-[var(--hack-gray)]/40">
                          Source: {alert.sourceLabel} · Confidence: {(alert.confidence * 100).toFixed(0)}% · Detected: {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Snapshots View */}
      {viewMode === "snapshots" && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {poll.snapshots.length === 0 ? (
            <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
              <p className="font-mono text-xs text-[var(--hack-gray)]">{"» No snapshots yet. First scan in progress..."}</p>
            </div>
          ) : (
            [...poll.snapshots].reverse().map((snap) => (
              <div key={snap.id} className="border border-[var(--hack-border)] bg-black/20">
                <div className="border-b border-[var(--hack-border)] px-3 py-1.5 flex items-center gap-2">
                  <span className={`font-mono text-[8px] px-1 py-0.5 border ${snap.category === "news" ? "text-[var(--hack-cyan)]" : snap.category === "dns" ? "text-[var(--hack-amber)]" : "text-[var(--hack-green)]"} border-current`}>
                    {CATEGORY_LABELS[snap.category] || snap.category}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--hack-green)]">{snap.entryCount} entries</span>
                  <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 ml-auto">{new Date(snap.timestamp).toLocaleString()}</span>
                </div>
                <div className="max-h-32 overflow-y-auto px-3 py-1">
                  {snap.entries.slice(0, 8).map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 border-b border-[var(--hack-border)]/20 py-0.5">
                      <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 shrink-0">{entry.sourceLabel.slice(0, 12)}</span>
                      <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate">{entry.data.slice(0, 70)}</span>
                      <span className="font-mono text-[8px] text-[var(--hack-gray)]/30 shrink-0">{(entry.confidence * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                  {snap.entries.length > 8 && <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-1">... +{snap.entries.length - 8} more</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Error */}
      {poll.error && (
        <div className="mt-4 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10 px-3 py-2">
          <span className="font-mono text-xs text-[var(--hack-red)]">{poll.error}</span>
        </div>
      )}

      {/* Phase indicator */}
      {isRunning && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 border border-[var(--hack-green)]/40 bg-[var(--hack-bg)]/95 px-3 py-2 backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--hack-green)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">MONITORING...</span>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "cyan" ? "text-[var(--hack-cyan)]" : color === "amber" ? "text-[var(--hack-amber)]" : color === "red" ? "text-[var(--hack-red)]" : "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <Icon className={`h-3 w-3 mx-auto ${c} mb-0.5`} />
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}
