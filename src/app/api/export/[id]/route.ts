// GET /api/export/[id]?format=csv|json|txt|md — export investigation findings + report.

import { NextResponse } from "next/server";
import { getRecord } from "@/lib/osint/store";
import type { SourceResult, InvestigationRecord } from "@/lib/osint/types";
import { getSessionUser } from "@/lib/auth";
import {
  resolveEntitlement,
  checkExportEntitlement,
} from "@/lib/saas/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(v: string | number | undefined | null): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function safeName(target: string): string {
  return target.replace(/[^a-z0-9]+/gi, "-").slice(0, 30);
}

// Build a plain-text intelligence report (also used for TXT + MD exports).
function buildTextReport(rec: InvestigationRecord): string {
  if (!rec) return "Investigation not found.";
  const r = rec.report;
  const lines: string[] = [];
  lines.push("=".repeat(72));
  lines.push("OSINTiger // Intelligence Report");
  lines.push("=".repeat(72));
  lines.push(`Target: ${rec.target}`);
  lines.push(`Type: ${rec.input_type} · Language: ${rec.language} (${rec.script})`);
  lines.push(`Investigation ID: ${rec.id}`);
  lines.push(`Created: ${rec.created_at}`);
  if (rec.completed_at) lines.push(`Completed: ${rec.completed_at}`);
  if (r) {
    lines.push(`Overall Confidence: ${(r.confidence_score * 100).toFixed(0)}%`);
    lines.push(`Attribution Valid: ${r.attribution_valid ? "YES" : "NO (needs review)"}`);
  }
  lines.push("");

  if (r) {
    if (r.bluf) {
      lines.push("-".repeat(72));
      lines.push("BLUF — Bottom Line Up Front");
      lines.push("-".repeat(72));
      lines.push(r.bluf.text);
      lines.push(`Key Judgment: ${r.bluf.key_judgment}`);
      lines.push(`Confidence Level: ${r.bluf.confidence_level.toUpperCase()}`);
      lines.push("");
    }

    lines.push("-".repeat(72));
    lines.push("EXECUTIVE SUMMARY");
    lines.push("-".repeat(72));
    lines.push(r.executive_summary);
    lines.push("");

    if (r.five_w1h) {
      lines.push("-".repeat(72));
      lines.push("5W1H ANALYSIS");
      lines.push("-".repeat(72));
      lines.push(`WHO:   ${r.five_w1h.who}`);
      lines.push(`WHAT:  ${r.five_w1h.what}`);
      lines.push(`WHEN:  ${r.five_w1h.when}`);
      lines.push(`WHERE: ${r.five_w1h.where}`);
      lines.push(`WHY:   ${r.five_w1h.why}`);
      lines.push(`HOW:   ${r.five_w1h.how}`);
      lines.push("");
    }

    if (r.timeline && r.timeline.length) {
      lines.push("-".repeat(72));
      lines.push("TIMELINE");
      lines.push("-".repeat(72));
      r.timeline.forEach((t, i) => {
        lines.push(`${i + 1}. [${t.date}] ${t.event}`);
        lines.push(`   Source: ${t.source} — ${t.source_url}`);
      });
      lines.push("");
    }

    lines.push("-".repeat(72));
    lines.push("KEY FINDINGS");
    lines.push("-".repeat(72));
    r.key_findings.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.claim}`);
      lines.push(`   Source: ${f.source} — ${f.source_url}`);
      lines.push(`   Confidence: ${(f.confidence * 100).toFixed(0)}%`);
    });
    lines.push("");

    lines.push("-".repeat(72));
    lines.push("DETAILED ANALYSIS");
    lines.push("-".repeat(72));
    lines.push(r.detailed_analysis);
    lines.push("");

    if (r.contradictions && r.contradictions.length) {
      lines.push("-".repeat(72));
      lines.push("CONTRADICTIONS DETECTED");
      lines.push("-".repeat(72));
      r.contradictions.forEach((c, i) => {
        lines.push(`${i + 1}. ${c.topic}`);
        lines.push(`   Claim A (${c.source_a}): ${c.claim_a}`);
        lines.push(`   Claim B (${c.source_b}): ${c.claim_b}`);
        lines.push(`   Resolution: ${c.resolution}`);
      });
      lines.push("");
    }

    if (r.risk_matrix && r.risk_matrix.length) {
      lines.push("-".repeat(72));
      lines.push("RISK MATRIX");
      lines.push("-".repeat(72));
      r.risk_matrix.forEach((rm, i) => {
        lines.push(`${i + 1}. ${rm.risk} [${rm.category}]`);
        lines.push(`   Likelihood: ${rm.likelihood.toUpperCase()} · Impact: ${rm.impact.toUpperCase()} · Score: ${rm.score}/9`);
        lines.push(`   Rationale: ${rm.rationale}`);
      });
      lines.push("");
    }

    if (r.ach_analysis.hypotheses.length) {
      lines.push("-".repeat(72));
      lines.push("ACH — COMPETING HYPOTHESES");
      lines.push("-".repeat(72));
      r.ach_analysis.hypotheses.forEach((h, i) => {
        lines.push(`H${i + 1}: ${h.statement}`);
        lines.push(`    Confidence: ${(h.confidence * 100).toFixed(0)}%`);
        lines.push(`    Rationale: ${h.rationale}`);
      });
      lines.push("");
    }

    if (r.link_graph && r.link_graph.nodes.length) {
      lines.push("-".repeat(72));
      lines.push("LINK ANALYSIS — ENTITY RELATIONSHIPS");
      lines.push("-".repeat(72));
      lines.push("Nodes:");
      r.link_graph.nodes.forEach((n) => {
        lines.push(`  - [${n.type}] ${n.label} (weight: ${n.weight}, source: ${n.source})`);
      });
      if (r.link_graph.edges.length) {
        lines.push("Edges:");
        r.link_graph.edges.forEach((e) => {
          lines.push(`  - ${e.from} --[${e.label}]--> ${e.to} (confidence: ${(e.confidence * 100).toFixed(0)}%)`);
        });
      }
      lines.push("");
    }

    if (r.collection_gaps && r.collection_gaps.length) {
      lines.push("-".repeat(72));
      lines.push("COLLECTION GAPS");
      lines.push("-".repeat(72));
      r.collection_gaps.forEach((g, i) => {
        lines.push(`${i + 1}. [${g.priority.toUpperCase()}] ${g.area}`);
        lines.push(`   ${g.description}`);
        lines.push(`   Recommended sources: ${g.recommended_sources.join(", ")}`);
      });
      lines.push("");
    }

    if (r.monitoring_recommendations && r.monitoring_recommendations.length) {
      lines.push("-".repeat(72));
      lines.push("MONITORING RECOMMENDATIONS");
      lines.push("-".repeat(72));
      r.monitoring_recommendations.forEach((m, i) => {
        lines.push(`${i + 1}. [${m.frequency}] ${m.action}`);
        lines.push(`   Rationale: ${m.rationale}`);
      });
      lines.push("");
    }

    if (r.geopoints.length) {
      lines.push("-".repeat(72));
      lines.push("GEOGRAPHIC INTELLIGENCE");
      lines.push("-".repeat(72));
      r.geopoints.forEach((g, i) => {
        lines.push(`${i + 1}. ${g.label}${g.country ? ` (${g.country})` : ""} — ${g.lat ?? "?"},${g.lon ?? "?"} [src: ${g.source}]`);
        if (g.note) lines.push(`   Note: ${g.note}`);
      });
      lines.push("");
    }

    lines.push("-".repeat(72));
    lines.push("SOURCES CONSULTED");
    lines.push("-".repeat(72));
    r.sources_consulted.forEach((s) => {
      lines.push(`- ${s.source_label}: ${s.url || "n/a"}`);
      lines.push(`  Status: ${s.status} · Findings: ${s.finding_count}${s.error ? ` · Error: ${s.error}` : ""}`);
    });
    lines.push("");
  }

  lines.push("=".repeat(72));
  lines.push("RAW SOURCE FINDINGS");
  lines.push("=".repeat(72));
  for (const sr of rec.source_results as SourceResult[]) {
    lines.push(`\n[${sr.source_label}] target=${sr.target} status=${sr.status}`);
    if (sr.error) lines.push(`  ERROR: ${sr.error}`);
    for (const f of sr.findings) {
      lines.push(`  • ${f.data}`);
      lines.push(`    URL: ${f.source_url} · Confidence: ${(f.confidence * 100).toFixed(0)}% · ${f.timestamp}`);
    }
  }

  lines.push("");
  lines.push("=".repeat(72));
  lines.push("// OSINTiger — Evidence-first intelligence. Every claim carries [SOURCE] attribution.");
  lines.push("=".repeat(72));
  return lines.join("\n");
}

// Build a Markdown report (richer formatting).
function buildMarkdownReport(rec: InvestigationRecord): string {
  const txt = buildTextReport(rec);
  // Convert simple text separators to Markdown headers
  return txt
    .replace(/^={72}$/gm, "")
    .replace(/^-{72}$/gm, "")
    .replace(/^OSINTiger \/\/ Intelligence Report$/gm, "# OSINTiger // Intelligence Report")
    .replace(/^BLUF — Bottom Line Up Front$/gm, "## BLUF — Bottom Line Up Front")
    .replace(/^EXECUTIVE SUMMARY$/gm, "## Executive Summary")
    .replace(/^5W1H ANALYSIS$/gm, "## 5W1H Analysis")
    .replace(/^TIMELINE$/gm, "## Timeline")
    .replace(/^KEY FINDINGS$/gm, "## Key Findings")
    .replace(/^DETAILED ANALYSIS$/gm, "## Detailed Analysis")
    .replace(/^CONTRADICTIONS DETECTED$/gm, "## Contradictions Detected")
    .replace(/^RISK MATRIX$/gm, "## Risk Matrix")
    .replace(/^ACH — COMPETING HYPOTHESES$/gm, "## ACH — Competing Hypotheses")
    .replace(/^LINK ANALYSIS — ENTITY RELATIONSHIPS$/gm, "## Link Analysis — Entity Relationships")
    .replace(/^COLLECTION GAPS$/gm, "## Collection Gaps")
    .replace(/^MONITORING RECOMMENDATIONS$/gm, "## Monitoring Recommendations")
    .replace(/^GEOGRAPHIC INTELLIGENCE$/gm, "## Geographic Intelligence")
    .replace(/^SOURCES CONSULTED$/gm, "## Sources Consulted")
    .replace(/^RAW SOURCE FINDINGS$/gm, "## Raw Source Findings")
    .replace(/^(OSINTiger — .*)$/gm, "_$1_");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rec = await getRecord(id);
  if (!rec) {
    return NextResponse.json({ error: "investigation not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "json";

  // ─── Entitlement gate ────────────────────────────────────────────────────
  // Export formats are tier-gated: markdown/json on Investigator+; PDF/CSV/STIX
  // on Professional+. Anonymous users may still export JSON for the in-product
  // report viewer, but the dedicated download formats require a paid plan.
  // Map legacy aliases (`md`→`markdown`, `txt`→`markdown`) to the canonical
  // plan-export identifier so the check reflects what the user actually gets.
  const canonicalFormat =
    format === "md" ? "markdown" :
    format === "txt" ? "markdown" :
    format === "markdown" ? "markdown" :
    format.toLowerCase();

  try {
    const user = await getSessionUser();
    const ent = await resolveEntitlement(user?.id || null);
    const exportCheck = checkExportEntitlement(ent, canonicalFormat);
    if (!exportCheck.allowed) {
      return NextResponse.json(
        {
          error: exportCheck.reason || `${format.toUpperCase()} export is not available on your plan`,
          code: "plan_required",
          upgradeTier: exportCheck.upgradeTier,
        },
        { status: 402 }
      );
    }
  } catch (entErr) {
    // Never block exports on entitlement resolution failures — log and continue.
    console.error("[export] entitlement check failed", entErr);
  }

  // Flatten all source findings into rows
  const rows: {
    source: string;
    source_label: string;
    target: string;
    data: string;
    source_url: string;
    confidence: number;
    timestamp: string;
    status: string;
  }[] = [];

  for (const sr of rec.source_results as SourceResult[]) {
    if (sr.findings.length === 0 && sr.status !== "success") {
      rows.push({
        source: sr.source,
        source_label: sr.source_label,
        target: sr.target,
        data: `[${sr.status}] ${sr.error || "no findings"}`,
        source_url: "",
        confidence: 0,
        timestamp: rec.created_at,
        status: sr.status,
      });
    }
    for (const f of sr.findings) {
      rows.push({
        source: sr.source,
        source_label: sr.source_label,
        target: sr.target,
        data: f.data,
        source_url: f.source_url,
        confidence: f.confidence,
        timestamp: f.timestamp,
        status: sr.status,
      });
    }
  }

  if (format === "csv") {
    const header = [
      "source",
      "source_label",
      "target",
      "data",
      "source_url",
      "confidence",
      "timestamp",
      "status",
    ].join(",");
    const lines = rows.map((r) =>
      [
        csvEscape(r.source),
        csvEscape(r.source_label),
        csvEscape(r.target),
        csvEscape(r.data),
        csvEscape(r.source_url),
        csvEscape(r.confidence),
        csvEscape(r.timestamp),
        csvEscape(r.status),
      ].join(",")
    );
    const csv = [header, ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="osintiger-${safeName(rec.target)}.csv"`,
      },
    });
  }

  if (format === "txt") {
    const txt = buildTextReport(rec);
    return new NextResponse(txt, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="osintiger-${safeName(rec.target)}.txt"`,
      },
    });
  }

  if (format === "md") {
    const md = buildMarkdownReport(rec);
    return new NextResponse(md, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="osintiger-${safeName(rec.target)}.md"`,
      },
    });
  }

  // JSON format — full report + raw findings
  return new NextResponse(
    JSON.stringify(
      {
        investigation: {
          id: rec.id,
          target: rec.target,
          input_type: rec.input_type,
          language: rec.language,
          script: rec.script,
          status: rec.status,
          created_at: rec.created_at,
          completed_at: rec.completed_at,
          confidence_score: rec.report?.confidence_score ?? null,
          attribution_valid: rec.report?.attribution_valid ?? null,
          starred: rec.starred ?? false,
          tags: rec.tags ?? [],
          notes: rec.notes ?? "",
          bookmarked_findings: rec.bookmarked_findings ?? [],
          finding_annotations: rec.finding_annotations ?? {},
        },
        report: rec.report,
        source_results: rec.source_results,
        flattened_findings: rows,
      },
      null,
      2
    ),
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="osintiger-${safeName(rec.target)}.json"`,
      },
    }
  );
}
