"use client";

import { useState, useEffect } from "react";
import { Loader2, Globe, Server, Shield, Lock, Cloud, Cpu, ChevronDown, ChevronRight, CheckCircle2, XCircle } from "lucide-react";

// =====================
// Types
// =====================

interface DNSRecord { type: string; value: string; ttl?: number; source: string; sourceLabel: string; tier: number; timestamp: string; }
interface DNSHistory { records: DNSRecord[]; recordTypes: string[]; uniqueValues: number; summary: string; }
interface IPEntry { ip: string; version: string; source: string; sourceLabel: string; tier: number; timestamp: string; }
interface IPMigration { ips: IPEntry[]; ipv4Count: number; ipv6Count: number; uniqueIPs: number; summary: string; }
interface ASNEntry { asn: string; organization: string; ip: string; source: string; sourceLabel: string; tier: number; }
interface ASNEvolution { entries: ASNEntry[]; uniqueASNs: number; uniqueOrganizations: string[]; summary: string; }
interface CertificateEntry { issuer?: string; sanDomains: string[]; source: string; sourceLabel: string; tier: number; timestamp: string; }
interface SSLEvolution { certificates: CertificateEntry[]; totalCerts: number; uniqueSANs: string[]; uniqueIssuers: string[]; summary: string; }
interface HostingEntry { provider: string; type: string; detail: string; source: string; sourceLabel: string; tier: number; }
interface HostingEvolution { entries: HostingEntry[]; uniqueProviders: string[]; summary: string; }
interface TechEntry { technology: string; category: string; detail: string; source: string; sourceLabel: string; tier: number; }
interface TechEvolution { entries: TechEntry[]; uniqueTechnologies: string[]; byCategory: Record<string, number>; summary: string; }
interface SecurityHeader { name: string; present: boolean; value?: string; source: string; sourceLabel: string; }
interface SecurityPosture { headers: SecurityHeader[]; presentCount: number; missingCount: number; score: number; summary: string; }

interface InfraEvolutionReport {
  dns: DNSHistory;
  ipMigration: IPMigration;
  asnEvolution: ASNEvolution;
  sslEvolution: SSLEvolution;
  hostingEvolution: HostingEvolution;
  techEvolution: TechEvolution;
  securityPosture: SecurityPosture;
  summary: {
    totalDataPoints: number;
    dnsRecords: number;
    uniqueIPs: number;
    uniqueASNs: number;
    certificates: number;
    technologies: number;
    securityScore: number;
  };
  assessment: {
    infrastructureComplexity: string;
    securityGrade: string;
    explanation: string;
  };
  meta: { sourcesAnalyzed: number; findingsAnalyzed: number; generatedAt: string; };
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

const GRADE_COLORS: Record<string, string> = {
  A: "text-[var(--hack-green)]", B: "text-[var(--hack-cyan)]",
  C: "text-[var(--hack-amber)]", D: "text-[var(--hack-orange)]", F: "text-[var(--hack-red)]",
};

const SECTION_ICONS: Record<string, React.ElementType> = {
  dns: Globe, ip: Server, asn: Cloud, ssl: Lock, hosting: Cloud, tech: Cpu, security: Shield,
};

export function InfrastructureEvolutionPanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<InfraEvolutionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["security"]));

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/infrastructure`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        if (!cancelled && data.report) { setReport(data.report); setLoading(false); }
      })
      .catch((e) => {
        if (!cancelled) { setError(e instanceof Error ? e.message : "Failed to load"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]">{"» analyzing infrastructure evolution..."}</p>
      </div>
    );
  }
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { assessment, summary } = report;

  const toggleSection = (s: string) => setExpandedSections((prev) => {
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
            <Server className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Infrastructure Assessment</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Complexity</div>
              <div className={`font-mono text-sm font-bold ${assessment.infrastructureComplexity === "high" ? "text-[var(--hack-red)]" : assessment.infrastructureComplexity === "medium" ? "text-[var(--hack-amber)]" : "text-[var(--hack-green)]"}`}>
                {assessment.infrastructureComplexity.toUpperCase()}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Security Grade</div>
              <div className={`font-mono text-2xl font-bold ${GRADE_COLORS[assessment.securityGrade] || "text-[var(--hack-gray)]"}`}>
                {assessment.securityGrade}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <StatCard label="DNS Records" value={summary.dnsRecords} color="cyan" />
        <StatCard label="Unique IPs" value={summary.uniqueIPs} color="green" />
        <StatCard label="ASNs" value={summary.uniqueASNs} color="cyan" />
        <StatCard label="Certificates" value={summary.certificates} color="green" />
        <StatCard label="Technologies" value={summary.technologies} color="cyan" />
        <StatCard label="Security Score" value={`${summary.securityScore}%`} color="green" />
        <StatCard label="Data Points" value={summary.totalDataPoints} color="amber" />
      </div>

      {/* Security Posture (default expanded) */}
      <Section title="Security Posture" icon={Shield} iconColor="text-[var(--hack-green)]" expanded={expandedSections.has("security")} onToggle={() => toggleSection("security")} summary={report.securityPosture.summary}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 bg-black/40 border border-[var(--hack-border)]">
              <div className="h-full bg-[var(--hack-green)]" style={{ width: `${report.securityPosture.score}%` }} />
            </div>
            <span className="font-mono text-xs text-[var(--hack-green)] font-bold">{report.securityPosture.score}/100</span>
          </div>
          {report.securityPosture.headers.map((h, i) => (
            <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
              {h.present ? <CheckCircle2 className="h-3 w-3 text-[var(--hack-green)] shrink-0" /> : <XCircle className="h-3 w-3 text-[var(--hack-red)] shrink-0" />}
              <span className={h.present ? "text-[var(--hack-green)]" : "text-[var(--hack-red)]"}>{h.name}</span>
              {h.value && <span className="text-[var(--hack-gray)]/60 truncate">{h.value.slice(0, 60)}</span>}
            </div>
          ))}
        </div>
      </Section>

      {/* DNS History */}
      {report.dns.records.length > 0 && (
        <Section title="DNS History" icon={Globe} iconColor="text-[var(--hack-cyan)]" expanded={expandedSections.has("dns")} onToggle={() => toggleSection("dns")} summary={report.dns.summary}>
          <div className="space-y-1">
            {report.dns.records.slice(0, 20).map((r, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-[var(--hack-cyan)] font-bold shrink-0 w-12">{r.type}</span>
                <span className="text-[var(--hack-green)] truncate flex-1">{r.value}</span>
                {r.ttl && <span className="text-[var(--hack-gray)]/50 shrink-0">TTL:{r.ttl}s</span>}
                <span className="text-[var(--hack-gray)]/40 shrink-0">{r.sourceLabel.slice(0, 15)}</span>
              </div>
            ))}
            {report.dns.records.length > 20 && <p className="font-mono text-[9px] text-[var(--hack-gray)]/50">... and {report.dns.records.length - 20} more</p>}
          </div>
        </Section>
      )}

      {/* IP Migration */}
      {report.ipMigration.ips.length > 0 && (
        <Section title="IP Migration" icon={Server} iconColor="text-[var(--hack-red)]" expanded={expandedSections.has("ip")} onToggle={() => toggleSection("ip")} summary={report.ipMigration.summary}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {report.ipMigration.ips.slice(0, 20).map((ip, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-[10px] border border-[var(--hack-border)]/30 px-2 py-0.5">
                <span className={`shrink-0 ${ip.version === "IPv6" ? "text-[var(--hack-purple)]" : "text-[var(--hack-red)]"}`}>{ip.version}</span>
                <span className="text-[var(--hack-green)] truncate">{ip.ip}</span>
                <span className="text-[var(--hack-gray)]/40 shrink-0 ml-auto">{ip.sourceLabel.slice(0, 12)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ASN Evolution */}
      {report.asnEvolution.entries.length > 0 && (
        <Section title="ASN Evolution" icon={Cloud} iconColor="text-[var(--hack-cyan)]" expanded={expandedSections.has("asn")} onToggle={() => toggleSection("asn")} summary={report.asnEvolution.summary}>
          <div className="space-y-1">
            {report.asnEvolution.entries.map((a, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
                <span className="text-[var(--hack-cyan)] font-bold shrink-0">{a.asn}</span>
                <span className="text-[var(--hack-green)] truncate">{a.organization}</span>
              </div>
            ))}
            {report.asnEvolution.uniqueOrganizations.length > 0 && (
              <div className="mt-2 pt-1 border-t border-[var(--hack-border)]/30">
                <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/50">Organizations: </span>
                <span className="font-mono text-[9px] text-[var(--hack-gray)]">{report.asnEvolution.uniqueOrganizations.join(", ")}</span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* SSL/TLS Evolution */}
      {report.sslEvolution.certificates.length > 0 && (
        <Section title="SSL/TLS Evolution" icon={Lock} iconColor="text-teal-400" expanded={expandedSections.has("ssl")} onToggle={() => toggleSection("ssl")} summary={report.sslEvolution.summary}>
          <div className="space-y-2">
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/50">Issuers: </span>
              <span className="font-mono text-[9px] text-teal-400">{report.sslEvolution.uniqueIssuers.join(", ") || "none detected"}</span>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)]/50">SAN Domains ({report.sslEvolution.uniqueSANs.length}):</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {report.sslEvolution.uniqueSANs.slice(0, 15).map((san, i) => (
                  <span key={i} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1 py-0.5 text-teal-400">{san}</span>
                ))}
                {report.sslEvolution.uniqueSANs.length > 15 && <span className="font-mono text-[9px] text-[var(--hack-gray)]/50">+{report.sslEvolution.uniqueSANs.length - 15} more</span>}
              </div>
            </div>
          </div>
        </Section>
      )}

      {/* Hosting Evolution */}
      {report.hostingEvolution.entries.length > 0 && (
        <Section title="CDN/Hosting Evolution" icon={Cloud} iconColor="text-[var(--hack-purple)]" expanded={expandedSections.has("hosting")} onToggle={() => toggleSection("hosting")} summary={report.hostingEvolution.summary}>
          <div className="flex flex-wrap gap-1.5">
            {report.hostingEvolution.entries.map((h, i) => (
              <span key={i} className="font-mono text-[9px] border border-[var(--hack-purple)]/30 bg-[var(--hack-purple)]/5 px-1.5 py-0.5 text-[var(--hack-purple)]">
                {h.provider} <span className="text-[var(--hack-gray)]/40">({h.type})</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Technology Evolution */}
      {report.techEvolution.entries.length > 0 && (
        <Section title="Technology Evolution" icon={Cpu} iconColor="text-[var(--hack-amber)]" expanded={expandedSections.has("tech")} onToggle={() => toggleSection("tech")} summary={report.techEvolution.summary}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {report.techEvolution.entries.map((t, i) => (
                <span key={i} className="font-mono text-[9px] border border-[var(--hack-amber)]/30 bg-[var(--hack-amber)]/5 px-1.5 py-0.5 text-[var(--hack-amber)]">
                  {t.technology} <span className="text-[var(--hack-gray)]/40">({t.category})</span>
                </span>
              ))}
            </div>
            {Object.keys(report.techEvolution.byCategory).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--hack-border)]/30">
                {Object.entries(report.techEvolution.byCategory).map(([cat, count]) => (
                  <span key={cat} className="font-mono text-[9px] text-[var(--hack-gray)]/60">{cat}: {count}</span>
                ))}
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

// =====================
// Sub-components
// =====================

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorClass = color === "green" ? "text-[var(--hack-green)]" : color === "cyan" ? "text-[var(--hack-cyan)]" : color === "amber" ? "text-[var(--hack-amber)]" : "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${colorClass}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function Section({ title, icon: Icon, iconColor, expanded, onToggle, summary, children }: {
  title: string; icon: React.ElementType; iconColor: string; expanded: boolean; onToggle: () => void; summary: string; children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/20">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-cyan)]/5 transition-colors text-left">
        <Icon className={`h-4 w-4 ${iconColor} shrink-0`} />
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
