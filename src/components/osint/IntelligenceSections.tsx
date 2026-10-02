"use client";

import type { ReportData } from "@/lib/osint/types";
import { ClaimText } from "./AttributionTag";
import {
  Target,
  Clock,
  HelpCircle,
  AlertTriangle,
  ShieldAlert,
  Eye,
  Activity,
  FileSearch,
} from "lucide-react";

interface Props {
  report: ReportData;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  low: "text-[var(--hack-red)]",
  moderate: "text-[var(--hack-amber)]",
  high: "text-[var(--hack-green)]",
  very_high: "text-[var(--hack-cyan)]",
};

const RISK_SCORE_COLORS: Record<number, string> = {
  1: "text-[var(--hack-green)]",
  2: "text-[var(--hack-green)]",
  3: "text-[var(--hack-amber)]",
  4: "text-[var(--hack-amber)]",
  5: "text-[var(--hack-orange)]",
  6: "text-[var(--hack-orange)]",
  7: "text-[var(--hack-red)]",
  8: "text-[var(--hack-red)]",
  9: "text-[var(--hack-red)]",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-[var(--hack-gray)]",
  medium: "text-[var(--hack-amber)]",
  high: "text-[var(--hack-red)]",
};

export function IntelligenceSections({ report }: Props) {
  const hasBluf = !!report.bluf;
  const hasTimeline = report.timeline && report.timeline.length > 0;
  const has5w1h = !!report.five_w1h;
  const hasContradictions = report.contradictions && report.contradictions.length > 0;
  const hasRiskMatrix = report.risk_matrix && report.risk_matrix.length > 0;
  const hasGaps = report.collection_gaps && report.collection_gaps.length > 0;
  const hasMonitoring = report.monitoring_recommendations && report.monitoring_recommendations.length > 0;

  if (!hasBluf && !hasTimeline && !has5w1h && !hasContradictions && !hasRiskMatrix && !hasGaps && !hasMonitoring) {
    return (
      <div className="border border-[var(--hack-border)] bg-black/20 p-6 text-center">
        <p className="font-mono text-xs text-[var(--hack-gray)]">
          {"» Enhanced intelligence sections (BLUF, Timeline, 5W1H, Risk Matrix) not generated for this report."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* BLUF */}
      {hasBluf && (
        <section className="border border-[var(--hack-cyan)]/30 bg-[var(--hack-cyan)]/5 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-[var(--hack-cyan)]/20 px-3 py-2">
            <Target className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--hack-cyan)]">
              BLUF — Bottom Line Up Front
            </h3>
            <span className={`font-mono text-[9px] uppercase ml-auto ${CONFIDENCE_COLORS[report.bluf!.confidence_level] || "text-[var(--hack-gray)]"}`}>
              {report.bluf!.confidence_level.replace("_", " ")} confidence
            </span>
          </div>
          <div className="px-3 py-3 space-y-2">
            <ClaimText text={report.bluf!.text} />
            <div className="border-t border-[var(--hack-cyan)]/10 pt-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]">
                Key Judgment:
              </span>
              <p className="text-sm mt-0.5">
                <ClaimText text={report.bluf!.key_judgment} />
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 5W1H */}
      {has5w1h && (
        <section className="border border-[var(--hack-border)] bg-black/30 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-[var(--hack-border)] px-3 py-2">
            <HelpCircle className="h-3.5 w-3.5 text-[var(--hack-green)]" />
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--hack-green)]">
              5W1H Analysis
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--hack-border)]">
            {([
              ["WHO", report.five_w1h!.who],
              ["WHAT", report.five_w1h!.what],
              ["WHEN", report.five_w1h!.when],
              ["WHERE", report.five_w1h!.where],
              ["WHY", report.five_w1h!.why],
              ["HOW", report.five_w1h!.how],
            ] as const).map(([label, value]) => (
              <div key={label} className="bg-black/40 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)] mb-0.5">
                  {label}
                </div>
                <div className="text-xs leading-relaxed">
                  {value === "Insufficient data." || value === "No verified evidence found." ? (
                    <span className="text-[var(--hack-gray)] italic">{value}</span>
                  ) : (
                    <ClaimText text={value} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      {hasTimeline && (
        <section className="border border-[var(--hack-border)] bg-black/30 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-[var(--hack-border)] px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-[var(--hack-green)]" />
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--hack-green)]">
              Timeline
            </h3>
            <span className="font-mono text-[9px] text-[var(--hack-gray)] ml-auto">
              {report.timeline!.length} events
            </span>
          </div>
          <div className="px-3 py-3">
            <ol className="relative border-l border-[var(--hack-green)]/30 ml-2 space-y-3">
              {report.timeline!.map((t, i) => (
                <li key={i} className="ml-4">
                  <div className="absolute -left-1.5 mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--hack-green)] border border-[var(--hack-green)]/40" />
                  <time className="font-mono text-[10px] text-[var(--hack-cyan)]">
                    {t.date}
                  </time>
                  <div className="text-xs mt-0.5">
                    <ClaimText text={t.event} />
                  </div>
                  <div className="font-mono text-[9px] text-[var(--hack-gray)] mt-0.5">
                    src: {t.source} · {(t.confidence * 100).toFixed(0)}%
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Contradictions */}
      {hasContradictions && (
        <section className="border border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-[var(--hack-red)]/20 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--hack-red)]" />
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--hack-red)]">
              Contradictions Detected
            </h3>
            <span className="font-mono text-[9px] text-[var(--hack-gray)] ml-auto">
              {report.contradictions!.length} conflicts
            </span>
          </div>
          <div className="px-3 py-3 space-y-3">
            {report.contradictions!.map((c, i) => (
              <div key={i} className="border border-[var(--hack-border)] bg-black/40 p-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-red)] mb-1.5">
                  #{i + 1} · {c.topic}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  <div className="border-l-2 border-[var(--hack-green)] pl-2">
                    <div className="font-mono text-[9px] text-[var(--hack-gray)]">
                      Claim A — {c.source_a}
                    </div>
                    <div className="text-xs">
                      <ClaimText text={c.claim_a} />
                    </div>
                  </div>
                  <div className="border-l-2 border-[var(--hack-red)] pl-2">
                    <div className="font-mono text-[9px] text-[var(--hack-gray)]">
                      Claim B — {c.source_b}
                    </div>
                    <div className="text-xs">
                      <ClaimText text={c.claim_b} />
                    </div>
                  </div>
                </div>
                <div className="font-mono text-[10px] text-[var(--hack-gray)]">
                  <span className="uppercase">Resolution:</span> {c.resolution}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Risk Matrix */}
      {hasRiskMatrix && (
        <section className="border border-[var(--hack-border)] bg-black/30 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-[var(--hack-border)] px-3 py-2">
            <ShieldAlert className="h-3.5 w-3.5 text-[var(--hack-orange)]" />
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--hack-orange)]">
              Risk Matrix
            </h3>
            <span className="font-mono text-[9px] text-[var(--hack-gray)] ml-auto">
              {report.risk_matrix!.length} risks identified
            </span>
          </div>
          <div className="px-3 py-3 space-y-2">
            {report.risk_matrix!.map((r, i) => (
              <div key={i} className="border border-[var(--hack-border)] bg-black/40 p-2">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">
                      [{r.category}]
                    </span>
                    <span className="text-sm ml-1.5">{r.risk}</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-lg font-bold ${RISK_SCORE_COLORS[r.score] || "text-[var(--hack-gray)]"}`}>
                      {r.score}
                    </span>
                    <span className="font-mono text-[9px] text-[var(--hack-gray)]">/9</span>
                  </div>
                </div>
                <div className="flex gap-3 font-mono text-[9px] mb-1">
                  <span>
                    Likelihood:{" "}
                    <span className={r.likelihood === "high" ? "text-[var(--hack-red)]" : r.likelihood === "medium" ? "text-[var(--hack-amber)]" : "text-[var(--hack-green)]"}>
                      {r.likelihood.toUpperCase()}
                    </span>
                  </span>
                  <span>
                    Impact:{" "}
                    <span className={r.impact === "high" ? "text-[var(--hack-red)]" : r.impact === "medium" ? "text-[var(--hack-amber)]" : "text-[var(--hack-green)]"}>
                      {r.impact.toUpperCase()}
                    </span>
                  </span>
                </div>
                <div className="text-xs">
                  <ClaimText text={r.rationale} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Collection Gaps */}
      {hasGaps && (
        <section className="border border-[var(--hack-border)] bg-black/30 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-[var(--hack-border)] px-3 py-2">
            <FileSearch className="h-3.5 w-3.5 text-[var(--hack-amber)]" />
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--hack-amber)]">
              Collection Gaps
            </h3>
            <span className="font-mono text-[9px] text-[var(--hack-gray)] ml-auto">
              {report.collection_gaps!.length} gaps
            </span>
          </div>
          <div className="px-3 py-3 space-y-2">
            {report.collection_gaps!.map((g, i) => (
              <div key={i} className="border border-[var(--hack-border)] bg-black/40 p-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium">{g.area}</span>
                  <span className={`font-mono text-[9px] uppercase ${PRIORITY_COLORS[g.priority] || "text-[var(--hack-gray)]"}`}>
                    {g.priority} priority
                  </span>
                </div>
                <p className="text-xs text-[var(--hack-gray)] mb-1.5">{g.description}</p>
                {g.recommended_sources.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {g.recommended_sources.map((s, j) => (
                      <span
                        key={j}
                        className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1.5 py-0.5 text-[var(--hack-gray)]"
                      >
                        + {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Monitoring Recommendations */}
      {hasMonitoring && (
        <section className="border border-[var(--hack-border)] bg-black/30 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-[var(--hack-border)] px-3 py-2">
            <Eye className="h-3.5 w-3.5 text-[var(--hack-cyan)]" />
            <h3 className="font-mono text-[11px] uppercase tracking-wider text-[var(--hack-cyan)]">
              Monitoring Recommendations
            </h3>
            <span className="font-mono text-[9px] text-[var(--hack-gray)] ml-auto">
              {report.monitoring_recommendations!.length} actions
            </span>
          </div>
          <div className="px-3 py-3 space-y-2">
            {report.monitoring_recommendations!.map((m, i) => (
              <div key={i} className="border border-[var(--hack-border)] bg-black/40 p-2 flex items-start gap-2">
                <Activity className="h-3 w-3 text-[var(--hack-cyan)] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm">{m.action}</span>
                    <span className="font-mono text-[9px] uppercase text-[var(--hack-gray)] border border-[var(--hack-border)] px-1 py-0.5">
                      {m.frequency}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--hack-gray)]">
                    <ClaimText text={m.rationale} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
