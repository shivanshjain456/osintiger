"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Bot,
  Crosshair,
  Database,
  GitBranch,
  Loader2,
  Network,
  Activity,
  Clock,
  Target,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Layers,
  Globe,
  Search,
} from "lucide-react";
import type { DiscoveryPollResponse, DiscoveryTreeNode } from "@/lib/osint/client";
import { pollDiscovery } from "@/lib/osint/client";

interface Props {
  id: string;
  target: string;
  onHome: () => void;
}

export function DiscoveryView({ id, target, onHome }: Props) {
  const [poll, setPoll] = useState<DiscoveryPollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function pollLoop() {
      if (cancelledRef.current) return;
      try {
        const data = await pollDiscovery(id);
        if (cancelledRef.current) return;
        setPoll(data);
        setError(null);

        // Auto-expand nodes that are expanding or have children
        if (data.tree) {
          const root = data.tree;
          setExpandedNodes((prev) => {
            const next = new Set(prev);
            // Always expand root
            next.add(root.entityId);
            // Expand any node that is currently expanding or has children
            const traverse = (node: DiscoveryTreeNode) => {
              if (node.expanding || node.children.length > 0) {
                next.add(node.entityId);
              }
              for (const child of node.children) traverse(child);
            };
            traverse(root);
            return next;
          });
        }

        // Continue polling if not complete
        if (data.status === "running" || data.status === "queued") {
          const elapsed = data.stats.elapsed_seconds;
          const delay = elapsed < 10 ? 800 : elapsed < 30 ? 1500 : 2500;
          timeoutId = setTimeout(pollLoop, delay);
        }
      } catch (e) {
        if (cancelledRef.current) return;
        setError(e instanceof Error ? e.message : "Poll failed");
        timeoutId = setTimeout(pollLoop, 3000);
      }
    }

    pollLoop();
    return () => {
      cancelledRef.current = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id]);

  if (!poll && !error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--hack-green)]" />
          <span className="font-mono text-sm text-[var(--hack-gray)]">
            {"» initializing recursive discovery engine..."}
          </span>
        </div>
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-[var(--hack-red)] mx-auto" />
          <p className="font-mono text-sm text-[var(--hack-red)]">{error}</p>
          <Button onClick={onHome} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const isRunning = poll.status === "running" || poll.status === "queued";
  const isComplete = poll.status === "completed";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Button onClick={onHome} variant="ghost" size="sm" className="text-[var(--hack-gray)] hover:text-[var(--hack-green)]">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-[var(--hack-cyan)]" />
              <h1 className="text-xl font-bold font-mono text-[var(--hack-green)]">
                Recursive Discovery
              </h1>
              <StatusBadge status={poll.status} phase={poll.current_phase} />
            </div>
            <p className="text-xs text-[var(--hack-gray)] font-mono mt-0.5">
              {poll.root_target} · {poll.root_type}
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-4">
        <StatCard icon={Layers} label="Total Entities" value={poll.stats.total_entities} color="green" />
        <StatCard icon={CheckCircle2} label="Expanded" value={poll.stats.total_expanded} color="cyan" />
        <StatCard icon={GitBranch} label="Max Depth" value={poll.stats.max_depth_reached} color="amber" />
        <StatCard icon={Database} label="Findings" value={poll.stats.total_findings} color="green" />
        <StatCard icon={Clock} label="Elapsed" value={`${poll.stats.elapsed_seconds}s`} color="gray" />
        <StatCard icon={Zap} label="Max Depth Cfg" value={poll.config.maxDepth} color="cyan" />
      </div>

      {/* Currently expanding indicator */}
      {isRunning && poll.currently_expanding && (
        <div className="border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/5 px-3 py-2 mb-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--hack-cyan)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">
              Expanding:
            </span>
            <span className="font-mono text-xs text-[var(--hack-green)]">
              {poll.currently_expanding}
            </span>
          </div>
        </div>
      )}

      {/* Two-column layout: tree + trace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Discovery Tree — takes 2 columns */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5" />
            Discovery Tree
            <span className="text-[var(--hack-gray)] font-normal">
              ({poll.stats.total_entities} entities)
            </span>
          </h2>
          <div className="max-h-[600px] overflow-y-auto border border-[var(--hack-border)] bg-black/20">
            {poll.tree ? (
              <TreeView
                node={poll.tree}
                expandedNodes={expandedNodes}
                onToggle={(nodeId) =>
                  setExpandedNodes((prev) => {
                    const next = new Set(prev);
                    if (next.has(nodeId)) next.delete(nodeId);
                    else next.add(nodeId);
                    return next;
                  })
                }
                isRunning={isRunning}
              />
            ) : (
              <div className="p-6 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--hack-green)] mx-auto mb-2" />
                <p className="font-mono text-xs text-[var(--hack-gray)]">
                  {"» building discovery tree..."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Discovery Trace — takes 1 column */}
        <div className="space-y-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-cyan)] section-header flex items-center gap-2">
            <Activity className="h-3.5 w-3.5" />
            Expansion Trace
            <span className="text-[var(--hack-gray)] font-normal">
              ({poll.trace.length})
            </span>
          </h2>
          <div className="max-h-[600px] overflow-y-auto border border-[var(--hack-border)] bg-black/20">
            {poll.trace.length === 0 ? (
              <p className="p-4 text-center font-mono text-xs text-[var(--hack-gray)]">
                {"» no expansions yet"}
              </p>
            ) : (
              <div className="divide-y divide-[var(--hack-border)]/30">
                {[...poll.trace].reverse().slice(0, 30).map((entry, i) => (
                  <div key={i} className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-[9px] uppercase ${entry.status === "success" ? "text-[var(--hack-green)]" : "text-[var(--hack-gray)]"}`}>
                        d{entry.depth}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--hack-green)] truncate">
                        {entry.entityValue}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--hack-gray)] ml-auto">
                        {entry.durationMs}ms
                      </span>
                    </div>
                    <div className="font-mono text-[9px] text-[var(--hack-gray)]/70 mt-0.5">
                      {entry.sources.length} sources · {entry.findingCount} findings · {entry.newEntities.length} new
                    </div>
                    {entry.note && (
                      <div className="font-mono text-[9px] text-[var(--hack-gray)]/50 mt-0.5 italic truncate">
                        {entry.note.slice(0, 80)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error display */}
      {poll.error && (
        <div className="mt-4 border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-[var(--hack-red)]" />
            <span className="font-mono text-xs text-[var(--hack-red)]">{poll.error}</span>
          </div>
        </div>
      )}

      {/* Phase indicator */}
      {isRunning && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 border border-[var(--hack-green)]/40 bg-[var(--hack-bg)]/95 px-3 py-2 backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--hack-green)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">
            {poll.current_phase}...
          </span>
        </div>
      )}
    </div>
  );
}

// =====================
// Sub-components
// =====================

function StatusBadge({ status, phase }: { status: string; phase: string }) {
  const color =
    status === "completed" ? "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10" :
    status === "running" ? "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10" :
    status === "failed" ? "text-[var(--hack-red)] border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10" :
    "text-[var(--hack-gray)] border-[var(--hack-border)] bg-black/20";
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border ${color}`}>
      {status === "running" ? phase : status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const colorClass =
    color === "green" ? "text-[var(--hack-green)]" :
    color === "cyan" ? "text-[var(--hack-cyan)]" :
    color === "amber" ? "text-[var(--hack-amber)]" :
    "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${colorClass}`} />
        <span className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">
          {label}
        </span>
      </div>
      <div className={`font-mono text-sm font-bold mt-0.5 ${colorClass}`}>{value}</div>
    </div>
  );
}

const TYPE_COLORS: Record<string, string> = {
  domain: "text-[var(--hack-amber)]",
  ip: "text-[var(--hack-red)]",
  email: "text-[var(--hack-purple)]",
  wallet: "text-[var(--hack-amber)]",
  cve: "text-[var(--hack-orange)]",
  hash: "text-[var(--hack-gray)]",
  person: "text-[var(--hack-green)]",
  organization: "text-[var(--hack-cyan)]",
  username: "text-[var(--hack-purple)]",
  phone: "text-teal-400",
  url: "text-[var(--hack-cyan)]",
};

function TreeView({
  node,
  expandedNodes,
  onToggle,
  isRunning,
  level = 0,
}: {
  node: DiscoveryTreeNode;
  expandedNodes: Set<string>;
  onToggle: (nodeId: string) => void;
  isRunning: boolean;
  level?: number;
}) {
  const isExpanded = expandedNodes.has(node.entityId);
  const hasChildren = node.children.length > 0;
  const typeColor = TYPE_COLORS[node.type] || "text-[var(--hack-gray)]";

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 hover:bg-[var(--hack-green)]/5 cursor-pointer ${node.expanding ? "bg-[var(--hack-cyan)]/5" : ""}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onToggle(node.entityId)}
      >
        {/* Expand/collapse icon */}
        {hasChildren ? (
          isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Status icon */}
        {node.expanding ? (
          <Loader2 className="h-3 w-3 animate-spin text-[var(--hack-cyan)] shrink-0" />
        ) : node.expanded ? (
          <CheckCircle2 className="h-3 w-3 text-[var(--hack-green)] shrink-0" />
        ) : (
          <Globe className={`h-3 w-3 ${typeColor} shrink-0`} />
        )}

        {/* Entity value */}
        <span className={`font-mono text-[10px] truncate ${typeColor}`}>
          {node.value}
        </span>

        {/* Type badge */}
        <span className="font-mono text-[8px] uppercase text-[var(--hack-gray)]/60 shrink-0">
          [{node.type}]
        </span>

        {/* Depth indicator */}
        <span className="font-mono text-[8px] text-[var(--hack-gray)]/50 shrink-0">
          d{node.depth}
        </span>

        {/* Finding count */}
        {node.findingCount > 0 && (
          <span className="font-mono text-[8px] text-[var(--hack-green)]/60 shrink-0">
            {node.findingCount}f
          </span>
        )}

        {/* Children count */}
        {hasChildren && (
          <span className="font-mono text-[8px] text-[var(--hack-cyan)]/60 shrink-0 ml-auto">
            {node.children.length} child{node.children.length > 1 ? "ren" : ""}
          </span>
        )}

        {/* Confidence */}
        <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 shrink-0">
          {(node.confidence * 100).toFixed(0)}%
        </span>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeView
              key={child.entityId}
              node={child}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              isRunning={isRunning}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
