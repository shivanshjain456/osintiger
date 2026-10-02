"use client";

import { useState, useEffect } from "react";
import { Loader2, Cpu, ChevronDown, ChevronRight, Layers, Code2, Server, Cloud, CreditCard, BarChart3, Globe, Box, Database } from "lucide-react";

// =====================
// Types
// =====================

interface TechnologyDetection {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  version?: string;
  confidence: number;
  source: string;
  sourceLabel: string;
  tier: number;
  evidence: string;
  role: string;
  method: string;
}

interface StackProfile {
  primary: TechnologyDetection[];
  secondary: TechnologyDetection[];
  summary: string;
  complexity: string;
  byCategory: Record<string, number>;
}

interface TechFingerprintReport {
  detections: TechnologyDetection[];
  stack: StackProfile;
  categories: { category: string; label: string; count: number; technologies: string[] }[];
  assessment: {
    totalTechnologies: number;
    primaryCount: number;
    secondaryCount: number;
    categoriesDetected: number;
    fingerprintConfidence: number;
    explanation: string;
  };
  meta: { sourcesAnalyzed: number; findingsAnalyzed: number; generatedAt: string };
}

interface Props {
  investigationId: string;
  apiPath: "standard" | "agent";
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  framework: Layers, cms: Globe, backend: Server, frontend: Code2,
  library: Code2, analytics: BarChart3, payment: CreditCard,
  cdn: Cloud, hosting: Server, proxy: Server, cache: Database,
  container: Box, language: Code2,
};

const ROLE_COLORS: Record<string, string> = {
  primary: "text-[var(--hack-green)] border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10",
  secondary: "text-[var(--hack-cyan)] border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10",
};

const COMPLEXITY_COLORS: Record<string, string> = {
  high: "text-[var(--hack-red)]",
  medium: "text-[var(--hack-amber)]",
  low: "text-[var(--hack-green)]",
};

export function TechFingerprintPanel({ investigationId, apiPath }: Props) {
  const [report, setReport] = useState<TechFingerprintReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/tech-fingerprint`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled && data.report) { setReport(data.report); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» fingerprinting technologies..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!report) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { assessment, stack, categories, detections } = report;

  const toggleCat = (cat: string) => setExpandedCats((prev) => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Assessment */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Technology Fingerprint</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Confidence</div>
              <div className="font-mono text-lg font-bold text-[var(--hack-green)]">{assessment.fingerprintConfidence}%</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Complexity</div>
              <div className={`font-mono text-lg font-bold ${COMPLEXITY_COLORS[stack.complexity] || "text-[var(--hack-gray)]"}`}>
                {stack.complexity.toUpperCase()}
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
      </div>

      {/* Stack Summary */}
      <div className="border border-[var(--hack-green)]/20 bg-[var(--hack-green)]/5 p-3">
        <div className="flex items-center gap-2 mb-1">
          <Layers className="h-3.5 w-3.5 text-[var(--hack-green)]" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">Stack Profile</span>
        </div>
        <p className="text-xs text-[var(--hack-gray)]">{stack.summary}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Technologies" value={assessment.totalTechnologies} />
        <Stat label="Primary" value={assessment.primaryCount} color="green" />
        <Stat label="Secondary" value={assessment.secondaryCount} color="cyan" />
        <Stat label="Categories" value={assessment.categoriesDetected} />
        <Stat label="Confidence" value={`${assessment.fingerprintConfidence}%`} color="green" />
      </div>

      {/* Primary Technologies */}
      {stack.primary.length > 0 && (
        <div className="border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-green)]">Primary Stack</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stack.primary.map((t) => (
              <span key={t.id} className="font-mono text-[10px] border border-[var(--hack-green)]/30 bg-black/40 px-2 py-0.5 text-[var(--hack-green)]" title={t.evidence}>
                {t.name}{t.version ? ` ${t.version}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)] section-header">
            Technology Categories ({categories.length})
          </h3>
          {categories.map((cat) => {
            const isExpanded = expandedCats.has(cat.category);
            const Icon = CATEGORY_ICONS[cat.category] || Cpu;
            const catDetections = detections.filter((d) => d.category === cat.category);
            return (
              <div key={cat.category} className="border border-[var(--hack-border)] bg-black/20">
                <button
                  onClick={() => toggleCat(cat.category)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--hack-cyan)]/5 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)] shrink-0" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)] shrink-0" />}
                  <Icon className="h-4 w-4 text-[var(--hack-cyan)] shrink-0" />
                  <span className="font-mono text-xs text-[var(--hack-green)] flex-1 text-left">{cat.label}</span>
                  <div className="w-24 h-3 bg-black/40 border border-[var(--hack-border)] shrink-0 relative">
                    <div className="h-full bg-[var(--hack-cyan)]/40" style={{ width: `${Math.min(cat.count * 10, 100)}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-white">{cat.count}</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1">
                    {catDetections.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 border-b border-[var(--hack-border)]/20 pb-1">
                        <span className={`font-mono text-[8px] px-1 py-0.5 border shrink-0 ${ROLE_COLORS[d.role] || ""}`}>
                          {d.role.toUpperCase()}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">
                          {d.name}{d.version ? ` ${d.version}` : ""}
                        </span>
                        <span className="font-mono text-[8px] text-[var(--hack-gray)]/50 shrink-0">{d.subcategory}</span>
                        <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 shrink-0">{d.method}</span>
                        <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 shrink-0">{(d.confidence * 100).toFixed(0)}%</span>
                        <span className="font-mono text-[8px] text-[var(--hack-gray)]/30 shrink-0">T{d.tier}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Secondary Technologies */}
      {stack.secondary.length > 0 && (
        <div className="border border-[var(--hack-cyan)]/20 bg-[var(--hack-cyan)]/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-cyan)]">Secondary Technologies</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stack.secondary.map((t) => (
              <span key={t.id} className="font-mono text-[10px] border border-[var(--hack-cyan)]/30 bg-black/40 px-2 py-0.5 text-[var(--hack-cyan)]" title={t.evidence}>
                {t.name}{t.version ? ` ${t.version}` : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const c = color === "green" ? "text-[var(--hack-green)]" : color === "cyan" ? "text-[var(--hack-cyan)]" : "text-[var(--hack-gray)]";
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${c}`}>{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}
