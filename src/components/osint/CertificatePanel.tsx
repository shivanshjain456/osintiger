"use client";

import { useState, useEffect } from "react";
import { Loader2, Lock, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Globe, GitBranch, Clock, Network } from "lucide-react";

// =====================
// Types (matching backend)
// =====================

interface CertificateEntry {
  id: string; domains: string[]; wildcardDomains: string[]; issuer: string;
  issuerType: string; isWildcard: boolean; source: string; sourceLabel: string;
  tier: number; evidence: string; confidence: number;
}
interface IssuerInfo { name: string; type: string; certCount: number; domainsCovered: string[]; reusedAcrossAssets: boolean; }
interface IssuerAnalysis { issuers: IssuerInfo[]; uniqueIssuers: number; publicCACount: number; privateCACount: number; selfSignedCount: number; topIssuer: string | null; summary: string; }
interface SANInfo { domain: string; isWildcard: boolean; isIP: boolean; certCount: number; isNewDiscovery: boolean; }
interface SANAnalysis { sans: SANInfo[]; uniqueDomains: number; wildcardCount: number; ipCount: number; newDiscoveries: string[]; summary: string; }
interface HistoricalEntry { domain: string; issuer: string; source: string; sourceLabel: string; timestamp: string; }
interface HistoricalAnalysis { entries: HistoricalEntry[]; totalObservations: number; uniqueDomains: number; earliestObservation: string | null; latestObservation: string | null; summary: string; }
interface ReuseCluster { issuer: string; domains: string[]; certCount: number; inferredRelationship: string; }
interface ReuseAnalysis { clusters: ReuseCluster[]; reusedIssuers: number; crossDomainCerts: number; summary: string; }
interface WildcardInfo { pattern: string; coveredDomains: string[]; potentialSubdomains: string; riskLevel: string; }
interface WildcardAnalysis { wildcards: WildcardInfo[]; totalWildcards: number; coveredDomainCount: number; summary: string; }
interface SharedInfraCluster { sharedAttribute: string; attributeValue: string; domains: string[]; inferredRelationship: string; }
interface SharedInfraAnalysis { clusters: SharedInfraCluster[]; totalClusters: number; summary: string; }
interface ExpirationInfo { domain: string; status: string; detail: string; }
interface ExpirationAnalysis { entries: ExpirationInfo[]; activeCount: number; expiringCount: number; expiredCount: number; summary: string; }
interface CertGraph { nodes: { id: string; label: string; type: string }[]; edges: { from: string; to: string; label: string }[]; }

interface CertIntelligenceReport {
  certificates: CertificateEntry[];
  issuerAnalysis: IssuerAnalysis;
  sanAnalysis: SANAnalysis;
  historicalAnalysis: HistoricalAnalysis;
  reuseAnalysis: ReuseAnalysis;
  wildcardAnalysis: WildcardAnalysis;
  sharedInfraAnalysis: SharedInfraAnalysis;
  expirationAnalysis: ExpirationAnalysis;
  graph: CertGraph;
  assessment: {
    totalCertificates: number; uniqueDomains: number; uniqueIssuers: number;
    wildcardCerts: number; newDiscoveries: number; securityPosture: string; explanation: string;
  };
  meta: { sourcesAnalyzed: number; findingsAnalyzed: number; generatedAt: string };
}

interface Props { investigationId: string; apiPath: "standard" | "agent"; }

const POSTURE_COLORS: Record<string, string> = {
  strong: "text-[var(--hack-green)]", moderate: "text-[var(--hack-amber)]", weak: "text-[var(--hack-red)]", unknown: "text-[var(--hack-gray)]",
};
const ISSUER_TYPE_COLORS: Record<string, string> = {
  public_ca: "text-[var(--hack-green)]", private_ca: "text-[var(--hack-amber)]", self_signed: "text-[var(--hack-red)]", unknown: "text-[var(--hack-gray)]",
};
const NODE_TYPE_COLORS: Record<string, string> = {
  certificate: "#00ffff", domain: "#ffaa00", issuer: "#00ff41", wildcard: "#ff0040",
};

export function CertificatePanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<CertIntelligenceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSecs, setExpandedSecs] = useState<Set<string>>(new Set(["issuers", "sans"]));

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/certificates`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled && data.report) { setReport(data.report); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» analyzing certificate intelligence..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { assessment, certificates, issuerAnalysis, sanAnalysis, historicalAnalysis, reuseAnalysis, wildcardAnalysis, sharedInfraAnalysis, expirationAnalysis, graph } = report;

  const toggleSec = (s: string) => setExpandedSecs((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Assessment */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Certificate Intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Posture</div>
              <div className={`font-mono text-lg font-bold ${POSTURE_COLORS[assessment.securityPosture] || "text-[var(--hack-gray)]"}`}>
                {assessment.securityPosture.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Certificates" value={assessment.totalCertificates} />
        <Stat label="Domains" value={assessment.uniqueDomains} />
        <Stat label="Issuers" value={assessment.uniqueIssuers} />
        <Stat label="Wildcards" value={assessment.wildcardCerts} color="amber" />
        <Stat label="New Discoveries" value={assessment.newDiscoveries} color="green" />
      </div>

      {/* Issuers */}
      {issuerAnalysis.issuers.length > 0 && (
        <Section title="Issuers" icon={Lock} expanded={expandedSecs.has("issuers")} onToggle={() => toggleSec("issuers")} summary={issuerAnalysis.summary}>
          <div className="space-y-1.5">
            {issuerAnalysis.issuers.map((iss, i) => (
              <div key={i} className="flex items-center gap-2 border border-[var(--hack-border)]/30 px-2 py-1">
                <span className={`font-mono text-[8px] px-1 py-0.5 border shrink-0 ${ISSUER_TYPE_COLORS[iss.type] || "text-[var(--hack-gray)]"} border-current`}>
                  {iss.type.toUpperCase().replace("_", " ")}
                </span>
                <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">{iss.name}</span>
                <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">{iss.certCount} certs</span>
                <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 shrink-0">{iss.domainsCovered.length} domains</span>
                {iss.reusedAcrossAssets && <span className="font-mono text-[8px] text-[var(--hack-amber)] shrink-0">REUSED</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* SANs */}
      {sanAnalysis.sans.length > 0 && (
        <Section title="Subject Alternative Names (SANs)" icon={Globe} expanded={expandedSecs.has("sans")} onToggle={() => toggleSec("sans")} summary={sanAnalysis.summary}>
          <div className="flex flex-wrap gap-1.5">
            {sanAnalysis.sans.map((san, i) => (
              <span key={i} className={`font-mono text-[9px] border px-1.5 py-0.5 ${
                san.isWildcard ? "border-[var(--hack-red)]/30 text-[var(--hack-red)]" :
                san.isIP ? "border-[var(--hack-purple)]/30 text-[var(--hack-purple)]" :
                san.isNewDiscovery ? "border-[var(--hack-green)]/30 text-[var(--hack-green)] bg-[var(--hack-green)]/5" :
                "border-[var(--hack-border)] text-[var(--hack-gray)]"
              }`} title={`${san.certCount} cert(s)${san.isNewDiscovery ? " — NEW DISCOVERY" : ""}`}>
                {san.isWildcard && "🔒 "}{san.domain}{san.isNewDiscovery && " ✨"}
              </span>
            ))}
          </div>
          {sanAnalysis.newDiscoveries.length > 0 && (
            <p className="font-mono text-[9px] text-[var(--hack-green)]/70 mt-2">
              {sanAnalysis.newDiscoveries.length} new domain discoveries — these domains were found in certificate SANs but don't match the original target.
            </p>
          )}
        </Section>
      )}

      {/* Wildcards */}
      {wildcardAnalysis.wildcards.length > 0 && (
        <Section title="Wildcard Certificates" icon={Lock} expanded={expandedSecs.has("wildcards")} onToggle={() => toggleSec("wildcards")} summary={wildcardAnalysis.summary}>
          <div className="space-y-2">
            {wildcardAnalysis.wildcards.map((wc, i) => (
              <div key={i} className="border border-[var(--hack-red)]/20 bg-[var(--hack-red)]/5 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-[var(--hack-red)] font-bold">{wc.pattern}</span>
                  <span className={`font-mono text-[8px] px-1 py-0.5 border ${
                    wc.riskLevel === "high" ? "text-[var(--hack-red)] border-[var(--hack-red)]/40" :
                    wc.riskLevel === "medium" ? "text-[var(--hack-amber)] border-[var(--hack-amber)]/40" :
                    "text-[var(--hack-gray)] border-[var(--hack-border)]"
                  }`}>{wc.riskLevel.toUpperCase()}</span>
                  <span className="font-mono text-[9px] text-[var(--hack-gray)]/60 ml-auto">{wc.coveredDomains.length} covered</span>
                </div>
                {wc.coveredDomains.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {wc.coveredDomains.slice(0, 8).map((d, j) => (
                      <span key={j} className="font-mono text-[8px] text-[var(--hack-gray)]/60">{d}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Reuse Analysis */}
      {reuseAnalysis.clusters.length > 0 && (
        <Section title="Certificate Reuse" icon={GitBranch} expanded={expandedSecs.has("reuse")} onToggle={() => toggleSec("reuse")} summary={reuseAnalysis.summary}>
          <div className="space-y-2">
            {reuseAnalysis.clusters.map((cluster, i) => (
              <div key={i} className="border border-[var(--hack-cyan)]/20 bg-[var(--hack-cyan)]/5 px-2 py-1.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-[var(--hack-cyan)] font-bold">Issuer: {cluster.issuer}</span>
                  <span className="font-mono text-[9px] text-[var(--hack-gray)]/60">{cluster.certCount} certs, {cluster.domains.length} domains</span>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {cluster.domains.slice(0, 8).map((d, j) => (
                    <span key={j} className="font-mono text-[8px] border border-[var(--hack-border)] bg-black/40 px-1 text-[var(--hack-green)]">{d}</span>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--hack-gray)]/70 italic">{cluster.inferredRelationship}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Shared Infrastructure */}
      {sharedInfraAnalysis.clusters.length > 0 && (
        <Section title="Shared Infrastructure" icon={Network} expanded={expandedSecs.has("shared")} onToggle={() => toggleSec("shared")} summary={sharedInfraAnalysis.summary}>
          <div className="space-y-2">
            {sharedInfraAnalysis.clusters.map((cluster, i) => (
              <div key={i} className="border border-[var(--hack-border)]/30 px-2 py-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[9px] text-[var(--hack-cyan)]">{cluster.sharedAttribute}:</span>
                  <span className="font-mono text-[10px] text-[var(--hack-green)] truncate">{cluster.attributeValue}</span>
                </div>
                <p className="text-[10px] text-[var(--hack-gray)]/70 italic">{cluster.inferredRelationship}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Expiration */}
      {expirationAnalysis.entries.length > 0 && (
        <Section title="Expiration Tracking" icon={Clock} expanded={expandedSecs.has("expiration")} onToggle={() => toggleSec("expiration")} summary={expirationAnalysis.summary}>
          <div className="space-y-1">
            {expirationAnalysis.entries.slice(0, 15).map((e, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                {e.status === "active" ? <CheckCircle2 className="h-3 w-3 text-[var(--hack-green)] shrink-0" /> :
                 e.status === "expired" ? <AlertTriangle className="h-3 w-3 text-[var(--hack-red)] shrink-0" /> :
                 e.status === "expiring_soon" ? <Clock className="h-3 w-3 text-[var(--hack-amber)] shrink-0" /> :
                 <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
                <span className="text-[var(--hack-green)] truncate flex-1">{e.domain}</span>
                <span className={`shrink-0 ${e.status === "expired" ? "text-[var(--hack-red)]" : e.status === "expiring_soon" ? "text-[var(--hack-amber)]" : "text-[var(--hack-gray)]/60"}`}>
                  {e.detail}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Historical */}
      {historicalAnalysis.entries.length > 0 && (
        <Section title="Historical Record" icon={Clock} expanded={expandedSecs.has("historical")} onToggle={() => toggleSec("historical")} summary={historicalAnalysis.summary}>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {historicalAnalysis.entries.slice(0, 20).map((e, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-[var(--hack-gray)]/60 shrink-0">{new Date(e.timestamp).toLocaleDateString()}</span>
                <span className="text-[var(--hack-green)] truncate flex-1">{e.domain}</span>
                <span className="text-[var(--hack-gray)]/40 shrink-0">{e.sourceLabel.slice(0, 15)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Certificate Graph */}
      {graph.nodes.length > 0 && (
        <Section title="Certificate Graph" icon={GitBranch} expanded={expandedSecs.has("graph")} onToggle={() => toggleSec("graph")} summary={`${graph.nodes.length} nodes, ${graph.edges.length} edges`}>
          <div className="flex flex-wrap gap-1.5">
            {graph.nodes.map((node) => (
              <span key={node.id} className="font-mono text-[8px] border px-1.5 py-0.5" style={{ color: NODE_TYPE_COLORS[node.type] || "var(--hack-gray)", borderColor: `${NODE_TYPE_COLORS[node.type] || "var(--hack-gray)"}40` }}>
                {node.label.slice(0, 30)}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
              <span key={type} className="font-mono text-[8px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[var(--hack-gray)]/60">{type}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Certificate List */}
      {certificates.length > 0 && (
        <Section title="All Certificates" icon={Lock} expanded={expandedSecs.has("certs")} onToggle={() => toggleSec("certs")} summary={`${certificates.length} certificates discovered`}>
          <div className="space-y-1">
            {certificates.map((cert) => (
              <div key={cert.id} className="border border-[var(--hack-border)]/30 px-2 py-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  {cert.isWildcard && <span className="font-mono text-[8px] text-[var(--hack-red)]">🔒 WILDCARD</span>}
                  <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">
                    {cert.domains.slice(0, 3).join(", ")}{cert.domains.length > 3 ? ` +${cert.domains.length - 3}` : ""}
                  </span>
                  <span className={`font-mono text-[8px] ${ISSUER_TYPE_COLORS[cert.issuerType] || "text-[var(--hack-gray)]"}`}>
                    {cert.issuerType.toUpperCase().replace("_", " ")}
                  </span>
                </div>
                <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">
                  Issuer: {cert.issuer} · Source: {cert.sourceLabel} · {(cert.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// =====================
// Sub-components
// =====================

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "amber" ? "text-[var(--hack-amber)]" : "text-[var(--hack-cyan)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function Section({ title, icon: Icon, expanded, onToggle, summary, children }: {
  title: string; icon: React.ElementType; expanded: boolean; onToggle: () => void; summary: string; children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/20">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-cyan)]/5 transition-colors text-left">
        <Icon className="h-4 w-4 text-[var(--hack-cyan)] shrink-0" />
        <span className="font-mono text-xs text-[var(--hack-green)] flex-1">{title}</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-[var(--hack-gray)]/60 mb-2 italic">{summary}</p>
          {children}
        </div>
      )}
    </div>
  );
}
