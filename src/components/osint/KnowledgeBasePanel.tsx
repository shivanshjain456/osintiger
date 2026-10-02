"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Database, ChevronDown, ChevronRight, Search, Network, FileText,
  AlertTriangle, Clock, TrendingUp, Layers, GitBranch, History, RefreshCw,
  CheckCircle2, ArrowRight, ExternalLink, Boxes, Link2, Eye, Hash, User,
  Building2, Globe, Server, Mail, Wallet, Phone, ShieldAlert, Bug,
} from "lucide-react";
import {
  fetchKBStats, fetchKBReport, searchKB, fetchKBEntity, ingestInvestigationToKB,
  type KBStats, type KBReport, type KBSearchResult, type KBEntityDetail,
  type KBEntity, type KBRelationship, type KBEvidence, type KBConflict, type KBVersion,
  type KBIngestResult,
} from "@/lib/osint/client";

interface Props {
  investigationId?: string;
  investigationKind?: "standard" | "agent" | "discovery" | "plan" | "monitor";
  showIngestBanner?: boolean;
}

type ViewMode = "overview" | "entities" | "relationships" | "evidence" | "conflicts" | "search";

const TYPE_ICONS: Record<string, React.ElementType> = {
  person: User,
  organization: Building2,
  domain: Globe,
  ip: Server,
  email: Mail,
  wallet: Wallet,
  phone: Phone,
  url: ExternalLink,
  hash: Hash,
  cve: Bug,
  username: User,
  document: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  person: "text-[var(--hack-green)]",
  organization: "text-[var(--hack-cyan)]",
  domain: "text-[var(--hack-amber)]",
  ip: "text-[var(--hack-red)]",
  email: "text-[var(--hack-purple)]",
  wallet: "text-[var(--hack-amber)]",
  phone: "text-[var(--hack-purple)]",
  url: "text-[var(--hack-cyan)]",
  hash: "text-[var(--hack-gray)]",
  cve: "text-[var(--hack-red)]",
  username: "text-[var(--hack-purple)]",
  document: "text-[var(--hack-gray)]",
};

const RELATION_COLORS: Record<string, string> = {
  resolves_to: "text-[var(--hack-amber)]",
  owned_by: "text-[var(--hack-cyan)]",
  affiliated_with: "text-[var(--hack-purple)]",
  employed_by: "text-[var(--hack-green)]",
  located_in: "text-[var(--hack-purple)]",
  links_to: "text-[var(--hack-cyan)]",
  mentions: "text-[var(--hack-gray)]",
  registered_to: "text-[var(--hack-green)]",
  parent_of: "text-[var(--hack-cyan)]",
  subsidiary_of: "text-[var(--hack-cyan)]",
  alias_of: "text-[var(--hack-green)]",
  related_to: "text-[var(--hack-gray)]",
  communicates_with: "text-[var(--hack-purple)]",
  hosts: "text-[var(--hack-amber)]",
  issued: "text-[var(--hack-green)]",
  observed_at: "text-[var(--hack-gray)]",
};

export function KnowledgeBasePanel({ investigationId, investigationKind = "standard", showIngestBanner = true }: Props) {
  const [view, setView] = useState<ViewMode>("overview");
  const [report, setReport] = useState<KBReport | null>(null);
  const [stats, setStats] = useState<KBStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<KBSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<KBEntityDetail | null>(null);
  const [entityLoading, setEntityLoading] = useState(false);
  const [expandedSecs, setExpandedSecs] = useState<Set<string>>(new Set());
  const [ingestResult, setIngestResult] = useState<KBIngestResult | null>(null);
  const [ingesting, setIngesting] = useState(false);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rpt, st] = await Promise.all([fetchKBReport(), fetchKBStats()]);
      setReport(rpt);
      setStats(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load KB");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  // Auto-ingest current investigation if requested
  useEffect(() => {
    if (!investigationId || !showIngestBanner) return;
    let cancelled = false;
    setIngesting(true);
    ingestInvestigationToKB(investigationId, investigationKind)
      .then((res) => { if (!cancelled) { setIngestResult(res); setIngesting(false); } })
      .catch((e) => {
        if (!cancelled) {
          setIngestResult({
            investigationId, investigationKind, target: "", ingestedAt: new Date().toISOString(),
            entitiesCreated: 0, entitiesUpdated: 0, relationshipsCreated: 0, relationshipsUpdated: 0,
            evidenceCreated: 0, conflictsDetected: 0, duplicatesResolved: 0, totalObservations: 0,
            alreadyIngested: false, message: `Ingest failed: ${e instanceof Error ? e.message : "unknown"}`,
          });
          setIngesting(false);
        }
      });
    return () => { cancelled = true; };
  }, [investigationId, investigationKind, showIngestBanner]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResult(null); return; }
    setSearching(true);
    try {
      const result = await searchKB(q);
      setSearchResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, []);

  const openEntity = useCallback(async (id: string) => {
    setEntityLoading(true);
    setSelectedEntity(null);
    try {
      const detail = await fetchKBEntity(id);
      setSelectedEntity(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load entity");
    } finally {
      setEntityLoading(false);
    }
  }, []);

  const toggleSec = (s: string) => setExpandedSecs((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» loading knowledge base..."}</p>
    </div>
  );
  if (error && !report) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report || !stats) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No KB data."}</p>;

  return (
    <div className="space-y-4">
      {/* Header — title + refresh + ingest status */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Knowledge Base</span>
            <span className="font-mono text-[9px] text-[var(--hack-green)]/60 border border-[var(--hack-green)]/30 px-1.5 py-0.5">DURABLE MEMORY</span>
          </div>
          <button
            onClick={loadInitial}
            className="flex items-center gap-1 border border-[var(--hack-border)] bg-black/40 px-2 py-1 font-mono text-[10px] text-[var(--hack-gray)] hover:border-[var(--hack-cyan)]/40 hover:text-[var(--hack-cyan)]"
            title="Refresh KB"
          >
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">
          Persistent intelligence repository — accumulates entities, relationships, and evidence across investigations.
          Each investigation enriches the KB for future reuse.
        </p>

        {/* Ingest status banner */}
        {investigationId && showIngestBanner && (
          <div className="mt-3 border-t border-[var(--hack-border)] pt-3">
            {ingesting ? (
              <div className="flex items-center gap-2 font-mono text-[10px] text-[var(--hack-cyan)]">
                <Loader2 className="h-3 w-3 animate-spin" /> Ingesting investigation into KB...
              </div>
            ) : ingestResult && (
              <div className={`flex items-start gap-2 font-mono text-[10px] ${ingestResult.alreadyIngested ? "text-[var(--hack-gray)]" : "text-[var(--hack-green)]"}`}>
                {ingestResult.alreadyIngested ? <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" /> : <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-[var(--hack-green)]" />}
                <div className="flex-1">
                  <span className={ingestResult.alreadyIngested ? "text-[var(--hack-gray)]" : "text-[var(--hack-green)]"}>
                    {ingestResult.alreadyIngested ? "Already in KB" : "Ingested into KB"}
                  </span>
                  {!ingestResult.alreadyIngested && (
                    <span className="text-[var(--hack-gray)]/70 ml-1">
                      — {ingestResult.entitiesCreated} new entities, {ingestResult.entitiesUpdated} updated,
                      {" "}{ingestResult.relationshipsCreated} new relationships, {ingestResult.evidenceCreated} evidence
                      {ingestResult.conflictsDetected > 0 && <span className="text-[var(--hack-amber)]">, {ingestResult.conflictsDetected} conflicts</span>}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <Stat label="Entities" value={stats.totalEntities} icon={Boxes} color="cyan" />
        <Stat label="Relationships" value={stats.totalRelationships} icon={Network} color="green" />
        <Stat label="Evidence" value={stats.totalEvidence} icon={FileText} color="cyan" />
        <Stat label="Conflicts" value={stats.openConflicts} icon={AlertTriangle} color="amber" />
        <Stat label="Investigations" value={stats.totalInvestigationsIngested} icon={History} color="green" />
        <Stat label="Avg Conf" value={`${(stats.avgConfidence * 100).toFixed(0)}%`} icon={TrendingUp} color="green" />
        <Stat label="Sources" value={stats.topSources.length} icon={Layers} color="cyan" />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 flex-wrap">
        <ViewTab active={view === "overview"} onClick={() => setView("overview")} icon={Database} label="Overview" />
        <ViewTab active={view === "entities"} onClick={() => setView("entities")} icon={Boxes} label={`Entities (${stats.totalEntities})`} />
        <ViewTab active={view === "relationships"} onClick={() => setView("relationships")} icon={Network} label={`Relationships (${stats.totalRelationships})`} />
        <ViewTab active={view === "evidence"} onClick={() => setView("evidence")} icon={FileText} label="Evidence" />
        <ViewTab active={view === "conflicts"} onClick={() => setView("conflicts")} icon={AlertTriangle} label={`Conflicts (${stats.openConflicts})`} />
        <ViewTab active={view === "search"} onClick={() => setView("search")} icon={Search} label="Search" />
      </div>

      {/* Entity detail modal */}
      {selectedEntity && (
        <EntityDetailDialog
          detail={selectedEntity}
          onClose={() => setSelectedEntity(null)}
          onOpenEntity={(id) => openEntity(id)}
        />
      )}
      {entityLoading && (
        <div className="border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/5 p-3 text-center">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--hack-cyan)] mx-auto" />
          <p className="font-mono text-[10px] text-[var(--hack-cyan)] mt-1">Loading entity detail...</p>
        </div>
      )}

      {/* OVERVIEW VIEW */}
      {view === "overview" && (
        <div className="space-y-4">
          {/* Top entities by observation count */}
          <div>
            <SectionHeader icon={TrendingUp} title="Top Entities (by observations)" color="green" />
            <div className="space-y-1 max-h-72 overflow-y-auto custom-scroll">
              {report.topEntities.length === 0 ? (
                <EmptyState message="No entities yet. Run an investigation to populate the KB." />
              ) : (
                report.topEntities.map((ent) => (
                  <EntityRow key={ent.id} entity={ent} onClick={() => openEntity(ent.id)} />
                ))
              )}
            </div>
          </div>

          {/* Entities by type distribution */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <SectionHeader icon={Boxes} title="Entity Distribution" color="cyan" />
              <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1.5">
                {Object.entries(stats.entitiesByType).length === 0 ? (
                  <p className="font-mono text-[10px] text-[var(--hack-gray)]/60 text-center py-2">No data</p>
                ) : (
                  Object.entries(stats.entitiesByType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => {
                      const max = Math.max(...Object.values(stats.entitiesByType));
                      const Icon = TYPE_ICONS[type] || Boxes;
                      return (
                        <div key={type} className="flex items-center gap-2">
                          <Icon className={`h-3 w-3 shrink-0 ${TYPE_COLORS[type] || "text-[var(--hack-gray)]"}`} />
                          <span className="font-mono text-[10px] text-[var(--hack-gray)] w-20 shrink-0 capitalize">{type}</span>
                          <div className="flex-1 h-2 bg-black/40">
                            <div className="h-full bg-[var(--hack-cyan)]/40" style={{ width: `${(count / max) * 100}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-[var(--hack-cyan)] w-8 text-right">{count}</span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div>
              <SectionHeader icon={Network} title="Relationship Distribution" color="green" />
              <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1.5">
                {Object.entries(stats.relationshipsByType).length === 0 ? (
                  <p className="font-mono text-[10px] text-[var(--hack-gray)]/60 text-center py-2">No relationships</p>
                ) : (
                  Object.entries(stats.relationshipsByType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => {
                      const max = Math.max(...Object.values(stats.relationshipsByType));
                      return (
                        <div key={type} className="flex items-center gap-2">
                          <Link2 className={`h-3 w-3 shrink-0 ${RELATION_COLORS[type] || "text-[var(--hack-gray)]"}`} />
                          <span className="font-mono text-[10px] text-[var(--hack-gray)] w-28 shrink-0 lowercase">{type.replace(/_/g, " ")}</span>
                          <div className="flex-1 h-2 bg-black/40">
                            <div className="h-full bg-[var(--hack-green)]/40" style={{ width: `${(count / max) * 100}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-[var(--hack-green)] w-8 text-right">{count}</span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>

          {/* Top sources */}
          <div>
            <SectionHeader icon={Layers} title="Top Contributing Sources" color="cyan" />
            <div className="border border-[var(--hack-border)] bg-black/20 p-3 space-y-1">
              {stats.topSources.length === 0 ? (
                <p className="font-mono text-[10px] text-[var(--hack-gray)]/60 text-center py-2">No sources yet</p>
              ) : (
                stats.topSources.map((s) => (
                  <div key={s.sourceKey} className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-[var(--hack-cyan)]">{s.sourceLabel}</span>
                    <span className="text-[var(--hack-gray)]/60">{s.count} evidence</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent investigations ingested */}
          <div>
            <SectionHeader icon={History} title="Recent Investigations Ingested" color="green" />
            <div className="space-y-1 max-h-60 overflow-y-auto custom-scroll">
              {report.recentInvestigations.length === 0 ? (
                <EmptyState message="No investigations ingested yet." />
              ) : (
                report.recentInvestigations.map((inv) => (
                  <div key={inv.investigationId} className="border border-[var(--hack-border)] bg-black/20 p-2 flex items-center gap-2">
                    <GitBranch className="h-3 w-3 text-[var(--hack-green)] shrink-0" />
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 uppercase shrink-0">{inv.investigationKind}</span>
                    <span className="font-mono text-[10px] text-[var(--hack-cyan)] truncate flex-1">{inv.target || inv.investigationId}</span>
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">{inv.entityCount} ent</span>
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 shrink-0">{formatRelativeTime(inv.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ENTITIES VIEW */}
      {view === "entities" && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scroll">
          {report.recentEntities.length === 0 ? (
            <EmptyState message="No entities in the Knowledge Base yet. Complete an investigation to populate." />
          ) : (
            report.recentEntities.map((ent) => (
              <EntityRow key={ent.id} entity={ent} onClick={() => openEntity(ent.id)} expanded={expandedSecs.has(ent.id)} onToggle={() => toggleSec(ent.id)} />
            ))
          )}
        </div>
      )}

      {/* RELATIONSHIPS VIEW */}
      {view === "relationships" && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scroll">
          {report.recentRelationships.length === 0 ? (
            <EmptyState message="No relationships in the Knowledge Base yet." />
          ) : (
            report.recentRelationships.map((rel) => {
              const Icon = TYPE_ICONS["domain"] || Link2;
              return (
                <div key={rel.id} className="border border-[var(--hack-border)] bg-black/20 p-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link2 className={`h-3.5 w-3.5 shrink-0 ${RELATION_COLORS[rel.relationType] || "text-[var(--hack-gray)]"}`} />
                    <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{rel.fromName || rel.fromEntityId.slice(0, 12)}</span>
                    <ArrowRight className="h-3 w-3 text-[var(--hack-gray)]/40" />
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 lowercase">{rel.relationType.replace(/_/g, " ")}</span>
                    <ArrowRight className="h-3 w-3 text-[var(--hack-gray)]/40" />
                    <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{rel.toName || rel.toEntityId.slice(0, 12)}</span>
                    <span className="font-mono text-[9px] text-[var(--hack-green)] ml-auto">{(rel.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 font-mono text-[9px] text-[var(--hack-gray)]/50">
                    <span>{rel.observationCount} obs</span>
                    <span>{rel.investigationCount} inv</span>
                    <span>tier {rel.tier}</span>
                    <span className="truncate">{rel.sourceLabel}</span>
                    <span className="ml-auto">{formatRelativeTime(rel.lastSeenAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* EVIDENCE VIEW — show recent evidence */}
      {view === "evidence" && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scroll">
          {stats.recentActivity.length === 0 ? (
            <EmptyState message="No evidence artifacts yet." />
          ) : (
            // Note: We use recentActivity as a proxy since we don't have a dedicated evidence list endpoint
            // in this panel — the entity detail view shows full evidence per entity.
            <div className="border border-[var(--hack-border)] bg-black/20 p-3">
              <p className="font-mono text-[10px] text-[var(--hack-gray)] mb-2">
                {"// Evidence artifacts are linked to specific entities. Click any entity to view its full evidence chain."}
              </p>
              <div className="space-y-1">
                {stats.recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                    <Clock className="h-3 w-3 text-[var(--hack-gray)]/40 shrink-0" />
                    <span className="text-[var(--hack-cyan)]/60 uppercase text-[9px]">{a.kind}</span>
                    <span className="text-[var(--hack-gray)] truncate">{a.description}</span>
                    <span className="text-[var(--hack-gray)]/40 ml-auto shrink-0">{formatRelativeTime(a.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONFLICTS VIEW */}
      {view === "conflicts" && (
        <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scroll">
          {stats.openConflicts === 0 ? (
            <EmptyState message="No open conflicts. The KB is consistent." icon={CheckCircle2} />
          ) : (
            <div className="border border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/5 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-[var(--hack-amber)]" />
                <span className="font-mono text-xs text-[var(--hack-amber)] uppercase">Conflicting Information Preserved</span>
              </div>
              <p className="font-mono text-[10px] text-[var(--hack-gray)]">
                {stats.openConflicts} open conflict(s) detected — sources disagree on entity attributes.
                Both sides are preserved for analyst review. Click an entity to see its conflicts in detail.
              </p>
            </div>
          )}
          {/* Show top entities — analyst can click through to see conflicts */}
          {report.topEntities
            .filter((e) => e.attributes && Object.keys(e.attributes).length > 0)
            .slice(0, 10)
            .map((ent) => (
              <EntityRow key={ent.id} entity={ent} onClick={() => openEntity(ent.id)} compact />
            ))
          }
        </div>
      )}

      {/* SEARCH VIEW */}
      {view === "search" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hack-gray)]/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") doSearch(searchQuery); }}
                placeholder="Search entities, relationships, evidence..."
                className="w-full pl-8 pr-3 py-2 bg-black/40 border border-[var(--hack-border)] font-mono text-xs text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-cyan)]/40"
              />
            </div>
            <button
              onClick={() => doSearch(searchQuery)}
              disabled={searching || !searchQuery.trim()}
              className="flex items-center gap-1 border border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 px-3 py-2 font-mono text-[10px] text-[var(--hack-cyan)] uppercase hover:bg-[var(--hack-cyan)]/20 disabled:opacity-30"
            >
              {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Search
            </button>
          </div>

          {searchResult && (
            <div className="space-y-3">
              <div className="font-mono text-[10px] text-[var(--hack-gray)]">
                {searchResult.totalMatches} matches for &quot;<span className="text-[var(--hack-cyan)]">{searchResult.query}</span>&quot;
                {" — "}
                {searchResult.entities.length} entities, {searchResult.relationships.length} relationships, {searchResult.evidence.length} evidence
              </div>

              {searchResult.entities.length > 0 && (
                <div>
                  <SectionHeader icon={Boxes} title="Matching Entities" color="cyan" />
                  <div className="space-y-1">
                    {searchResult.entities.map((ent) => (
                      <EntityRow key={ent.id} entity={ent} onClick={() => openEntity(ent.id)} compact />
                    ))}
                  </div>
                </div>
              )}

              {searchResult.relationships.length > 0 && (
                <div>
                  <SectionHeader icon={Network} title="Matching Relationships" color="green" />
                  <div className="space-y-1">
                    {searchResult.relationships.map((rel) => (
                      <div key={rel.id} className="border border-[var(--hack-border)] bg-black/20 p-2 font-mono text-[10px]">
                        <span className="text-[var(--hack-cyan)]">{rel.fromName}</span>
                        <span className="text-[var(--hack-gray)]/40 mx-1">→</span>
                        <span className="text-[var(--hack-gray)]/60 lowercase">{rel.relationType.replace(/_/g, " ")}</span>
                        <span className="text-[var(--hack-gray)]/40 mx-1">→</span>
                        <span className="text-[var(--hack-cyan)]">{rel.toName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResult.evidence.length > 0 && (
                <div>
                  <SectionHeader icon={FileText} title="Matching Evidence" color="cyan" />
                  <div className="space-y-1 max-h-72 overflow-y-auto custom-scroll">
                    {searchResult.evidence.map((ev) => (
                      <div key={ev.id} className="border border-[var(--hack-border)] bg-black/20 p-2">
                        <div className="flex items-center gap-2 font-mono text-[9px] text-[var(--hack-gray)]/60 mb-1">
                          <span className="text-[var(--hack-cyan)]">{ev.sourceLabel}</span>
                          <span>tier {ev.tier}</span>
                          <span>{(ev.confidence * 100).toFixed(0)}%</span>
                          <span className="ml-auto">{formatRelativeTime(ev.observedAt)}</span>
                        </div>
                        <p className="font-mono text-[10px] text-[var(--hack-gray)] line-clamp-2">{ev.rawText}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchResult.totalMatches === 0 && (
                <EmptyState message={`No matches for "${searchResult.query}".`} />
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline error */}
      {error && (
        <div className="border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/5 p-2">
          <p className="font-mono text-[10px] text-[var(--hack-red)]">{error}</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Entity Row
// ============================================================================

function EntityRow({
  entity, onClick, expanded, onToggle, compact,
}: {
  entity: KBEntity;
  onClick: () => void;
  expanded?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}) {
  const Icon = TYPE_ICONS[entity.type] || Boxes;
  const color = TYPE_COLORS[entity.type] || "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/20 hover:bg-[var(--hack-cyan)]/5 transition">
      <div className="flex items-center gap-2 p-2">
        {onToggle && (
          <button onClick={onToggle} className="shrink-0">
            {expanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
          </button>
        )}
        <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
        <button onClick={onClick} className="flex-1 text-left min-w-0">
          <span className={`font-mono text-xs ${color} truncate block`}>{entity.primaryName}</span>
        </button>
        {entity.aliases.length > 0 && (
          <span className="font-mono text-[9px] text-[var(--hack-gray)]/50 shrink-0">+{entity.aliases.length} alias</span>
        )}
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 shrink-0">{entity.observationCount} obs</span>
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 shrink-0">{entity.investigationCount} inv</span>
        {!compact && <span className="font-mono text-[9px] text-[var(--hack-green)] shrink-0">v{entity.version}</span>}
        <span className="font-mono text-[9px] text-[var(--hack-cyan)]/60 shrink-0">{(entity.confidence * 100).toFixed(0)}%</span>
      </div>
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {entity.aliases.length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Aliases: </span>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {entity.aliases.map((a, i) => (
                  <span key={i} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1 text-[var(--hack-cyan)]">{a}</span>
                ))}
              </div>
            </div>
          )}
          {Object.keys(entity.attributes).length > 0 && (
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60">Attributes:</span>
              <div className="space-y-0.5 mt-0.5">
                {Object.entries(entity.attributes).slice(0, 6).map(([k, v]) => (
                  <div key={k} className="font-mono text-[10px]">
                    <span className="text-[var(--hack-gray)]/60">{k}:</span>{" "}
                    <span className="text-[var(--hack-green)]">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 font-mono text-[9px] text-[var(--hack-gray)]/50">
            <span>first: {formatRelativeTime(entity.firstSeenAt)}</span>
            <span>last: {formatRelativeTime(entity.lastSeenAt)}</span>
            <span>tier {entity.tier}</span>
            <button onClick={onClick} className="ml-auto text-[var(--hack-cyan)] hover:underline">
              view detail →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Entity Detail Dialog
// ============================================================================

function EntityDetailDialog({
  detail, onClose, onOpenEntity,
}: {
  detail: KBEntityDetail;
  onClose: () => void;
  onOpenEntity: (id: string) => void;
}) {
  const { entity, evidence, relationships, conflicts, versions, investigations } = detail;
  const Icon = TYPE_ICONS[entity.type] || Boxes;
  const color = TYPE_COLORS[entity.type] || "text-[var(--hack-gray)]";
  const [tab, setTab] = useState<"evidence" | "relationships" | "conflicts" | "history" | "investigations">("evidence");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--hack-bg)] border border-[var(--hack-cyan)]/40 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[var(--hack-border)] p-4 flex items-start gap-3">
          <Icon className={`h-6 w-6 shrink-0 mt-0.5 ${color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className={`font-mono text-base font-bold ${color} truncate`}>{entity.primaryName}</h2>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/60 border border-[var(--hack-border)] px-1.5 py-0.5">{entity.type}</span>
              {entity.status !== "active" && (
                <span className="font-mono text-[9px] uppercase text-[var(--hack-amber)] border border-[var(--hack-amber)]/40 px-1.5 py-0.5">{entity.status}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-[var(--hack-gray)]/60 flex-wrap">
              <span>{entity.observationCount} observations</span>
              <span>{entity.investigationCount} investigations</span>
              <span>v{entity.version}</span>
              <span className="text-[var(--hack-green)]">{(entity.confidence * 100).toFixed(0)}% conf</span>
              <span>tier {entity.tier}</span>
              <span>first: {formatRelativeTime(entity.firstSeenAt)}</span>
              <span>last: {formatRelativeTime(entity.lastSeenAt)}</span>
            </div>
            {entity.aliases.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="font-mono text-[9px] text-[var(--hack-gray)]/60">aliases:</span>
                {entity.aliases.map((a, i) => (
                  <span key={i} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1 text-[var(--hack-cyan)]">{a}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="font-mono text-xs text-[var(--hack-gray)] hover:text-[var(--hack-red)]">✕</button>
        </div>

        {/* Tabs */}
        <div className="border-b border-[var(--hack-border)] flex items-center gap-0.5 px-2">
          <DetailTab active={tab === "evidence"} onClick={() => setTab("evidence")} icon={FileText} label={`Evidence (${evidence.length})`} />
          <DetailTab active={tab === "relationships"} onClick={() => setTab("relationships")} icon={Network} label={`Relationships (${relationships.length})`} />
          <DetailTab active={tab === "conflicts"} onClick={() => setTab("conflicts")} icon={AlertTriangle} label={`Conflicts (${conflicts.length})`} />
          <DetailTab active={tab === "history"} onClick={() => setTab("history")} icon={History} label={`History (${versions.length})`} />
          <DetailTab active={tab === "investigations"} onClick={() => setTab("investigations")} icon={GitBranch} label={`Investigations (${investigations.length})`} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scroll p-4">
          {tab === "evidence" && (
            <div className="space-y-2">
              {evidence.length === 0 ? (
                <p className="font-mono text-xs text-[var(--hack-gray)]/60 text-center py-4">No evidence artifacts.</p>
              ) : (
                evidence.map((ev) => <EvidenceCard key={ev.id} evidence={ev} />)
              )}
            </div>
          )}

          {tab === "relationships" && (
            <div className="space-y-2">
              {relationships.length === 0 ? (
                <p className="font-mono text-xs text-[var(--hack-gray)]/60 text-center py-4">No relationships.</p>
              ) : (
                relationships.map((rel) => (
                  <div key={rel.id} className="border border-[var(--hack-border)] bg-black/20 p-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link2 className={`h-3.5 w-3.5 shrink-0 ${RELATION_COLORS[rel.relationType] || "text-[var(--hack-gray)]"}`} />
                      <button
                        onClick={() => onOpenEntity(rel.fromEntityId === entity.id ? rel.toEntityId : rel.fromEntityId)}
                        className="font-mono text-[10px] text-[var(--hack-cyan)] hover:underline"
                      >
                        {rel.fromEntityId === entity.id ? `→ ${rel.toName}` : `${rel.fromName} →`}
                      </button>
                      <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 lowercase">{rel.relationType.replace(/_/g, " ")}</span>
                      <span className="font-mono text-[9px] text-[var(--hack-green)] ml-auto">{(rel.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 font-mono text-[9px] text-[var(--hack-gray)]/50">
                      <span>{rel.observationCount} obs</span>
                      <span>{rel.investigationCount} inv</span>
                      <span>tier {rel.tier}</span>
                      <span className="truncate">{rel.sourceLabel}</span>
                      <span className="ml-auto">{formatRelativeTime(rel.lastSeenAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "conflicts" && (
            <div className="space-y-2">
              {conflicts.length === 0 ? (
                <div className="flex items-center gap-2 text-center py-4">
                  <CheckCircle2 className="h-4 w-4 text-[var(--hack-green)] mx-auto" />
                  <p className="font-mono text-xs text-[var(--hack-green)]">No conflicts. All sources agree.</p>
                </div>
              ) : (
                conflicts.map((c) => (
                  <div key={c.id} className="border border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/5 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-[var(--hack-amber)]" />
                      <span className="font-mono text-[10px] text-[var(--hack-amber)] uppercase">{c.field}</span>
                      <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 ml-auto">{c.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="border border-[var(--hack-border)] bg-black/40 p-2">
                        <div className="font-mono text-[9px] text-[var(--hack-gray)]/60 uppercase mb-1">Value A</div>
                        <div className="font-mono text-[10px] text-[var(--hack-cyan)]">{c.valueA}</div>
                        <div className="font-mono text-[9px] text-[var(--hack-gray)]/50 mt-1">src: {c.sourceKeyA}</div>
                      </div>
                      <div className="border border-[var(--hack-border)] bg-black/40 p-2">
                        <div className="font-mono text-[9px] text-[var(--hack-gray)]/60 uppercase mb-1">Value B</div>
                        <div className="font-mono text-[10px] text-[var(--hack-cyan)]">{c.valueB}</div>
                        <div className="font-mono text-[9px] text-[var(--hack-gray)]/50 mt-1">src: {c.sourceKeyB}</div>
                      </div>
                    </div>
                    {c.resolution && (
                      <p className="font-mono text-[9px] text-[var(--hack-green)] mt-2">Resolution: {c.resolution}</p>
                    )}
                    <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-1">detected: {formatRelativeTime(c.detectedAt)}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-2">
              {versions.length === 0 ? (
                <p className="font-mono text-xs text-[var(--hack-gray)]/60 text-center py-4">No version history.</p>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="border border-[var(--hack-border)] bg-black/20 p-2.5">
                    <div className="flex items-center gap-2">
                      <History className="h-3 w-3 text-[var(--hack-cyan)]" />
                      <span className="font-mono text-[10px] text-[var(--hack-cyan)]">v{v.versionNumber}</span>
                      <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 uppercase">{v.changeType}</span>
                      <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 ml-auto">{formatRelativeTime(v.createdAt)}</span>
                    </div>
                    <p className="font-mono text-[10px] text-[var(--hack-gray)] mt-1">{v.changeReason}</p>
                    {v.validTo && (
                      <p className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-0.5">
                        valid: {formatRelativeTime(v.validFrom)} → {formatRelativeTime(v.validTo)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "investigations" && (
            <div className="space-y-2">
              {investigations.length === 0 ? (
                <p className="font-mono text-xs text-[var(--hack-gray)]/60 text-center py-4">No investigation contributions.</p>
              ) : (
                investigations.map((inv, i) => (
                  <div key={i} className="border border-[var(--hack-border)] bg-black/20 p-2.5 flex items-center gap-2">
                    <GitBranch className="h-3 w-3 text-[var(--hack-green)]" />
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 uppercase">{inv.investigationKind}</span>
                    <span className="font-mono text-[10px] text-[var(--hack-cyan)] truncate">{inv.investigationId}</span>
                    <span className="font-mono text-[9px] text-[var(--hack-green)] uppercase ml-auto">{inv.contributionType}</span>
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]/40">{formatRelativeTime(inv.timestamp)}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Evidence Card
// ============================================================================

function EvidenceCard({ evidence }: { evidence: KBEvidence }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-[var(--hack-border)] bg-black/20 p-2.5">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <FileText className="h-3 w-3 text-[var(--hack-cyan)] shrink-0" />
        <span className="font-mono text-[10px] text-[var(--hack-cyan)]">{evidence.sourceLabel}</span>
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/50">tier {evidence.tier}</span>
        <span className="font-mono text-[9px] text-[var(--hack-green)]">{(evidence.confidence * 100).toFixed(0)}%</span>
        <span className="font-mono text-[9px] text-[var(--hack-gray)]/40 ml-auto">{formatRelativeTime(evidence.observedAt)}</span>
      </div>
      <p className={`font-mono text-[10px] text-[var(--hack-gray)] ${expanded ? "" : "line-clamp-2"}`}>{evidence.rawText}</p>
      {evidence.rawText.length > 120 && (
        <button onClick={() => setExpanded((v) => !v)} className="font-mono text-[9px] text-[var(--hack-cyan)] mt-1 hover:underline">
          {expanded ? "− show less" : "+ show more"}
        </button>
      )}
      {evidence.sourceUrl && (
        <a href={evidence.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-[9px] text-[var(--hack-cyan)]/60 hover:underline mt-1 block truncate">
          {evidence.sourceUrl}
        </a>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Stat({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : color === "cyan" ? "text-[var(--hack-cyan)]" : "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 p-2 text-center">
      <Icon className={`h-3 w-3 mx-auto mb-0.5 ${c}`} />
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function ViewTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
        active
          ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]"
          : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:border-[var(--hack-cyan)]/30"
      }`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function DetailTab({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider border-b-2 transition ${
        active
          ? "border-[var(--hack-cyan)] text-[var(--hack-cyan)]"
          : "border-transparent text-[var(--hack-gray)] hover:text-[var(--hack-cyan)]"
      }`}
    >
      <Icon className="h-3 w-3" /> {label}
    </button>
  );
}

function SectionHeader({ icon: Icon, title, color }: { icon: React.ElementType; title: string; color: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <Icon className={`h-3.5 w-3.5 ${c}`} />
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">{title}</span>
    </div>
  );
}

function EmptyState({ message, icon: Icon = Eye }: { message: string; icon?: React.ElementType }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/20 p-6 text-center">
      <Icon className="h-5 w-5 text-[var(--hack-gray)]/40 mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{message}</p>
    </div>
  );
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - d);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  } catch {
    return iso;
  }
}
