"use client";

import { useMemo, useState } from "react";
import type { LinkGraph as LinkGraphType } from "@/lib/osint/types";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  person: "#00ff41",       // green
  organization: "#00ffff", // cyan
  domain: "#ffaa00",       // amber
  ip: "#ff0040",           // red
  email: "#bb88ff",        // purple
  wallet: "#ffcc00",       // gold
  location: "#88ccff",     // light blue
  repository: "#ff8866",   // orange
  social: "#ff66aa",       // pink
  document: "#cccccc",     // gray
  phone: "#66ffcc",        // teal
};

const NODE_RADIUS: Record<string, number> = {
  person: 22,
  organization: 26,
  domain: 18,
  ip: 16,
  email: 14,
  wallet: 20,
  location: 16,
  repository: 16,
  social: 14,
  document: 12,
  phone: 14,
};

interface Props {
  graph: LinkGraphType;
  target?: string;
}

export function LinkGraphPanel({ graph, target }: Props) {
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Layout: circular layout with the target (or highest-weight node) at center.
  const { nodes, edges } = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return { nodes: [], edges: [] };
    }
    const cx = 250;
    const cy = 250;
    const innerR = 60;
    const outerR = 180;

    // Find center node: prefer target match, else highest weight
    const sorted = [...graph.nodes].sort((a, b) => b.weight - a.weight);
    const centerNode = target
      ? sorted.find((n) => n.label.toLowerCase().includes(target.toLowerCase())) || sorted[0]
      : sorted[0];

    // Place center node at center
    const placed = new Map<string, { x: number; y: number }>();
    placed.set(centerNode.id, { x: cx, y: cy });

    // Place remaining nodes in a circle
    const others = graph.nodes.filter((n) => n.id !== centerNode.id);
    others.forEach((n, i) => {
      const angle = (i / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const r = others.length > 1 ? outerR : innerR + 40;
      placed.set(n.id, {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
      });
    });

    const nodesWithPos = graph.nodes.map((n) => ({
      ...n,
      x: placed.get(n.id)?.x || cx,
      y: placed.get(n.id)?.y || cy,
      r: NODE_RADIUS[n.type] || 14,
      color: NODE_COLORS[n.type] || "#888",
    }));

    const edgesWithPos = (graph.edges || []).map((e) => ({
      ...e,
      x1: placed.get(e.from)?.x || cx,
      y1: placed.get(e.from)?.y || cy,
      x2: placed.get(e.to)?.x || cx,
      y2: placed.get(e.to)?.y || cy,
    }));

    return { nodes: nodesWithPos, edges: edgesWithPos };
  }, [graph, target]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
        <p className="font-mono text-xs text-[var(--hack-gray)]">
          {"» No link analysis data — insufficient evidence to build entity relationship graph."}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--hack-border)] bg-black/30 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--hack-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">
            {"» ENTITY RELATIONSHIP GRAPH"}
          </span>
          <span className="font-mono text-[10px] text-[var(--hack-gray)]">
            {nodes.length} nodes · {edges.length} edges
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="p-1 hover:bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
            title="Zoom out"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-1 hover:bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
            title="Zoom in"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1 hover:bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
            title="Reset zoom"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* SVG Graph */}
      <div className="relative overflow-auto" style={{ maxHeight: 560 }}>
        <svg
          width="500"
          height="500"
          viewBox="0 0 500 500"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
          className="block"
        >
          {/* Edges */}
          {edges.map((e, i) => {
            const isHighlighted = selectedNode && (e.from === selectedNode || e.to === selectedNode);
            return (
              <g key={`edge-${i}`}>
                <line
                  x1={e.x1}
                  y1={e.y1}
                  x2={e.x2}
                  y2={e.y2}
                  stroke={isHighlighted ? "#00ff41" : "rgba(0,255,65,0.25)"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={e.confidence > 0.7 ? "none" : "4 2"}
                />
                {/* Edge label at midpoint */}
                <text
                  x={(e.x1 + e.x2) / 2}
                  y={(e.y1 + e.y2) / 2 - 4}
                  fill="rgba(0,255,65,0.6)"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {e.label.length > 20 ? e.label.slice(0, 18) + "…" : e.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const isSelected = selectedNode === n.id;
            const isConnected = selectedNode && edges.some((e) =>
              (e.from === selectedNode && e.to === n.id) ||
              (e.to === selectedNode && e.from === n.id)
            );
            const opacity = !selectedNode || isSelected || isConnected ? 1 : 0.3;
            return (
              <g
                key={n.id}
                onClick={() => setSelectedNode(isSelected ? null : n.id)}
                className="cursor-pointer"
                style={{ opacity }}
              >
                {/* Pulse ring for selected */}
                {isSelected && (
                  <circle cx={n.x} cy={n.y} r={n.r + 6} fill="none" stroke={n.color} strokeWidth="1" opacity="0.5">
                    <animate attributeName="r" from={n.r + 6} to={n.r + 14} dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={n.color}
                  fillOpacity={isSelected ? 0.3 : 0.15}
                  stroke={n.color}
                  strokeWidth={isSelected ? 2 : 1}
                />
                {/* Type indicator */}
                <text
                  x={n.x}
                  y={n.y + 3}
                  fill={n.color}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="pointer-events-none select-none uppercase"
                >
                  {n.type.slice(0, 3)}
                </text>
                {/* Label below node */}
                <text
                  x={n.x}
                  y={n.y + n.r + 12}
                  fill="rgba(255,255,255,0.9)"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected node details */}
      {selectedNode && (
        <div className="border-t border-[var(--hack-border)] px-3 py-2 bg-black/40">
          {(() => {
            const node = nodes.find((n) => n.id === selectedNode);
            if (!node) return null;
            const connectedEdges = edges.filter((e) => e.from === selectedNode || e.to === selectedNode);
            return (
              <div className="space-y-1">
                <div className="font-mono text-[11px]">
                  <span style={{ color: node.color }} className="font-bold uppercase">
                    [{node.type}]
                  </span>{" "}
                  <span className="text-white">{node.label}</span>
                  <span className="text-[var(--hack-gray)] ml-2">weight: {node.weight}</span>
                  <span className="text-[var(--hack-gray)] ml-2">src: {node.source}</span>
                </div>
                {connectedEdges.length > 0 && (
                  <div className="font-mono text-[10px] text-[var(--hack-gray)]">
                    {connectedEdges.length} connection{connectedEdges.length > 1 ? "s" : ""}: {" "}
                    {connectedEdges.map((e) => {
                      const otherId = e.from === selectedNode ? e.to : e.from;
                      const other = nodes.find((n) => n.id === otherId);
                      return other ? `${other.label} (${e.label})` : "";
                    }).join(" · ")}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-[var(--hack-border)] px-3 py-2 bg-black/20">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {Object.entries(NODE_COLORS).map(([type, color]) => {
            const hasType = nodes.some((n) => n.type === type);
            if (!hasType) return null;
            return (
              <div key={type} className="flex items-center gap-1 font-mono text-[9px]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[var(--hack-gray)] uppercase">{type}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
