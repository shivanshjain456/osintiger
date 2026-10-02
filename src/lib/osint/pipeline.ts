// OSINTiger 8-step investigation pipeline orchestrator.
// Steps: parse → route → query (parallel) → normalize → synthesize → ach → attribute → format
// Runs asynchronously, updating the in-memory store record at each step so the
// frontend can poll progress.
//
// Note: runSource() has been extracted to source-runner.ts to avoid circular dependencies
// with the autonomous agent module. It is re-exported here for backward compatibility.

import { randomUUID } from "crypto";
import type {
  DetectionResult,
  InvestigationRecord,
  PipelineStep,
  PipelineStepId,
  ReportData,
  SourceResult,
  SourceStatus,
} from "./types";
import { detectInput } from "./detector";
import { routeSources, type SourceKey, SOURCE_LABELS } from "./router";
import { normalizeSourceResults } from "./normalizer";
import { synthesizeReport, synthesizeACH, type AISynthesisRaw } from "./ai-client";
import { markAttribution } from "./attribution";
import { buildAch } from "./ach";
import { createRecord, updateRecord } from "./store";

// Feature 19 — auto-ingest completed investigations into the Knowledge Base.
// Loaded lazily to avoid a circular import (knowledge-base imports store).
async function ingestIntoKnowledgeBase(
  investigationId: string,
  kind: "standard" | "agent" | "discovery" | "plan" | "monitor"
) {
  try {
    const { ingestInvestigation } = await import("./knowledge-base");
    await ingestInvestigation(investigationId, kind);
  } catch (e) {
    // Don't fail the pipeline if KB ingest fails
    console.error("[pipeline] KB ingest error", investigationId, e instanceof Error ? e.message : String(e));
  }
}

// Re-export runSource for backward compatibility (now lives in source-runner.ts)
export { runSource } from "./source-runner";
// Import runSource for internal use in this module
import { runSource } from "./source-runner";
import { createNotification } from "@/lib/saas/notifications";

const STEP_DEFS: { id: PipelineStepId; label: string }[] = [
  { id: "parse", label: "Target Parsing" },
  { id: "route", label: "Source Selection" },
  { id: "query", label: "Parallel Source Query" },
  { id: "normalize", label: "Data Normalization" },
  { id: "synthesize", label: "AI Synthesis" },
  { id: "ach", label: "ACH Analysis" },
  { id: "attribute", label: "Attribution Check" },
  { id: "format", label: "Report Formatting" },
];

function freshSteps(): PipelineStep[] {
  return STEP_DEFS.map((s) => ({ ...s, status: "skipped" as SourceStatus }));
}

function setStep(
  rec: InvestigationRecord,
  index: number,
  status: SourceStatus,
  detail?: string
) {
  // Create new arrays to avoid mutating the cached record's arrays
  const newSteps = [...rec.steps];
  newSteps[index] = { ...newSteps[index], status, detail };
  rec.steps = newSteps;
  rec.current_step = index + 1;
  updateRecord(rec.id, { steps: newSteps, current_step: index + 1 });
}


export interface InitOptions {
  target: string;
  input_type?: string;
  language?: string;
  modules?: string[];
  playbook?: string; // Feature 24 — playbook type
  userId?: string | null; // for notification routing
}

export function initInvestigation(opts: InitOptions): {
  id: string;
  record: InvestigationRecord;
  detection: DetectionResult;
} {
  const id = randomUUID();
  const detection = detectInput(opts.target, (opts.input_type as never) || "auto");
  const now = new Date().toISOString();
  const record: InvestigationRecord = {
    id,
    target: detection.sanitized || opts.target,
    input_type: detection.inputType,
    language: opts.language || detection.languageGuess,
    script: detection.script,
    modules: opts.modules || ["visual", "crypto", "sanctions"],
    status: "queued",
    created_at: now,
    current_step: 0,
    total_steps: STEP_DEFS.length,
    steps: freshSteps(),
    playbook: opts.playbook, // Feature 24
    source_results: [],
    report: null,
    cache_expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    userId: opts.userId || null,
  };
  createRecord(record);
  return { id, record, detection };
}

export async function runPipeline(
  id: string,
  detection: DetectionResult
): Promise<void> {
  const rec = updateRecord(id, { status: "in_progress" })!;
  // Feature 24 — load playbook if specified
  let playbook: import("./playbooks").PlaybookDefinition | null = null;
  if (rec.playbook) {
    try {
      const { getPlaybook } = await import("./playbooks");
      playbook = getPlaybook(rec.playbook as import("./playbooks").PlaybookType);
    } catch (e) {
      console.error("[pipeline] playbook load failed", e);
    }
  }
  try {
    // STEP 1 — parse
    setStep(rec, 0, "loading");
    if (!detection.valid) {
      throw new Error(detection.reason || "Invalid input");
    }
    setStep(
      rec,
      0,
      "success",
      `${detection.inputType} · ${detection.script} · ${detection.languageGuess}${
        detection.regionHints.length ? " · regions: " + detection.regionHints.join(",") : ""
      }${playbook ? ` · playbook: ${playbook.shortName}` : ""}`
    );

    // STEP 2 — route
    setStep(rec, 1, "loading");
    let sources = routeSources(detection);
    // Feature 24 — apply playbook collection strategy
    if (playbook) {
      const { applyPlaybookToSources } = await import("./playbooks");
      sources = applyPlaybookToSources(sources, playbook);
    }
    setStep(rec, 1, "success", `${sources.length} sources: ${sources.join(", ")}${playbook ? ` (ordered by ${playbook.shortName} playbook)` : ""}`);

    // STEP 3 — parallel query
    setStep(rec, 2, "loading", `Querying ${sources.length} sources…`);

    // Batch source queries to avoid overwhelming the ZAI API rate limit.
    // ZAI-dependent sources (web_search, opencorporates, icij, fec, threat_intel)
    // share a rate limit with chat.completions.create() used in AI synthesis.
    // Firing them all simultaneously exhausts the budget, causing synthesis to fail.
    const ZAI_SOURCES = new Set(["web_search", "opencorporates", "icij", "fec", "threat_intel"]);
    const zaiSources = sources.filter((s) => ZAI_SOURCES.has(s));
    const nonZaiSources = sources.filter((s) => !ZAI_SOURCES.has(s));

    // Phase 1: Fire all non-ZAI sources in parallel (they use direct HTTP, no rate limit)
    const nonZaiResults = await Promise.allSettled(
      nonZaiSources.map((s) => withTimeout(runSource(s, detection), 14000, s))
    );

    // Phase 2: Fire ZAI-dependent sources sequentially (1 at a time) to preserve rate limit
    const zaiResults: PromiseSettledResult<SourceResult>[] = [];
    for (const s of zaiSources) {
      zaiResults.push(await withTimeout(runSource(s, detection), 14000, s).then(
        (val) => ({ status: "fulfilled" as const, value: val }),
        (reason) => ({ status: "rejected" as const, reason })
      ));
    }

    // Merge results back in original source order
    const resultMap = new Map<string, PromiseSettledResult<SourceResult>>();
    nonZaiSources.forEach((s, i) => resultMap.set(s, nonZaiResults[i]));
    zaiSources.forEach((s, i) => resultMap.set(s, zaiResults[i]));

    const sourceResults: SourceResult[] = sources.map((key) => {
      const r = resultMap.get(key);
      if (r && r.status === "fulfilled") return r.value;
      return {
        source: key,
        source_label: SOURCE_LABELS[key],
        target: detection.sanitized,
        status: "timeout" as const,
        error: r?.reason?.message || "Source timed out",
        findings: [],
      };
    });
    const okCount = sourceResults.filter((r) => r.status === "success").length;
    setStep(rec, 2, "success", `${okCount}/${sources.length} sources responded`);

    // Feature 25 — Record provenance for each collected finding
    recordCollectionProvenance(id, sourceResults, detection).catch((e) =>
      console.error("[pipeline] provenance recording failed", e instanceof Error ? e.message : String(e))
    );

    // STEP 4 — normalize
    setStep(rec, 3, "loading");
    const bundle = normalizeSourceResults(sourceResults);
    setStep(
      rec,
      3,
      "success",
      `${bundle.all_findings.length} findings · ${bundle.geopoints.length} geo points`
    );
    updateRecord(id, { source_results: sourceResults });

    // Rate limit cooldown no longer needed — ZAI sources are now queried sequentially
    // after sequential source queries, preserving budget for synthesis
    // Brief delay to let ZAI API rate limit partially reset after source queries
    await new Promise((r) => setTimeout(r, 3000));

    // STEP 5 — synthesize
    setStep(rec, 4, "loading", "Synthesizing report with AI (low-temp, JSON)…");
    const synth = await synthesizeReport(
      detection.sanitized,
      detection.inputType,
      bundle.all_findings
    );

    let synthRaw: AISynthesisRaw | null = synth.raw;
    let usedFallback = false;

    if (!synthRaw) {
      // AI synthesis failed — generate a fallback report from raw findings
      // so the user still gets useful intelligence instead of a blank error
      console.warn("[pipeline] AI synthesis failed, generating fallback report:", synth.error);
      synthRaw = generateFallbackReport(detection.sanitized, detection.inputType, bundle.all_findings);
      usedFallback = true;
    }

    setStep(
      rec,
      4,
      "success",
      usedFallback
        ? `Fallback report generated (${synthRaw.key_findings.length} findings) — AI synthesis was unavailable`
        : `${synth.attempts} attempt(s) · ${synthRaw.key_findings.length} findings · ${synthRaw.hypotheses.length} hypotheses`
    );

    // STEP 6 — ACH (with graceful fallback if AI is unavailable)
    setStep(rec, 5, "loading", "Building ACH matrix…");
    let achMatrix: { matrix: string[][]; rationale: string } | null = null;
    try {
      achMatrix = await synthesizeACH(
        detection.sanitized,
        bundle.all_findings.slice(0, 10).map((f) => ({ text: f.data, source: f.source_label })),
        synthRaw.hypotheses
      );
    } catch (e) {
      console.warn("[pipeline] ACH synthesis failed, using fallback:", e instanceof Error ? e.message : String(e));
    }
    // buildAch handles null matrixInput by using heuristic fallback values
    const ach = buildAch(synthRaw.key_findings, synthRaw.hypotheses, achMatrix);
    setStep(rec, 5, "success", `${ach.hypotheses.length} hypotheses ranked${achMatrix ? "" : " (heuristic fallback)"}`);

    // STEP 7 — attribution check
    setStep(rec, 6, "loading", "Validating [SOURCE] attribution on every claim…");
    const baseReport: ReportData = {
      executive_summary: synthRaw.executive_summary,
      bluf: synthRaw.bluf,
      timeline: synthRaw.timeline,
      five_w1h: synthRaw.five_w1h,
      key_findings: synthRaw.key_findings.map((k) => ({
        claim: ensureSourceTag(k.claim, k.source, k.source_url),
        source: k.source,
        source_url: k.source_url,
        confidence: k.confidence,
      })),
      detailed_analysis: synthRaw.detailed_analysis,
      contradictions: synthRaw.contradictions,
      risk_matrix: synthRaw.risk_matrix,
      sources_consulted: bundle.sources_consulted,
      ach_analysis: ach,
      geopoints: bundle.geopoints,
      link_graph: synthRaw.link_graph,
      collection_gaps: synthRaw.collection_gaps,
      monitoring_recommendations: synthRaw.monitoring_recommendations,
      confidence_score: synthRaw.overall_confidence,
      attribution_valid: false,
      needs_manual_review: false,
      input_type: detection.inputType,
      script: detection.script,
      language_guess: detection.languageGuess,
      target: detection.sanitized,
    };
    const attributed = markAttribution(baseReport);
    setStep(
      rec,
      6,
      attributed.attribution_valid ? "success" : "error",
      attributed.attribution_valid
        ? "All claims sourced ✓"
        : `Flagged for manual review (${attributed.needs_manual_review ? "unsourced claims" : ""})`
    );

    // STEP 8 — format
    setStep(rec, 7, "loading");
    setStep(rec, 7, "success", "Report ready");

    updateRecord(id, {
      status: "completed",
      completed_at: new Date().toISOString(),
      report: attributed,
    });

    // Feature 25 — Record synthesis + reporting provenance
    recordSynthesisProvenance(id, attributed, detection).catch((e) =>
      console.error("[pipeline] synthesis provenance failed", e instanceof Error ? e.message : String(e))
    );

    // Feature 19 — auto-ingest the completed investigation into the Knowledge Base
    // (fire-and-forget; idempotent — re-runs are no-ops)
    ingestIntoKnowledgeBase(id, "standard").catch((e) =>
      console.error("[pipeline] KB auto-ingest failed", id, e instanceof Error ? e.message : String(e))
    );

    // Notify the user that their investigation is complete.
    createNotification({
      userId: rec.userId,
      type: "investigation.complete",
      title: `Investigation complete: ${rec.target}`,
      body: `Your investigation of "${rec.target}" has completed successfully.`,
      severity: "success",
      category: "investigation",
      resourceType: "investigation",
      resourceId: id,
      routeName: "investigation-report",
      routeParams: { id },
    }).catch(() => {});
  } catch (e) {
    updateRecord(id, {
      status: "failed",
      error: e instanceof Error ? e.message : "Pipeline failed",
      completed_at: new Date().toISOString(),
    });

    // Notify the user that their investigation failed.
    createNotification({
      userId: rec.userId,
      type: "investigation.failed",
      title: `Investigation failed: ${rec.target}`,
      body: e instanceof Error ? e.message : "Pipeline failed",
      severity: "error",
      category: "investigation",
      resourceType: "investigation",
      resourceId: id,
      routeName: "investigation",
      routeParams: { id },
    }).catch(() => {});
  }
}

// Ensure every key-finding claim carries a [SOURCE] tag (auto-append if missing)
function ensureSourceTag(claim: string, source: string, url: string): string {
  if (/\[SOURCE[:\s]/i.test(claim)) return claim;
  return `${claim} [SOURCE: ${source}, URL: ${url}]`;
}

async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  _label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${_label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ============================================================================
// Feature 25 — Provenance recording helpers
// ============================================================================

/** Record provenance for all findings collected from sources. */
async function recordCollectionProvenance(
  investigationId: string,
  sourceResults: SourceResult[],
  detection: DetectionResult
): Promise<void> {
  const { recordCollection } = await import("./provenance");
  for (const sr of sourceResults) {
    if (sr.status !== "success") continue;
    for (let i = 0; i < sr.findings.length; i++) {
      const finding = sr.findings[i];
      const evidenceId = `${investigationId}:finding:${sr.source}:${i}`;
      try {
        await recordCollection(
          investigationId,
          evidenceId,
          sr.source,
          sr.source_label,
          finding,
          detection,
          sr.latency_ms || 0,
          "query"
        );
      } catch (e) {
        console.error("[pipeline] provenance record failed for", evidenceId, e);
      }
    }
  }
}

/** Record provenance for AI synthesis and report generation. */
async function recordSynthesisProvenance(
  investigationId: string,
  report: ReportData,
  detection: DetectionResult
): Promise<void> {
  const { recordSynthesis, recordReporting } = await import("./provenance");

  // Record synthesis event
  const synthesisEvidenceId = `${investigationId}:synthesis`;
  try {
    await recordSynthesis(
      investigationId,
      synthesisEvidenceId,
      [], // parent IDs would be the collection events
      {
        executive_summary: report.executive_summary,
        key_findings_count: report.key_findings.length,
        confidence_score: report.confidence_score,
        target: report.target,
      },
      report.confidence_score,
      `AI synthesis of ${report.key_findings.length} findings with overall confidence ${report.confidence_score}`
    );
  } catch (e) {
    console.error("[pipeline] synthesis provenance failed", e);
  }

  // Record reporting events for key findings
  for (let i = 0; i < Math.min(report.key_findings.length, 10); i++) {
    const finding = report.key_findings[i];
    const evidenceId = `${investigationId}:report_finding:${i}`;
    try {
      await recordReporting(
        investigationId,
        evidenceId,
        [synthesisEvidenceId],
        `key_finding_${i + 1}`,
        finding.claim,
        finding.confidence
      );
    } catch (e) {
      console.error("[pipeline] reporting provenance failed for finding", i, e);
    }
  }
}

// ============================================================================
// Fallback Report Generator — when AI synthesis fails, build a report from
// raw findings so the user still gets useful intelligence.
// ============================================================================

function generateFallbackReport(
  target: string,
  inputType: string,
  findings: { source: string; source_label: string; source_url: string; data: string; confidence: number; timestamp: string }[]
): AISynthesisRaw {
  // Sort findings by confidence (highest first)
  const sorted = [...findings].sort((a, b) => b.confidence - a.confidence);

  // Build key findings from the top 15 findings
  const keyFindings = sorted.slice(0, 15).map((f) => ({
    claim: `${f.data.slice(0, 200)} [SOURCE: ${f.source_label}, URL: ${f.source_url}]`,
    source: f.source_label,
    source_url: f.source_url,
    confidence: f.confidence,
  }));

  // Build executive summary from top findings
  const topSources = [...new Set(sorted.slice(0, 10).map((f) => f.source_label))];
  const execSummary = `Intelligence report for ${target} (${inputType}). ` +
    `Collected ${findings.length} findings from ${topSources.length} sources. ` +
    `Top sources: ${topSources.slice(0, 5).join(", ")}. ` +
    `Note: AI synthesis was unavailable; this report was generated from raw findings without AI analysis. ` +
    `Key findings are presented as-is from source data.`;

  // Build simple timeline from findings with timestamps
  const timeline = sorted
    .filter((f) => f.timestamp && !isNaN(new Date(f.timestamp).getTime()))
    .slice(0, 10)
    .map((f) => ({
      date: f.timestamp,
      event: f.data.slice(0, 150),
      source: f.source_label,
      source_url: f.source_url,
      confidence: f.confidence,
    }));

  // Build simple hypotheses
  const hypotheses = [
    {
      statement: `${target} is a legitimate ${inputType} with publicly available information`,
      confidence: sorted.length > 5 ? 0.7 : 0.4,
      rationale: `Based on ${sorted.length} findings from ${topSources.length} sources`,
    },
    {
      statement: `${target} may have security or reputational concerns`,
      confidence: 0.3,
      rationale: "Requires further analysis of specific findings",
    },
  ];

  // Calculate overall confidence from finding confidences
  const avgConfidence = sorted.length > 0
    ? sorted.reduce((s, f) => s + f.confidence, 0) / sorted.length
    : 0.3;

  return {
    executive_summary: execSummary,
    bluf: {
      text: `BLUF: ${target} investigated with ${findings.length} findings from ${topSources.length} sources. AI synthesis was unavailable; report generated from raw data.`,
      key_judgment: `${target} has ${findings.length} data points from OSINT sources. Manual review recommended for deeper analysis.`,
      confidence_level: avgConfidence >= 0.7 ? "high" : avgConfidence >= 0.4 ? "moderate" : "low",
    },
    five_w1h: {
      who: target,
      what: `${inputType} investigated via ${topSources.length} OSINT sources`,
      when: new Date().toISOString(),
      where: "See geopoints and source data",
      why: "Investigation requested by user",
      how: `Data collected from ${topSources.join(", ")}`,
    },
    timeline,
    key_findings: keyFindings,
    detailed_analysis: `Detailed analysis was not available because AI synthesis failed. ` +
      `However, ${findings.length} findings were collected from ${topSources.length} sources. ` +
      `The key findings above represent the highest-confidence data points. ` +
      `Review the Findings tab for the complete dataset and the Sources tab for source details.`,
    contradictions: [],
    risk_matrix: [],
    link_graph: { nodes: [], edges: [] },
    collection_gaps: [
      { area: "AI Analysis", description: "AI synthesis was unavailable — manual analysis required", recommended_sources: [], priority: "high" as const },
    ],
    monitoring_recommendations: [
      { action: "Re-run investigation when AI service is available", frequency: "once", rationale: "AI synthesis failed, limiting analysis depth", source: "system" },
    ],
    overall_confidence: avgConfidence,
    hypotheses,
  };
}
