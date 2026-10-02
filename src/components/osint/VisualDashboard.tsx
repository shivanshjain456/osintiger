"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Loader2, Network, Clock, Map as MapIcon, Server, GitBranch, Grid3x3,
  BarChart3, Activity, Layers, Filter, Download, ZoomIn, ZoomOut,
  Maximize2, Eye, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  Database, Zap, Target, ChevronDown, ChevronRight, Search, RefreshCw,
  FileText, Brain,
} from "lucide-react";
import {
  fetchDashboard, type DashboardData, type DashboardEntity,
  type DashboardRelationship, type DashboardTimelineEvent, type DashboardGeopoint,
} from "@/lib/osint/client";

interface Props {
  investigationId: string;
  apiPath?: "standard" | "agent";
}

type ViewType = "graph" | "timeline" | "map" | "infrastructure" | "sankey" | "heatmap" | "coverage" | "progress" | "clusters";

const VIEW_CONFIG: { type: ViewType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "graph", label: "Relationship Graph", icon: Network, color: "cyan" },
  { type: "timeline", label: "Timeline", icon: Clock, color: "green" },
  { type: "map", label: "Geographic Map", icon: MapIcon, color: "amber" },
  { type: "infrastructure", label: "Infrastructure", icon: Server, color: "red" },
  { type: "sankey", label: "Sankey Flow", icon: GitBranch, color: "purple" },
  { type: "heatmap", label: "Confidence Heatmap", icon: Grid3x3, color: "cyan" },
  { type: "coverage", label: "Source Coverage", icon: BarChart3, color: "green" },
  { type: "progress", label: "Investigation Progress", icon: Activity, color: "amber" },
  { type: "clusters", label: "Entity Clusters", icon: Layers, color: "red" },
];

const ENTITY_COLORS: Record<string, string> = {
  domain: "#fbbf24", ip: "#ef4444", email: "#a855f7", organization: "#06b6d4",
  person: "#10b981", wallet: "#eab308", phone: "#ec4899", url: "#06b6d4",
  username: "#ec4899", location: "#f97316", repository: "#10b981", document: "#9ca3af",
};

const ENTITY_RADII: Record<string, number> = {
  domain: 12, ip: 10, email: 8, organization: 14, person: 12, wallet: 10, phone: 7, url: 8, username: 7, location: 9,
};

export function VisualDashboard({ investigationId, apiPath = "standard" }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewType>("graph");
  const [filter, setFilter] = useState({
    minConfidence: 0,
    entityTypes: new Set<string>(),
    showObserved: true,
    showInferred: true,
  });
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await fetchDashboard(investigationId, apiPath);
        if (active) { setData(d); setLoading(false); }
      } catch (e) {
        if (active) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [investigationId, apiPath]);

  const filteredEntities = useMemo(() => {
    if (!data) return [];
    return data.entities.filter((e) => {
      if (e.confidence < filter.minConfidence) return false;
      if (filter.entityTypes.size > 0 && !filter.entityTypes.has(e.type)) return false;
      if (!filter.showObserved && e.isObserved) return false;
      if (!filter.showInferred && e.isInferred) return false;
      return true;
    });
  }, [data, filter]);

  const filteredRels = useMemo(() => {
    if (!data) return [];
    const entityIds = new Set(filteredEntities.map((e) => e.id));
    return data.relationships.filter((r) => {
      if (r.confidence < filter.minConfidence) return false;
      return entityIds.has(r.from) || entityIds.has(r.to) ||
             filteredEntities.some((e) => e.label === r.fromLabel || e.label === r.toLabel);
    });
  }, [data, filter, filteredEntities]);

  if (loading) return (
    <div className="py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-[var(--hack-cyan)] mx-auto mb-3" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» building visual intelligence dashboard..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!data) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No dashboard data."}</p>;

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
        <Stat label="Entities" value={data.stats.totalEntities} icon={Network} color="cyan" />
        <Stat label="Relations" value={data.stats.totalRelationships} icon={GitBranch} color="green" />
        <Stat label="Timeline" value={data.stats.totalTimelineEvents} icon={Clock} color="amber" />
        <Stat label="Geo Points" value={data.stats.totalGeopoints} icon={MapIcon} color="red" />
        <Stat label="Sources" value={`${data.stats.successfulSources}/${data.stats.totalSources}`} icon={Database} color="cyan" />
        <Stat label="Avg Conf" value={`${(data.stats.avgConfidence * 100).toFixed(0)}%`} icon={ShieldCheck} color="green" />
        <Stat label="Observed" value={data.stats.observedEntities} icon={Eye} color="cyan" />
        <Stat label="Inferred" value={data.stats.inferredEntities} icon={Zap} color="amber" />
      </div>

      {/* View tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-[var(--hack-border)] pb-2">
        {VIEW_CONFIG.map((v) => {
          const Icon = v.icon;
          const isActive = view === v.type;
          const c = v.color === "cyan" ? "text-[var(--hack-cyan)]" : v.color === "green" ? "text-[var(--hack-green)]" : v.color === "amber" ? "text-[var(--hack-amber)]" : v.color === "red" ? "text-[var(--hack-red)]" : "text-[var(--hack-purple)]";
          return (
            <button
              key={v.type}
              onClick={() => setView(v.type)}
              className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                isActive
                  ? `border-current/40 bg-current/10 ${c}`
                  : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:border-current/30"
              }`}
            >
              <Icon className="h-3 w-3" /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap border border-[var(--hack-border)] bg-black/20 p-2">
        <Filter className="h-3 w-3 text-[var(--hack-gray)]" />
        <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">min conf:</span>
        <input
          type="range" min={0} max={1} step={0.1} value={filter.minConfidence}
          onChange={(e) => setFilter({ ...filter, minConfidence: parseFloat(e.target.value) })}
          className="w-20 accent-[var(--hack-cyan)]"
        />
        <span className="font-mono text-[9px] text-[var(--hack-cyan)]">{(filter.minConfidence * 100).toFixed(0)}%</span>
        <label className="flex items-center gap-1 font-mono text-[9px] text-[var(--hack-gray)] cursor-pointer">
          <input type="checkbox" checked={filter.showObserved} onChange={(e) => setFilter({ ...filter, showObserved: e.target.checked })} className="accent-[var(--hack-green)]" />
          observed
        </label>
        <label className="flex items-center gap-1 font-mono text-[9px] text-[var(--hack-gray)] cursor-pointer">
          <input type="checkbox" checked={filter.showInferred} onChange={(e) => setFilter({ ...filter, showInferred: e.target.checked })} className="accent-[var(--hack-amber)]" />
          inferred
        </label>
        <button
          onClick={() => setFilter({ minConfidence: 0, entityTypes: new Set(), showObserved: true, showInferred: true })}
          className="font-mono text-[9px] text-[var(--hack-gray)] hover:text-[var(--hack-red)] ml-auto"
        >
          reset
        </button>
      </div>

      {/* Visualization area */}
      <div className="border border-[var(--hack-border)] bg-black/30 min-h-[500px] relative">
        {view === "graph" && <GraphView entities={filteredEntities} relationships={filteredRels} selected={selectedEntity} onSelect={setSelectedEntity} />}
        {view === "timeline" && <TimelineView events={data.timelineEvents} />}
        {view === "map" && <MapView geopoints={data.geopoints} />}
        {view === "infrastructure" && <InfrastructureView nodes={data.infrastructureNodes} />}
        {view === "sankey" && <SankeyView links={data.sankeyLinks} />}
        {view === "heatmap" && <HeatmapView cells={data.confidenceMatrix} entities={data.entities} />}
        {view === "coverage" && <CoverageView coverage={data.sourceCoverage} />}
        {view === "progress" && <ProgressView progress={data.progress} />}
        {view === "clusters" && <ClustersView clusters={data.clusters} entities={data.entities} />}
      </div>

      {/* Selected entity detail */}
      {selectedEntity && (
        <EntityDetail
          entity={data.entities.find((e) => e.id === selectedEntity)}
          relationships={data.relationships.filter((r) => r.from === selectedEntity || r.to === selectedEntity)}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// 1. Force-Directed Relationship Graph (SVG-based)
// ============================================================================

function GraphView({
  entities, relationships, selected, onSelect,
}: {
  entities: DashboardEntity[];
  relationships: DashboardRelationship[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Simple force simulation (deterministic layout)
  const layout = useMemo(() => {
    const W = 800, H = 500;
    const cx = W / 2, cy = H / 2;
    const positions = new Map<string, { x: number; y: number }>();
    const numRings = Math.ceil(Math.sqrt(entities.length));

    // Place target at center, others in rings
    entities.forEach((e, i) => {
      if (i === 0) {
        positions.set(e.id, { x: cx, y: cy });
      } else {
        const ring = Math.ceil(Math.sqrt(i));
        const angle = (i * 137.5) * (Math.PI / 180); // golden angle
        const radius = ring * 60;
        positions.set(e.id, {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        });
      }
    });
    return { positions, W, H };
  }, [entities]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const handleMouseUp = () => setDragging(false);

  if (entities.length === 0) {
    return <EmptyState message="No entities to display in graph." icon={Network} />;
  }

  return (
    <div className="relative w-full h-[500px] overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 border border-[var(--hack-border)] bg-[var(--hack-bg)]/90 p-1">
        <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.2))} className="p-1 hover:bg-[var(--hack-cyan)]/10">
          <ZoomOut className="h-3 w-3 text-[var(--hack-gray)]" />
        </button>
        <span className="font-mono text-[9px] text-[var(--hack-cyan)] w-10 text-center">{(zoom * 100).toFixed(0)}%</span>
        <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="p-1 hover:bg-[var(--hack-cyan)]/10">
          <ZoomIn className="h-3 w-3 text-[var(--hack-gray)]" />
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1 hover:bg-[var(--hack-cyan)]/10">
          <Maximize2 className="h-3 w-3 text-[var(--hack-gray)]" />
        </button>
      </div>

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${layout.W} ${layout.H}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {relationships.map((rel, i) => {
            const fromPos = layout.positions.get(rel.from) || layout.positions.get(`entity:${rel.fromLabel.toLowerCase()}`);
            const toPos = layout.positions.get(rel.to) || layout.positions.get(`entity:${rel.toLabel.toLowerCase()}`);
            if (!fromPos || !toPos) return null;
            const isHighlighted = selected === rel.from || selected === rel.to || hovered === rel.from || hovered === rel.to;
            return (
              <g key={i}>
                <line
                  x1={fromPos.x} y1={fromPos.y} x2={toPos.x} y2={toPos.y}
                  stroke={rel.isInferred ? "#a855f7" : "#06b6d4"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeOpacity={isHighlighted ? 0.8 : 0.3}
                  strokeDasharray={rel.isInferred ? "4,2" : "none"}
                />
                {isHighlighted && (
                  <text
                    x={(fromPos.x + toPos.x) / 2}
                    y={(fromPos.y + toPos.y) / 2 - 5}
                    fill="#06b6d4"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    {rel.label.slice(0, 30)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {entities.map((entity) => {
            const pos = layout.positions.get(entity.id);
            if (!pos) return null;
            const r = (ENTITY_RADII[entity.type] || 8) + entity.weight * 0.5;
            const color = ENTITY_COLORS[entity.type] || "#9ca3af";
            const isSelected = selected === entity.id;
            const isHovered = hovered === entity.id;
            return (
              <g
                key={entity.id}
                transform={`translate(${pos.x},${pos.y})`}
                onClick={() => onSelect(isSelected ? null : entity.id)}
                onMouseEnter={() => setHovered(entity.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Glow ring for selected/hovered */}
                {(isSelected || isHovered) && (
                  <circle r={r + 6} fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
                )}
                {/* Confidence ring */}
                <circle
                  r={r + 2}
                  fill="none"
                  stroke={entity.confidence >= 0.7 ? "#10b981" : entity.confidence >= 0.4 ? "#fbbf24" : "#ef4444"}
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />
                {/* Main node */}
                <circle
                  r={r}
                  fill={color}
                  fillOpacity={entity.isObserved ? 0.8 : 0.4}
                  stroke={color}
                  strokeWidth={entity.isInferred ? 1 : 0}
                  strokeDasharray={entity.isInferred ? "2,1" : "none"}
                />
                {/* Label */}
                <text
                  y={r + 10}
                  fill="#9ca3af"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {entity.label.length > 20 ? entity.label.slice(0, 18) + "..." : entity.label}
                </text>
                {/* Type badge */}
                <text
                  y={3}
                  fill="#000"
                  fontSize="7"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {entity.type[0].toUpperCase()}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 border border-[var(--hack-border)] bg-[var(--hack-bg)]/90 p-2 space-y-0.5">
        <span className="font-mono text-[8px] uppercase text-[var(--hack-gray)]/60 block mb-1">Legend</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#06b6d4]" />
          <span className="font-mono text-[8px] text-[var(--hack-gray)]">observed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#a855f7] opacity-50" />
          <span className="font-mono text-[8px] text-[var(--hack-gray)]">inferred (dashed)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full border border-[#10b981]" />
          <span className="font-mono text-[8px] text-[var(--hack-gray)]">high conf ring</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute top-2 left-2 border border-[var(--hack-cyan)]/40 bg-[var(--hack-bg)]/95 p-2 max-w-xs">
          {(() => {
            const e = entities.find((en) => en.id === hovered);
            if (!e) return null;
            return (
              <>
                <div className="font-mono text-[10px] text-[var(--hack-cyan)] font-bold">{e.label}</div>
                <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">type: {e.type} · conf: {(e.confidence * 100).toFixed(0)}% · tier {e.tier}</div>
                <div className="font-mono text-[9px] text-[var(--hack-gray)]/50">source: {e.sourceLabel}</div>
                <div className="font-mono text-[8px] text-[var(--hack-gray)]/40 mt-0.5">{e.isObserved ? "observed" : "inferred"} · {e.evidenceCount} evidence</div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. Timeline View (multi-lane)
// ============================================================================

function TimelineView({ events }: { events: DashboardTimelineEvent[] }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const cats = new Set(events.map((e) => e.category));
    return ["all", ...cats];
  }, [events]);

  const filtered = useMemo(() => {
    if (selectedCategory === "all") return events;
    return events.filter((e) => e.category === selectedCategory);
  }, [events, selectedCategory]);

  // Group by category for lanes
  const lanes = useMemo(() => {
    const laneMap = new Map<string, DashboardTimelineEvent[]>();
    for (const e of filtered) {
      if (!laneMap.has(e.category)) laneMap.set(e.category, []);
      laneMap.get(e.category)!.push(e);
    }
    return [...laneMap.entries()];
  }, [filtered]);

  if (events.length === 0) {
    return <EmptyState message="No timeline events to display." icon={Clock} />;
  }

  // Calculate time range
  const times = filtered.map((e) => new Date(e.timestamp).getTime()).filter((t) => !isNaN(t));
  const minTime = times.length > 0 ? Math.min(...times) : 0;
  const maxTime = times.length > 0 ? Math.max(...times) : 1;
  const timeSpan = maxTime - minTime || 1;

  return (
    <div className="p-3 h-[500px] overflow-y-auto custom-scroll">
      {/* Category filter */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`font-mono text-[9px] border px-2 py-0.5 uppercase ${
              selectedCategory === cat
                ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]"
                : "border-[var(--hack-border)] text-[var(--hack-gray)]"
            }`}
          >
            {cat}
          </button>
        ))}
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/50 ml-auto">
          {filtered.length} events
        </span>
      </div>

      {/* Lanes */}
      <div className="space-y-3">
        {lanes.map(([cat, laneEvents]) => (
          <div key={cat}>
            <div className="font-mono text-[10px] uppercase text-[var(--hack-cyan)] mb-1 flex items-center gap-2">
              <CategoryIcon category={cat} />
              {cat} ({laneEvents.length})
            </div>
            <div className="relative h-16 border border-[var(--hack-border)] bg-black/40 overflow-hidden">
              {/* Time axis */}
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px bg-[var(--hack-border)]/30" />
              </div>
              {/* Events */}
              {laneEvents.map((e, i) => {
                const t = new Date(e.timestamp).getTime();
                const x = ((t - minTime) / timeSpan) * 100;
                if (isNaN(x) || x < 0 || x > 100) return null;
                const color = e.confidence >= 0.7 ? "#10b981" : e.confidence >= 0.4 ? "#fbbf24" : "#ef4444";
                return (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full cursor-pointer group"
                    style={{ left: `${x}%`, backgroundColor: color }}
                    title={`${e.date}: ${e.event.slice(0, 100)}`}
                  >
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block border border-[var(--hack-border)] bg-[var(--hack-bg)] p-1.5 z-10 w-64">
                      <div className="font-mono text-[8px] text-[var(--hack-gray)]/50">{e.date}</div>
                      <div className="font-mono text-[9px] text-[var(--hack-gray)] mt-0.5 line-clamp-3">{e.event}</div>
                      <div className="font-mono text-[8px] text-[var(--hack-cyan)] mt-0.5">src: {e.sourceLabel}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Time axis labels */}
      <div className="flex justify-between mt-2 font-mono text-[8px] text-[var(--hack-gray)]/40">
        <span>{new Date(minTime).toLocaleDateString()}</span>
        <span>{new Date(maxTime).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, React.ElementType> = {
    infrastructure: Server, person: Network, document: FileText, alert: AlertTriangle, collection: Database, synthesis: Brain, other: Activity,
  };
  const Icon = icons[category] || Activity;
  return <Icon className="h-3 w-3" />;
}

// Brain and FileText are now imported directly from lucide-react

// ============================================================================
// 3. Geographic Map
// ============================================================================

function MapView({ geopoints }: { geopoints: DashboardGeopoint[] }) {
  if (geopoints.length === 0) {
    return <EmptyState message="No geographic data to display." icon={MapIcon} />;
  }

  // Simple equirectangular projection
  const W = 800, H = 400;
  const project = (lat: number, lon: number) => ({
    x: ((lon + 180) / 360) * W,
    y: ((90 - lat) / 180) * H,
  });

  return (
    <div className="p-3 h-[500px] overflow-auto">
      <div className="font-mono text-[10px] uppercase text-[var(--hack-cyan)] mb-2">
        Geographic Intelligence ({geopoints.length} points)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-[var(--hack-border)] bg-black/40">
        {/* World grid */}
        {[0, 90, 180, 270].map((deg) => (
          <line key={`v${deg}`} x1={(deg / 360) * W} y1={0} x2={(deg / 360) * W} y2={H} stroke="#1a1a1a" strokeWidth="0.5" />
        ))}
        {[0, 30, 60, 90].map((deg) => (
          <g key={`h${deg}`}>
            <line x1={0} y1={((90 - deg) / 180) * H} x2={W} y2={((90 - deg) / 180) * H} stroke="#1a1a1a" strokeWidth="0.5" />
            <line x1={0} y1={((90 + deg) / 180) * H} x2={W} y2={((90 + deg) / 180) * H} stroke="#1a1a1a" strokeWidth="0.5" />
          </g>
        ))}
        {/* Equator */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#333" strokeWidth="1" strokeDasharray="4,2" />

        {/* Points */}
        {geopoints.map((gp) => {
          if (!gp.lat || !gp.lon) return null;
          const { x, y } = project(gp.lat, gp.lon);
          const r = 4 + gp.weight * 4;
          const color = gp.confidence >= 0.7 ? "#10b981" : gp.confidence >= 0.4 ? "#fbbf24" : "#ef4444";
          return (
            <g key={gp.id} className="cursor-pointer group">
              {/* Confidence ring */}
              <circle cx={x} cy={y} r={r + 3} fill="none" stroke={color} strokeWidth="0.5" opacity="0.4" />
              {/* Main point */}
              <circle
                cx={x} cy={y} r={r}
                fill={color}
                fillOpacity={gp.isApproximate ? 0.3 : 0.7}
                stroke={color}
                strokeWidth="1"
                strokeDasharray={gp.isApproximate ? "2,1" : "none"}
              />
              {/* Label */}
              <text x={x + r + 2} y={y + 3} fill="#9ca3af" fontSize="8" fontFamily="monospace">
                {gp.label.length > 15 ? gp.label.slice(0, 13) + "..." : gp.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Point list */}
      <div className="mt-3 space-y-1 max-h-48 overflow-y-auto custom-scroll">
        {geopoints.map((gp) => (
          <div key={gp.id} className="border border-[var(--hack-border)] bg-black/30 p-1.5 flex items-center gap-2">
            <MapIcon className="h-3 w-3 text-[var(--hack-amber)] shrink-0" />
            <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{gp.label}</span>
            {gp.country && <span className="font-mono text-[8px] text-[var(--hack-gray)]/50">{gp.country}</span>}
            {gp.lat && gp.lon && <span className="font-mono text-[8px] text-[var(--hack-gray)]/40">{gp.lat.toFixed(2)}, {gp.lon.toFixed(2)}</span>}
            <span className="font-mono text-[8px] text-[var(--hack-gray)]/50 ml-auto">{gp.sourceLabel}</span>
            {gp.isApproximate && <span className="font-mono text-[7px] text-[var(--hack-amber)] border border-[var(--hack-amber)]/30 px-0.5">APPROX</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 4. Infrastructure Topology
// ============================================================================

function InfrastructureView({ nodes }: { nodes: { id: string; label: string; type: string; children: string[]; confidence: number; isExposed: boolean; source: string; metadata: Record<string, string> }[] }) {
  if (nodes.length === 0) {
    return <EmptyState message="No infrastructure data to display." icon={Server} />;
  }

  // Group: domains at top, IPs at bottom
  const domains = nodes.filter((n) => n.type === "domain" || n.type === "subdomain");
  const ips = nodes.filter((n) => n.type === "ip");

  return (
    <div className="p-3 h-[500px] overflow-auto">
      <div className="font-mono text-[10px] uppercase text-[var(--hack-cyan)] mb-2">
        Infrastructure Topology ({nodes.length} nodes)
      </div>
      <svg viewBox="0 0 800 400" className="w-full border border-[var(--hack-border)] bg-black/40">
        {/* Domain layer */}
        <text x={20} y={30} fill="#fbbf24" fontSize="10" fontFamily="monospace">DOMAINS ({domains.length})</text>
        {domains.map((node, i) => {
          const x = 50 + (i % 8) * 90;
          const y = 50 + Math.floor(i / 8) * 40;
          return (
            <g key={node.id}>
              <rect x={x} y={y} width={80} height={24} fill="#fbbf24" fillOpacity="0.2" stroke="#fbbf24" strokeWidth="1" rx="2" />
              <text x={x + 40} y={y + 15} fill="#fbbf24" fontSize="7" fontFamily="monospace" textAnchor="middle">
                {node.label.length > 12 ? node.label.slice(0, 10) + ".." : node.label}
              </text>
            </g>
          );
        })}

        {/* IP layer */}
        <text x={20} y={250} fill="#ef4444" fontSize="10" fontFamily="monospace">IP ADDRESSES ({ips.length})</text>
        {ips.map((node, i) => {
          const x = 50 + (i % 8) * 90;
          const y = 270 + Math.floor(i / 8) * 40;
          return (
            <g key={node.id}>
              <rect x={x} y={y} width={80} height={24} fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="1" rx="2" />
              <text x={x + 40} y={y + 15} fill="#ef4444" fontSize="7" fontFamily="monospace" textAnchor="middle">
                {node.label.length > 12 ? node.label.slice(0, 10) + ".." : node.label}
              </text>
            </g>
          );
        })}

        {/* Connection lines */}
        {nodes.map((node) => {
          if (node.type !== "domain" && node.type !== "subdomain") return null;
          const domainIdx = domains.indexOf(node);
          const dx = 50 + (domainIdx % 8) * 90 + 40;
          const dy = 50 + Math.floor(domainIdx / 8) * 40 + 24;
          return node.children.map((childId) => {
            const child = nodes.find((n) => n.id === childId);
            if (!child) return null;
            const childIdx = ips.indexOf(child);
            if (childIdx === -1) return null;
            const cx = 50 + (childIdx % 8) * 90 + 40;
            const cy = 270 + Math.floor(childIdx / 8) * 40;
            return (
              <line key={`${node.id}-${childId}`} x1={dx} y1={dy} x2={cx} y2={cy} stroke="#06b6d4" strokeWidth="0.5" strokeOpacity="0.4" />
            );
          });
        })}
      </svg>

      {/* Node details */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-40 overflow-y-auto custom-scroll">
        {nodes.slice(0, 20).map((node) => (
          <div key={node.id} className="border border-[var(--hack-border)] bg-black/30 p-1.5 flex items-center gap-2">
            <Server className={`h-3 w-3 shrink-0 ${node.type === "ip" ? "text-[var(--hack-red)]" : "text-[var(--hack-amber)]"}`} />
            <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate">{node.label}</span>
            <span className="font-mono text-[8px] text-[var(--hack-gray)]/50 ml-auto">{node.type}</span>
            {node.isExposed && <span className="font-mono text-[7px] text-[var(--hack-red)] border border-[var(--hack-red)]/30 px-0.5">EXPOSED</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 5. Sankey Flow Diagram
// ============================================================================

function SankeyView({ links }: { links: { source: string; target: string; value: number; sourceType: string; targetType: string }[] }) {
  if (links.length === 0) {
    return <EmptyState message="No flow data to display." icon={GitBranch} />;
  }

  // Aggregate by source and target
  const sources = [...new Set(links.map((l) => l.source))];
  const targets = [...new Set(links.map((l) => l.target))];
  const maxVal = Math.max(...links.map((l) => l.value), 1);

  const W = 800, H = 400;
  const sourceX = 100, targetX = 600;
  const sourceSpacing = H / (sources.length + 1);
  const targetSpacing = H / (targets.length + 1);

  return (
    <div className="p-3 h-[500px] overflow-auto">
      <div className="font-mono text-[10px] uppercase text-[var(--hack-cyan)] mb-2">
        Evidence Flow: Sources → Entity Types ({links.length} links)
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-[var(--hack-border)] bg-black/40">
        {/* Source nodes */}
        {sources.map((src, i) => (
          <g key={src}>
            <rect x={sourceX - 10} y={sourceSpacing * (i + 1) - 10} width={20} height={20} fill="#06b6d4" fillOpacity="0.3" stroke="#06b6d4" strokeWidth="1" />
            <text x={sourceX - 15} y={sourceSpacing * (i + 1) + 3} fill="#06b6d4" fontSize="8" fontFamily="monospace" textAnchor="end">{src}</text>
          </g>
        ))}

        {/* Target nodes */}
        {targets.map((tgt, i) => (
          <g key={tgt}>
            <rect x={targetX - 10} y={targetSpacing * (i + 1) - 10} width={20} height={20} fill={ENTITY_COLORS[tgt] || "#9ca3af"} fillOpacity="0.3" stroke={ENTITY_COLORS[tgt] || "#9ca3af"} strokeWidth="1" />
            <text x={targetX + 15} y={targetSpacing * (i + 1) + 3} fill={ENTITY_COLORS[tgt] || "#9ca3af"} fontSize="8" fontFamily="monospace">{tgt}</text>
          </g>
        ))}

        {/* Flow paths */}
        {links.map((link, i) => {
          const srcIdx = sources.indexOf(link.source);
          const tgtIdx = targets.indexOf(link.target);
          const sy = sourceSpacing * (srcIdx + 1);
          const ty = targetSpacing * (tgtIdx + 1);
          const width = Math.max(1, (link.value / maxVal) * 15);
          const midX = (sourceX + targetX) / 2;
          return (
            <path
              key={i}
              d={`M ${sourceX + 10} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${targetX - 10} ${ty}`}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={width}
              strokeOpacity="0.3"
            />
          );
        })}
      </svg>

      {/* Flow details */}
      <div className="mt-3 space-y-1 max-h-40 overflow-y-auto custom-scroll">
        {links.sort((a, b) => b.value - a.value).slice(0, 15).map((link, i) => (
          <div key={i} className="border border-[var(--hack-border)] bg-black/30 p-1.5 flex items-center gap-2">
            <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{link.source}</span>
            <GitBranch className="h-2.5 w-2.5 text-[var(--hack-gray)]/40" />
            <span className="font-mono text-[10px] text-[var(--hack-amber)]">{link.target}</span>
            <span className="font-mono text-[9px] text-[var(--hack-gray)]/50 ml-auto">{link.value} findings</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 6. Confidence Heatmap
// ============================================================================

function HeatmapView({ cells, entities }: { cells: { rowId: string; rowLabel: string; rowType: string; colId: string; colLabel: string; confidence: number; evidenceCount: number; hasContradiction: boolean }[]; entities: DashboardEntity[] }) {
  if (cells.length === 0) {
    return <EmptyState message="No confidence data to display." icon={Grid3x3} />;
  }

  const rowIds = [...new Set(cells.map((c) => c.rowId))].slice(0, 15);
  const colIds = [...new Set(cells.map((c) => c.colId))].slice(0, 10);

  const getCell = (rowId: string, colId: string) => cells.find((c) => c.rowId === rowId && c.colId === colId);

  return (
    <div className="p-3 h-[500px] overflow-auto">
      <div className="font-mono text-[10px] uppercase text-[var(--hack-cyan)] mb-2">
        Confidence Heatmap: Entities × Source Categories
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="border border-[var(--hack-border)] p-1 font-mono text-[8px] text-[var(--hack-gray)]/60 text-left sticky left-0 bg-[var(--hack-bg)]">Entity</th>
              {colIds.map((colId) => {
                const cell = cells.find((c) => c.colId === colId);
                return (
                  <th key={colId} className="border border-[var(--hack-border)] p-1 font-mono text-[7px] text-[var(--hack-gray)]/60 text-center min-w-[60px]">
                    {cell?.colLabel || colId}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rowIds.map((rowId) => {
              const cell = cells.find((c) => c.rowId === rowId);
              const entity = entities.find((e) => e.id === rowId);
              return (
                <tr key={rowId}>
                  <td className="border border-[var(--hack-border)] p-1 font-mono text-[8px] text-[var(--hack-cyan)] sticky left-0 bg-[var(--hack-bg)] whitespace-nowrap max-w-[120px] truncate">
                    {cell?.rowLabel || entity?.label || rowId}
                  </td>
                  {colIds.map((colId) => {
                    const c = getCell(rowId, colId);
                    if (!c) return <td key={colId} className="border border-[var(--hack-border)] p-1 bg-black/40" />;
                    const intensity = c.confidence;
                    const bg = c.hasContradiction
                      ? `rgba(239, 68, 68, ${intensity * 0.6})`
                      : `rgba(6, 182, 212, ${intensity * 0.6})`;
                    return (
                      <td key={colId} className="border border-[var(--hack-border)] p-1 text-center font-mono text-[8px]" style={{ backgroundColor: bg }} title={`${c.rowLabel} × ${c.colLabel}: ${(c.confidence * 100).toFixed(0)}% (${c.evidenceCount} evidence)${c.hasContradiction ? " [contradiction]" : ""}`}>
                        {c.hasContradiction ? "⚠" : `${(c.confidence * 100).toFixed(0)}`}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-3 font-mono text-[8px] text-[var(--hack-gray)]/50">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[rgba(6,182,212,0.6)]" /> high confidence
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[rgba(6,182,212,0.2)]" /> low confidence
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-[rgba(239,68,68,0.6)]" /> contradiction
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 7. Source Coverage
// ============================================================================

function CoverageView({ coverage }: { coverage: { sourceKey: string; sourceLabel: string; tier: number; status: string; findingCount: number; latencyMs?: number; error?: string; lastCollected: string; category: string }[] }) {
  const byCategory = useMemo(() => {
    const cats = new Map<string, typeof coverage>();
    for (const c of coverage) {
      if (!cats.has(c.category)) cats.set(c.category, []);
      cats.get(c.category)!.push(c);
    }
    return [...cats.entries()];
  }, [coverage]);

  if (coverage.length === 0) {
    return <EmptyState message="No source coverage data." icon={BarChart3} />;
  }

  const maxFindings = Math.max(...coverage.map((c) => c.findingCount), 1);

  return (
    <div className="p-3 h-[500px] overflow-y-auto custom-scroll">
      <div className="font-mono text-[10px] uppercase text-[var(--hack-cyan)] mb-2">
        Source Coverage ({coverage.length} sources, {coverage.filter((c) => c.status === "success").length} successful)
      </div>

      {byCategory.map(([cat, sources]) => (
        <div key={cat} className="mb-3">
          <div className="font-mono text-[9px] uppercase text-[var(--hack-green)]/60 mb-1">{cat} ({sources.length})</div>
          <div className="space-y-1">
            {sources.map((s) => (
              <div key={s.sourceKey} className="border border-[var(--hack-border)] bg-black/30 p-1.5">
                <div className="flex items-center gap-2">
                  {s.status === "success" ? (
                    <CheckCircle2 className="h-3 w-3 text-[var(--hack-green)] shrink-0" />
                  ) : s.status === "error" || s.status === "timeout" ? (
                    <XCircle className="h-3 w-3 text-[var(--hack-red)] shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-[var(--hack-amber)] shrink-0" />
                  )}
                  <span className="font-mono text-[10px] text-[var(--hack-gray)] truncate flex-1">{s.sourceLabel}</span>
                  <span className={`font-mono text-[8px] border px-1 shrink-0 ${
                    s.tier === 5 ? "text-[var(--hack-green)] border-[var(--hack-green)]/40" :
                    s.tier === 4 ? "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40" :
                    s.tier === 3 ? "text-[var(--hack-amber)] border-[var(--hack-amber)]/40" :
                    s.tier === 2 ? "text-[var(--hack-orange)] border-[var(--hack-orange)]/40" :
                    "text-[var(--hack-red)] border-[var(--hack-red)]/40"
                  }`}>T{s.tier}</span>
                  <span className="font-mono text-[9px] text-[var(--hack-cyan)] shrink-0">{s.findingCount}</span>
                </div>
                {s.findingCount > 0 && (
                  <div className="w-full h-1 bg-black/40 mt-1">
                    <div className="h-full bg-[var(--hack-cyan)]" style={{ width: `${(s.findingCount / maxFindings) * 100}%` }} />
                  </div>
                )}
                {s.error && <p className="font-mono text-[8px] text-[var(--hack-red)]/70 mt-0.5 truncate">{s.error}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 8. Investigation Progress
// ============================================================================

function ProgressView({ progress }: { progress: { overallPercent: number; currentStep: number; totalSteps: number; stepName: string; steps: { id: string; label: string; status: string; detail?: string }[]; evidenceCollected: number; entitiesResolved: number; relationshipsFound: number; contradictionsDetected: number; contradictionsResolved: number; coveragePercent: number; gapsRemaining: number; isComplete: boolean; isStalled: boolean } }) {
  return (
    <div className="p-3 h-[500px] overflow-y-auto custom-scroll">
      <div className="font-mono text-[10px] uppercase text-[var(--hack-cyan)] mb-3">
        Investigation Progress
      </div>

      {/* Overall progress */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs text-[var(--hack-gray)]">Overall Progress</span>
          <span className={`font-mono text-lg font-bold ${progress.isComplete ? "text-[var(--hack-green)]" : "text-[var(--hack-cyan)]"}`}>
            {progress.overallPercent.toFixed(0)}%
          </span>
        </div>
        <div className="w-full h-3 bg-black/60">
          <div
            className={`h-full transition-all ${progress.isComplete ? "bg-[var(--hack-green)]" : progress.isStalled ? "bg-[var(--hack-amber)]" : "bg-[var(--hack-cyan)]"}`}
            style={{ width: `${progress.overallPercent}%` }}
          />
        </div>
        <div className="flex items-center gap-2 mt-1 font-mono text-[9px] text-[var(--hack-gray)]/50">
          <span>step {progress.currentStep}/{progress.totalSteps}: {progress.stepName}</span>
          {progress.isComplete && <span className="text-[var(--hack-green)]">✓ complete</span>}
          {progress.isStalled && <span className="text-[var(--hack-amber)]">⚠ stalled</span>}
        </div>
      </div>

      {/* Step pipeline */}
      <div className="mb-3">
        <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Pipeline Steps:</span>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {progress.steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1">
              <div className={`border px-2 py-1 font-mono text-[9px] ${
                step.status === "success" ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]" :
                step.status === "loading" ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)] animate-pulse" :
                step.status === "error" ? "border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10 text-[var(--hack-red)]" :
                "border-[var(--hack-border)] text-[var(--hack-gray)]/40"
              }`}>
                {step.status === "success" && <CheckCircle2 className="h-2 w-2 inline mr-1" />}
                {step.status === "loading" && <Loader2 className="h-2 w-2 inline mr-1 animate-spin" />}
                {step.label}
              </div>
              {i < progress.steps.length - 1 && <span className="text-[var(--hack-gray)]/30">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <ProgressMetric label="Evidence" value={progress.evidenceCollected} icon={Database} color="cyan" />
        <ProgressMetric label="Entities" value={progress.entitiesResolved} icon={Network} color="green" />
        <ProgressMetric label="Relationships" value={progress.relationshipsFound} icon={GitBranch} color="cyan" />
        <ProgressMetric label="Contradictions" value={progress.contradictionsDetected} icon={AlertTriangle} color="amber" />
        <ProgressMetric label="Coverage" value={`${progress.coveragePercent.toFixed(0)}%`} icon={BarChart3} color="green" />
        <ProgressMetric label="Gaps" value={progress.gapsRemaining} icon={Target} color="amber" />
        <ProgressMetric label="Resolved" value={progress.contradictionsResolved} icon={CheckCircle2} color="green" />
        <ProgressMetric label="Status" value={progress.isComplete ? "Done" : progress.isStalled ? "Stalled" : "Active"} icon={Activity} color={progress.isComplete ? "green" : "amber"} />
      </div>
    </div>
  );
}

// ============================================================================
// 9. Entity Clusters
// ============================================================================

function ClustersView({ clusters, entities }: { clusters: { id: string; label: string; entityIds: string[]; entityCount: number; dominantType: string; avgConfidence: number; evidenceDensity: number; rationale: string }[]; entities: DashboardEntity[] }) {
  if (clusters.length === 0) {
    return <EmptyState message="No entity clusters to display." icon={Layers} />;
  }

  return (
    <div className="p-3 h-[500px] overflow-y-auto custom-scroll">
      <div className="font-mono text-[10px] uppercase text-[var(--hack-cyan)] mb-2">
        Entity Clusters ({clusters.length} groups)
      </div>
      <div className="space-y-2">
        {clusters.map((cluster) => (
          <div key={cluster.id} className="border border-[var(--hack-border)] bg-black/30 p-2">
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
              <span className="font-mono text-[10px] text-[var(--hack-cyan)] font-bold">{cluster.label}</span>
              <span className="font-mono text-[8px] text-[var(--hack-gray)]/50 ml-auto">
                {cluster.entityCount} entities · {(cluster.avgConfidence * 100).toFixed(0)}% avg conf
              </span>
            </div>
            <p className="font-mono text-[9px] text-[var(--hack-gray)]/60 italic mb-1">{cluster.rationale}</p>
            <div className="flex items-center gap-1 flex-wrap">
              {cluster.entityIds.slice(0, 10).map((eid) => {
                const entity = entities.find((e) => e.id === eid);
                if (!entity) return null;
                const color = ENTITY_COLORS[entity.type] || "#9ca3af";
                return (
                  <span
                    key={eid}
                    className="font-mono text-[8px] border px-1 py-0.5"
                    style={{ borderColor: color, color }}
                  >
                    {entity.label.length > 15 ? entity.label.slice(0, 13) + "..." : entity.label}
                  </span>
                );
              })}
              {cluster.entityIds.length > 10 && (
                <span className="font-mono text-[8px] text-[var(--hack-gray)]/40">
                  +{cluster.entityIds.length - 10} more
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Entity Detail (drill-down)
// ============================================================================

function EntityDetail({
  entity, relationships, onClose,
}: {
  entity: DashboardEntity | undefined;
  relationships: DashboardRelationship[];
  onClose: () => void;
}) {
  if (!entity) return null;
  const color = ENTITY_COLORS[entity.type] || "#9ca3af";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--hack-bg)] border border-[var(--hack-cyan)]/40 max-w-2xl w-full max-h-[80vh] overflow-y-auto custom-scroll" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-[var(--hack-border)] p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: color, opacity: 0.3 }}>
            <Network className="h-5 w-5" style={{ color }} />
          </div>
          <div className="flex-1">
            <h3 className="font-mono text-base font-bold" style={{ color }}>{entity.label}</h3>
            <div className="flex items-center gap-2 mt-1 font-mono text-[9px] text-[var(--hack-gray)]/60">
              <span>type: {entity.type}</span>
              <span>conf: {(entity.confidence * 100).toFixed(0)}%</span>
              <span>tier: {entity.tier}</span>
              <span>{entity.isObserved ? "observed" : "inferred"}</span>
            </div>
          </div>
          <button onClick={onClose} className="font-mono text-xs text-[var(--hack-gray)] hover:text-[var(--hack-red)]">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Source:</span>
            <p className="font-mono text-[10px] text-[var(--hack-gray)]/80">{entity.sourceLabel}</p>
            {entity.sourceUrl && (
              <a href={entity.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-[9px] text-[var(--hack-cyan)] hover:underline block truncate">
                {entity.sourceUrl}
              </a>
            )}
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Evidence Count: {entity.evidenceCount}</span>
          </div>
          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">First Seen: {entity.firstSeen}</span>
            <p className="font-mono text-[9px] text-[var(--hack-gray)]/50">Last Seen: {entity.lastSeen}</p>
          </div>
          {Object.keys(entity.attributes).length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Attributes:</span>
              <div className="space-y-0.5 mt-0.5">
                {Object.entries(entity.attributes).map(([k, v]) => (
                  <div key={k} className="font-mono text-[10px]">
                    <span className="text-[var(--hack-gray)]/60">{k}:</span> <span className="text-[var(--hack-green)]">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <span className="font-mono text-[9px] uppercase text-[var(--hack-cyan)]/60">Relationships ({relationships.length}):</span>
            <div className="space-y-1 mt-1 max-h-40 overflow-y-auto custom-scroll">
              {relationships.length === 0 ? (
                <p className="font-mono text-[10px] text-[var(--hack-gray)]/40">No direct relationships found.</p>
              ) : (
                relationships.map((r) => (
                  <div key={r.id} className="border border-[var(--hack-border)] bg-black/40 p-1.5 flex items-center gap-2">
                    <GitBranch className="h-2.5 w-2.5 text-[var(--hack-cyan)] shrink-0" />
                    <span className="font-mono text-[9px] text-[var(--hack-cyan)]">{r.fromLabel}</span>
                    <span className="font-mono text-[8px] text-[var(--hack-gray)]/50">→ {r.type} →</span>
                    <span className="font-mono text-[9px] text-[var(--hack-cyan)]">{r.toLabel}</span>
                    <span className="font-mono text-[8px] text-[var(--hack-green)] ml-auto">{(r.confidence * 100).toFixed(0)}%</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Stat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : color === "red" ? "text-[var(--hack-red)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 p-1.5 text-center">
      <Icon className={`h-3 w-3 mx-auto mb-0.5 ${c}`} />
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[7px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function EmptyState({ message, icon: Icon }: { message: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-center h-[500px]">
      <div className="text-center">
        <Icon className="h-8 w-8 text-[var(--hack-gray)]/30 mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]/60">{message}</p>
      </div>
    </div>
  );
}

function ProgressMetric({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 p-2 text-center">
      <Icon className={`h-3 w-3 mx-auto mb-0.5 ${c}`} />
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[7px] uppercase text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}
