"use client";

import { useState, useEffect } from "react";
import { Loader2, Building2, ChevronDown, ChevronRight, Users, Briefcase, Handshake, Crown, Award, GitBranch, Network } from "lucide-react";

// =====================
// Types
// =====================

interface OrgEntity {
  id: string; name: string; type: string; normalizedName: string; legalSuffix?: string;
  jurisdiction?: string; aliases: string[]; role?: string; source: string; sourceLabel: string;
  tier: number; confidence: number; evidence: string;
}
interface OrgRelationship {
  id: string; from: string; to: string; type: string; confidence: number;
  status: string; startDate?: string; endDate?: string; detail: string;
  source: string; sourceLabel: string; tier: number; evidence: string;
}
interface HierarchyNode { id: string; label: string; type: string; weight: number; meta: { role?: string; jurisdiction?: string; legalSuffix?: string }; }
interface HierarchyEdge { from: string; to: string; type: string; label: string; confidence: number; status: string; }
interface CategorySummary { type: string; label: string; count: number; entities: string[]; }

interface OrgHierarchyReport {
  entities: OrgEntity[];
  relationships: OrgRelationship[];
  graph: { nodes: HierarchyNode[]; edges: HierarchyEdge[] };
  summaries: CategorySummary[];
  assessment: {
    totalEntities: number; totalRelationships: number;
    entityTypes: Record<string, number>; relationshipTypes: Record<string, number>;
    confirmedCount: number; inferredCount: number; complexity: string; explanation: string;
  };
  keyFindings: string[];
  meta: { sourcesAnalyzed: number; findingsAnalyzed: number; generatedAt: string };
}

interface Props { investigationId: string; apiPath: "standard" | "agent"; }

const ENTITY_ICONS: Record<string, React.ElementType> = {
  organization: Building2, person: Users, brand: Award, investor: Briefcase,
  partner: Handshake, subsidiary: Building2, parent_org: Crown,
};

const ENTITY_COLORS: Record<string, string> = {
  organization: "#00ff41", person: "#00ffff", brand: "#ffaa00", investor: "#bb88ff",
  partner: "#ff66aa", subsidiary: "#ff8866", parent_org: "#ffcc00",
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-[var(--hack-green)] border-[var(--hack-green)]/40",
  inferred: "text-[var(--hack-amber)] border-[var(--hack-amber)]/40",
  hypothesized: "text-[var(--hack-red)] border-[var(--hack-red)]/40",
};

const COMPLEXITY_COLORS: Record<string, string> = {
  complex: "text-[var(--hack-red)]", moderate: "text-[var(--hack-amber)]", minimal: "text-[var(--hack-green)]",
};

export function OrgHierarchyPanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<OrgHierarchyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSecs, setExpandedSecs] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/hierarchy`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled && data.report) { setReport(data.report); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» extracting organizational hierarchy..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { assessment, summaries, keyFindings, entities, relationships, graph } = report;

  const toggleSec = (s: string) => setExpandedSecs((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  // Group entities by type for display
  const entitiesByType = {} as Record<string, OrgEntity[]>;
  for (const e of entities) {
    if (e.id === "ent_target") continue;
    if (!entitiesByType[e.type]) entitiesByType[e.type] = [];
    entitiesByType[e.type].push(e);
  }

  return (
    <div className="space-y-4">
      {/* Assessment */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Organization Hierarchy</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Complexity</div>
              <div className={`font-mono text-lg font-bold ${COMPLEXITY_COLORS[assessment.complexity] || "text-[var(--hack-gray)]"}`}>
                {assessment.complexity.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
      </div>

      {/* Key Findings */}
      {keyFindings.length > 0 && (
        <div className="border border-[var(--hack-cyan)]/20 bg-[var(--hack-cyan)]/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">{"» Key Hierarchy Findings"}</span>
          </div>
          <ul className="space-y-1">
            {keyFindings.map((kf, i) => (
              <li key={i} className="text-xs text-[var(--hack-gray)] flex items-start gap-1">
                <span className="text-[var(--hack-cyan)] shrink-0">→</span>{kf}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Entities" value={assessment.totalEntities} />
        <Stat label="Relationships" value={assessment.totalRelationships} />
        <Stat label="Confirmed" value={assessment.confirmedCount} color="green" />
        <Stat label="Inferred" value={assessment.inferredCount} color="amber" />
        <Stat label="Categories" value={summaries.length} />
      </div>

      {/* Relationship Categories */}
      {summaries.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">{"» Relationship Categories"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {summaries.map((s) => (
              <button
                key={s.type}
                onClick={() => toggleSec(`cat_${s.type}`)}
                className="flex items-center gap-1.5 border border-[var(--hack-border)] bg-black/40 px-2 py-1 hover:bg-[var(--hack-cyan)]/5 transition-colors"
              >
                {expandedSecs.has(`cat_${s.type}`) ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
                <span className="font-mono text-[10px] text-[var(--hack-green)]">{s.label}</span>
                <span className="font-mono text-[9px] text-[var(--hack-gray)]/60">{s.count}</span>
              </button>
            ))}
          </div>
          {/* Expanded category content */}
          {summaries.map((s) => expandedSecs.has(`cat_${s.type}`) && (
            <div key={`content_${s.type}`} className="mt-2 border-t border-[var(--hack-border)]/30 pt-2">
              <div className="flex flex-wrap gap-1.5">
                {s.entities.map((e, i) => {
                  const entity = entities.find((en) => en.id === e);
                  const Icon = entity ? (ENTITY_ICONS[entity.type] || Building2) : Building2;
                  const color = entity ? (ENTITY_COLORS[entity.type] || "var(--hack-gray)") : "var(--hack-gray)";
                  return (
                    <span key={i} className="font-mono text-[9px] border px-1.5 py-0.5 flex items-center gap-1" style={{ color, borderColor: `${color}40` }}>
                      <Icon className="h-2.5 w-2.5" />
                      {entity?.name || e}
                      {entity?.role && <span className="text-[var(--hack-gray)]/50">({entity.role})</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hierarchy Graph (node chips) */}
      {graph.nodes.length > 1 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-3">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="h-3.5 w-3.5 text-[var(--hack-green)]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">{"» Hierarchy Graph"}</span>
            <span className="font-mono text-[9px] text-[var(--hack-gray)]/50">{graph.nodes.length} nodes · {graph.edges.length} edges</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {graph.nodes.map((node) => {
              const Icon = ENTITY_ICONS[node.type] || Building2;
              const color = ENTITY_COLORS[node.type] || "var(--hack-gray)";
              const isTarget = node.id === "ent_target";
              return (
                <span key={node.id} className={`font-mono text-[9px] border px-1.5 py-0.5 flex items-center gap-1 ${isTarget ? "border-[var(--hack-green)] bg-[var(--hack-green)]/10" : ""}`} style={{ color, borderColor: `${color}40` }}>
                  <Icon className="h-2.5 w-2.5" />
                  {node.label.slice(0, 25)}
                  {node.weight > 0 && <span className="text-[var(--hack-gray)]/40">({node.weight})</span>}
                  {isTarget && <span className="text-[var(--hack-green)]/60">★</span>}
                </span>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--hack-border)]/30">
            {Object.entries(ENTITY_COLORS).map(([type, color]) => {
              const Icon = ENTITY_ICONS[type] || Building2;
              return graph.nodes.some((n) => n.type === type) ? (
                <span key={type} className="font-mono text-[8px] flex items-center gap-1">
                  <Icon className="h-2 w-2" style={{ color }} />
                  <span className="text-[var(--hack-gray)]/60">{type.replace(/_/g, " ")}</span>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Entities by Type */}
      {Object.keys(entitiesByType).length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)] section-header">Discovered Entities</h3>
          {Object.entries(entitiesByType).map(([type, ents]) => {
            const Icon = ENTITY_ICONS[type] || Building2;
            const color = ENTITY_COLORS[type] || "var(--hack-gray)";
            const isExpanded = expandedSecs.has(`ents_${type}`);
            return (
              <div key={type} className="border border-[var(--hack-border)] bg-black/20">
                <button
                  onClick={() => toggleSec(`ents_${type}`)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-green)]/5 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
                  <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                  <span className="font-mono text-xs text-[var(--hack-green)] flex-1 text-left capitalize">{type.replace(/_/g, " ")} ({ents.length})</span>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1">
                    {ents.map((e) => (
                      <div key={e.id} className="border border-[var(--hack-border)]/30 px-2 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold" style={{ color }}>{e.name}</span>
                          {e.legalSuffix && <span className="font-mono text-[8px] text-[var(--hack-gray)]/50">{e.legalSuffix}</span>}
                          {e.role && <span className="font-mono text-[8px] text-[var(--hack-cyan)]">[{e.role}]</span>}
                          {e.aliases.length > 0 && <span className="font-mono text-[8px] text-[var(--hack-gray)]/40">aka: {e.aliases.join(", ")}</span>}
                        </div>
                        <div className="font-mono text-[9px] text-[var(--hack-gray)]/50 mt-0.5">
                          Source: {e.sourceLabel} · T{e.tier} · {(e.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* All Relationships */}
      {relationships.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20">
          <div className="border-b border-[var(--hack-border)] px-3 py-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">{"» All Relationships"}</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {relationships.map((r) => {
              const fromEntity = entities.find((e) => e.id === r.from);
              const toEntity = entities.find((e) => e.id === r.to);
              return (
                <div key={r.id} className="flex items-center gap-2 border-b border-[var(--hack-border)]/20 px-3 py-1 hover:bg-[var(--hack-green)]/5">
                  <span className={`font-mono text-[8px] px-1 py-0.5 border shrink-0 ${STATUS_COLORS[r.status] || "text-[var(--hack-gray)]"}`}>
                    {r.status.toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">{r.detail}</span>
                  <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 shrink-0">{(r.confidence * 100).toFixed(0)}%</span>
                  <span className="font-mono text-[8px] text-[var(--hack-gray)]/30 shrink-0">{r.sourceLabel.slice(0, 12)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}
