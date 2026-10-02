"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { KnowledgeGraph, GraphNode, GraphEdge, GraphNodeType, RelationshipType } from "@/lib/osint/agent/graph-types";
import { NODE_TYPE_META, RELATIONSHIP_TYPE_META } from "@/lib/osint/agent/graph-types";
import { ZoomIn, ZoomOut, Maximize2, Filter, X, Network, Eye, EyeOff } from "lucide-react";

interface Props {
  graph: KnowledgeGraph;
  target?: string;
}

// Physics simulation types
interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  radius: number;
}

interface SimEdge {
  from: string;
  to: string;
  type: RelationshipType;
  label: string;
  confidence: number;
  source: string;
  evidence?: string;
  sourceNode: SimNode;
  targetNode: SimNode;
}

const WIDTH = 600;
const HEIGHT = 500;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;

export function KnowledgeGraphPanel({ graph, target }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<GraphNodeType>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<SimEdge[]>([]);

  // Initialize simulation nodes
  const { simNodes, simEdges } = useMemo(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return { simNodes: [], simEdges: [] };
    }

    // Filter out hidden types
    const visibleNodes = graph.nodes.filter((n) => !hiddenTypes.has(n.type));
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = graph.edges.filter(
      (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
    );

    // Initialize positions: circle layout for first node, random for others
    const snodes: SimNode[] = visibleNodes.map((n, i) => {
      const angle = (i / Math.max(visibleNodes.length, 1)) * Math.PI * 2;
      const radius = i === 0 ? 0 : 120 + Math.random() * 40;
      const meta = NODE_TYPE_META[n.type];
      return {
        ...n,
        x: CENTER_X + Math.cos(angle) * radius,
        y: CENTER_Y + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        radius: meta.radius,
      };
    });

    const nodeMap = new Map(snodes.map((n) => [n.id, n]));
    const sedges: SimEdge[] = visibleEdges
      .map((e) => ({
        from: e.from,
        to: e.to,
        type: e.type,
        label: e.label,
        confidence: e.confidence,
        source: e.source,
        evidence: e.evidence,
        sourceNode: nodeMap.get(e.from)!,
        targetNode: nodeMap.get(e.to)!,
      }))
      .filter((e) => e.sourceNode && e.targetNode);

    return { simNodes: snodes, simEdges: sedges };
  }, [graph, hiddenTypes]);

  // Store refs for the animation loop
  useEffect(() => {
    nodesRef.current = simNodes;
    edgesRef.current = simEdges;
  }, [simNodes, simEdges]);

  // Force simulation loop — runs on each animation frame.
  // Uses refs for mutable physics state (the linter's immutability rule doesn't
  // apply to refs that are intentionally mutated for animation performance).
  const tickRef = useRef<(() => void) | null>(null);

  // Update the tick function whenever simNodes/simEdges change
  useEffect(() => {
    tickRef.current = () => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
    if (nodes.length === 0) return;

    // 1. Repulsion (Coulomb's law): all nodes repel each other
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 3000 / (dist * dist); // Repulsion strength
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // 2. Attraction (Hooke's law): edges pull connected nodes together
    const idealLength = 100;
    for (const edge of edges) {
      const a = edge.sourceNode;
      const b = edge.targetNode;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - idealLength) * 0.04; // Spring constant
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // 3. Center gravity: pull all nodes toward center
    for (const node of nodes) {
      const dx = CENTER_X - node.x;
      const dy = CENTER_Y - node.y;
      node.vx += dx * 0.005;
      node.vy += dy * 0.005;
    }

    // 4. Update positions with velocity damping
    const damping = 0.85;
    for (const node of nodes) {
      if (node.fx !== null && node.fx !== undefined) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.vx *= damping;
        node.x += node.vx;
      }
      if (node.fy !== null && node.fy !== undefined) {
        node.y = node.fy;
        node.vy = 0;
      } else {
        node.vy *= damping;
        node.y += node.vy;
      }

      // Keep nodes within bounds
      const margin = 30;
      node.x = Math.max(margin, Math.min(WIDTH - margin, node.x));
      node.y = Math.max(margin, Math.min(HEIGHT - margin, node.y));
    }

    // Trigger re-render by updating a state (we use the animation frame itself)
    // The SVG reads from nodesRef.current directly via the render function
    if (svgRef.current) {
      // Update SVG elements directly for performance
      for (const node of nodes) {
        const circleEl = svgRef.current.querySelector(`[data-node-id="${node.id}"]`);
        if (circleEl) {
          circleEl.setAttribute("cx", String(node.x));
          circleEl.setAttribute("cy", String(node.y));
        }
        const textEl = svgRef.current.querySelector(`[data-node-text="${node.id}"]`);
        if (textEl) {
          textEl.setAttribute("x", String(node.x));
          textEl.setAttribute("y", String(node.y + node.radius + 12));
        }
        const typeEl = svgRef.current.querySelector(`[data-node-type-text="${node.id}"]`);
        if (typeEl) {
          typeEl.setAttribute("x", String(node.x));
          typeEl.setAttribute("y", String(node.y + 3));
        }
      }
      for (const edge of edges) {
        const lineEl = svgRef.current.querySelector(`[data-edge-id="${edge.from}-${edge.to}-${edge.type}"]`);
        if (lineEl) {
          lineEl.setAttribute("x1", String(edge.sourceNode.x));
          lineEl.setAttribute("y1", String(edge.sourceNode.y));
          lineEl.setAttribute("x2", String(edge.targetNode.x));
          lineEl.setAttribute("y2", String(edge.targetNode.y));
        }
        const labelEl = svgRef.current.querySelector(`[data-edge-label="${edge.from}-${edge.to}-${edge.type}"]`);
        if (labelEl) {
          labelEl.setAttribute("x", String((edge.sourceNode.x + edge.targetNode.x) / 2));
          labelEl.setAttribute("y", String((edge.sourceNode.y + edge.targetNode.y) / 2 - 4));
        }
      }
    }

    animationRef.current = requestAnimationFrame(() => tickRef.current?.());
    };
  }, [simNodes, simEdges]);

  // Start/stop animation
  useEffect(() => {
    if (simNodes.length > 0) {
      animationRef.current = requestAnimationFrame(() => tickRef.current?.());
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [simNodes]);

  // Handle node dragging
  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragNode(nodeId);
    setSelectedNode(nodeId);
    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragNode || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const x = ((e.clientX - rect.left) * scaleX - pan.x) / zoom;
    const y = ((e.clientY - rect.top) * scaleY - pan.y) / zoom;
    const node = nodesRef.current.find((n) => n.id === dragNode);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }, [isDragging, dragNode, pan, zoom]);

  const handleMouseUp = useCallback(() => {
    if (dragNode) {
      const node = nodesRef.current.find((n) => n.id === dragNode);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    setIsDragging(false);
    setDragNode(null);
  }, [dragNode]);

  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return (
      <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
        <Network className="h-8 w-8 text-[var(--hack-gray)]/40 mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]">
          {"» No graph data — insufficient evidence to build knowledge graph."}
        </p>
      </div>
    );
  }

  // Get connected edges for the selected node
  const selectedEdges = selectedNode
    ? graph.edges.filter((e) => e.from === selectedNode || e.to === selectedNode)
    : [];

  // Get connected nodes
  const connectedNodeIds = new Set<string>();
  if (selectedNode) {
    connectedNodeIds.add(selectedNode);
    for (const e of selectedEdges) {
      connectedNodeIds.add(e.from);
      connectedNodeIds.add(e.to);
    }
  }

  return (
    <div className="border border-[var(--hack-border)] bg-black/30 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--hack-border)] px-3 py-2">
        <div className="flex items-center gap-2">
          <Network className="h-3.5 w-3.5 text-[var(--hack-green)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">
            {"» KNOWLEDGE GRAPH"}
          </span>
          <span className="font-mono text-[10px] text-[var(--hack-gray)]">
            {graph.meta.nodeCount} nodes · {graph.meta.edgeCount} edges · max depth {graph.meta.maxDepth}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1 hover:bg-[var(--hack-green)]/10 ${showFilters ? "text-[var(--hack-green)]" : "text-[var(--hack-gray)]"}`}
            title="Toggle filters"
          >
            <Filter className="h-3 w-3" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="p-1 hover:bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
            title="Zoom out"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            className="p-1 hover:bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
            title="Zoom in"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="p-1 hover:bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
            title="Reset view"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="border-b border-[var(--hack-border)] px-3 py-2 bg-black/40">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]">
              Node Type Filters
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setHiddenTypes(new Set())}
                className="font-mono text-[9px] text-[var(--hack-green)] hover:underline"
              >
                Show all
              </button>
              <button
                onClick={() => {
                  const allTypes = new Set(Object.keys(NODE_TYPE_META) as GraphNodeType[]);
                  const presentTypes = new Set(graph.nodes.map((n) => n.type));
                  const toHide = new Set<GraphNodeType>();
                  for (const t of allTypes) if (presentTypes.has(t)) toHide.add(t);
                  setHiddenTypes(toHide);
                }}
                className="font-mono text-[9px] text-[var(--hack-red)] hover:underline"
              >
                Hide all
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(NODE_TYPE_META) as [GraphNodeType, typeof NODE_TYPE_META[GraphNodeType]][])
              .filter(([type]) => graph.meta.typeDistribution[type] > 0)
              .map(([type, meta]) => {
                const isHidden = hiddenTypes.has(type);
                const count = graph.meta.typeDistribution[type] || 0;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setHiddenTypes((prev) => {
                        const next = new Set(prev);
                        if (next.has(type)) next.delete(type);
                        else next.add(type);
                        return next;
                      });
                    }}
                    className={`flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] transition-colors ${
                      isHidden
                        ? "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)]/40 opacity-50"
                        : "border-[var(--hack-border)] bg-black/40 text-[var(--hack-gray)]"
                    }`}
                  >
                    {isHidden ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" style={{ color: meta.color }} />}
                    <span style={{ color: isHidden ? undefined : meta.color }}>{meta.label}</span>
                    <span className="text-[var(--hack-gray)]/50">({count})</span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* SVG Graph */}
      <div className="relative overflow-hidden bg-black/10" style={{ height: 500 }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-grab active:cursor-grabbing"
        >
          <defs>
            {/* Arrowhead marker for directed edges */}
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="rgba(0,255,65,0.4)" />
            </marker>
          </defs>

          {/* Edges */}
          {simEdges.map((edge, i) => {
            const meta = RELATIONSHIP_TYPE_META[edge.type];
            const isHighlighted = selectedNode && (edge.from === selectedNode || edge.to === selectedNode);
            const opacity = !selectedNode || isHighlighted ? 1 : 0.15;
            return (
              <g key={`edge-${i}`} style={{ opacity }}>
                <line
                  data-edge-id={`${edge.from}-${edge.to}-${edge.type}`}
                  x1={edge.sourceNode.x}
                  y1={edge.sourceNode.y}
                  x2={edge.targetNode.x}
                  y2={edge.targetNode.y}
                  stroke={isHighlighted ? meta.color : "rgba(0,255,65,0.2)"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray={meta.dashArray}
                  markerEnd={isHighlighted ? "url(#arrowhead)" : undefined}
                />
                {isHighlighted && (
                  <text
                    data-edge-label={`${edge.from}-${edge.to}-${edge.type}`}
                    x={(edge.sourceNode.x + edge.targetNode.x) / 2}
                    y={(edge.sourceNode.y + edge.targetNode.y) / 2 - 4}
                    fill={meta.color}
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {meta.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {simNodes.map((node) => {
            const meta = NODE_TYPE_META[node.type];
            const isSelected = selectedNode === node.id;
            const isConnected = connectedNodeIds.has(node.id);
            const opacity = !selectedNode || isConnected ? 1 : 0.3;
            const radius = meta.radius + Math.min(node.weight * 2, 10); // Bigger for more connected
            return (
              <g
                key={node.id}
                style={{ opacity, cursor: "pointer" }}
                onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(isSelected ? null : node.id);
                }}
              >
                {/* Pulse ring for selected */}
                {isSelected && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={radius + 6}
                    fill="none"
                    stroke={meta.color}
                    strokeWidth="1"
                    opacity="0.5"
                  >
                    <animate attributeName="r" from={radius + 6} to={radius + 14} dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.5" to="0" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Node circle */}
                <circle
                  data-node-id={node.id}
                  cx={node.x}
                  cy={node.y}
                  r={radius}
                  fill={meta.color}
                  fillOpacity={isSelected ? 0.35 : 0.15}
                  stroke={meta.color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                {/* Type abbreviation */}
                <text
                  data-node-type-text={node.id}
                  x={node.x}
                  y={node.y + 3}
                  fill={meta.color}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="pointer-events-none select-none uppercase"
                >
                  {meta.label.slice(0, 3)}
                </text>
                {/* Label below node */}
                <text
                  data-node-text={node.id}
                  x={node.x}
                  y={node.y + radius + 12}
                  fill="rgba(255,255,255,0.85)"
                  fontSize="9"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                >
                  {node.label.length > 20 ? node.label.slice(0, 18) + "…" : node.label}
                </text>
                {/* Weight badge */}
                {node.weight > 0 && (
                  <circle
                    cx={node.x + radius - 4}
                    cy={node.y - radius + 4}
                    r={6}
                    fill="#000"
                    stroke={meta.color}
                    strokeWidth="1"
                  />
                )}
                {node.weight > 0 && (
                  <text
                    x={node.x + radius - 4}
                    y={node.y - radius + 7}
                    fill={meta.color}
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {node.weight}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Zoom indicator */}
        <div className="absolute bottom-2 right-2 font-mono text-[9px] text-[var(--hack-gray)]/60 bg-black/60 px-1.5 py-0.5">
          {(zoom * 100).toFixed(0)}%
        </div>

        {/* Graph stats overlay */}
        <div className="absolute top-2 left-2 font-mono text-[9px] text-[var(--hack-gray)]/60 bg-black/60 px-1.5 py-0.5">
          {simNodes.length}/{graph.meta.nodeCount} visible
        </div>
      </div>

      {/* Selected node details */}
      {selectedNode && (
        <div className="border-t border-[var(--hack-border)] px-3 py-2 bg-black/40">
          {(() => {
            const node = graph.nodes.find((n) => n.id === selectedNode);
            if (!node) return null;
            const meta = NODE_TYPE_META[node.type];
            const nodeEdges = graph.edges.filter((e) => e.from === selectedNode || e.to === selectedNode);
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs">
                    <span style={{ color: meta.color }} className="font-bold uppercase">
                      [{meta.label}]
                    </span>{" "}
                    <span className="text-white">{node.label}</span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="text-[var(--hack-gray)] hover:text-[var(--hack-red)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-[var(--hack-gray)]">
                  <span>Depth: <span className="text-[var(--hack-green)]">{node.depth}</span></span>
                  <span>Connections: <span className="text-[var(--hack-green)]">{node.weight}</span></span>
                  <span>Confidence: <span className="text-[var(--hack-cyan)]">{(node.confidence * 100).toFixed(0)}%</span></span>
                  <span>Source: <span className="text-[var(--hack-cyan)]">{node.source}</span></span>
                </div>
                {node.context && (
                  <div className="font-mono text-[10px] text-[var(--hack-gray)]/70 border-t border-[var(--hack-border)]/30 pt-1">
                    <span className="uppercase">Context:</span> {node.context.slice(0, 150)}
                    {node.context.length > 150 ? "…" : ""}
                  </div>
                )}
                {nodeEdges.length > 0 && (
                  <div className="border-t border-[var(--hack-border)]/30 pt-1">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)] mb-0.5">
                      Connections ({nodeEdges.length}):
                    </div>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto">
                      {nodeEdges.map((e, i) => {
                        const otherId = e.from === selectedNode ? e.to : e.from;
                        const otherNode = graph.nodes.find((n) => n.id === otherId);
                        const relMeta = RELATIONSHIP_TYPE_META[e.type];
                        return (
                          <div key={i} className="font-mono text-[10px] text-[var(--hack-gray)] flex items-center gap-1">
                            <span style={{ color: relMeta.color }}>→</span>
                            <span className="text-[var(--hack-gray)]">{relMeta.label}</span>
                            <span className="text-[var(--hack-green)]">{otherNode?.label || otherId}</span>
                            <span className="text-[var(--hack-gray)]/50 ml-auto">{(e.confidence * 100).toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-[var(--hack-border)] px-3 py-2 bg-black/20">
        <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
          <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]/50">
            Types:
          </span>
          {(Object.entries(NODE_TYPE_META) as [GraphNodeType, typeof NODE_TYPE_META[GraphNodeType]][])
            .filter(([type]) => graph.meta.typeDistribution[type] > 0)
            .map(([type, meta]) => (
              <div key={type} className="flex items-center gap-1 font-mono text-[9px]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-[var(--hack-gray)]">{meta.label}</span>
              </div>
            ))}
        </div>
        {/* Relationship legend */}
        {Object.keys(graph.meta.relationshipDistribution).length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 items-center mt-1">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]/50">
              Relations:
            </span>
            {(Object.entries(graph.meta.relationshipDistribution) as [RelationshipType, number][])
              .filter(([type, count]) => count > 0)
              .map(([type, count]) => {
                const meta = RELATIONSHIP_TYPE_META[type];
                return (
                  <div key={type} className="flex items-center gap-1 font-mono text-[9px]">
                    <span style={{ color: meta.color }}>—</span>
                    <span className="text-[var(--hack-gray)]">{meta.label}</span>
                    <span className="text-[var(--hack-gray)]/50">({count})</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
