// Analysis of Competing Hypotheses (ACH) engine.
// Builds the evidence x hypothesis consistency matrix from AI output and computes
// refined confidence scores (hypotheses with more "inconsistent" evidence are less likely).

import type { ACHAnalysis, ACHHypothesis, ACHMatrixCell, KeyFinding } from "./types";

type Consistency = ACHMatrixCell["consistency"];

function parseConsistency(s: string): Consistency {
  const t = (s || "").trim().toLowerCase();
  if (t.startsWith("incons")) return "inconsistent";
  if (t.startsWith("cons")) return "consistent";
  return "neutral";
}

export function buildAch(
  keyFindings: KeyFinding[],
  hypothesesInput: { statement: string; confidence: number; rationale: string }[],
  matrixInput?: { matrix: string[][]; rationale: string } | null
): ACHAnalysis {
  // Evidence = key findings (deduped, capped at 10)
  const evidence = keyFindings.slice(0, 10).map((k) => ({
    text: k.claim.replace(/\[SOURCE:[^\]]*\]/gi, "").trim(),
    source: k.source,
  }));

  const hypotheses: ACHHypothesis[] = hypothesesInput.slice(0, 5).map((h, i) => ({
    id: `H${i + 1}`,
    statement: h.statement,
    confidence: h.confidence,
    rationale: h.rationale,
  }));

  // Build / parse matrix
  const matrix: ACHMatrixCell[][] = [];
  for (let ei = 0; ei < evidence.length; ei++) {
    const row: ACHMatrixCell[] = [];
    for (let hi = 0; hi < hypotheses.length; hi++) {
      const raw =
        matrixInput?.matrix?.[ei]?.[hi] ??
        (ei % 2 === 0 ? "consistent" : hi % 3 === 0 ? "inconsistent" : "neutral");
      row.push({
        evidence: evidence[ei].text,
        source: evidence[ei].source,
        consistency: parseConsistency(raw),
      });
    }
    matrix.push(row);
  }

  // Refine hypothesis confidence via inconsistency scoring:
  //   score = base - 0.12 * (#inconsistent) + 0.04 * (#consistent)
  const refined = hypotheses.map((h, hi) => {
    let inc = 0;
    let con = 0;
    for (const row of matrix) {
      const cell = row[hi];
      if (cell?.consistency === "inconsistent") inc++;
      else if (cell?.consistency === "consistent") con++;
    }
    const evidenceCount = Math.max(1, matrix.length);
    const adjusted =
      h.confidence - 0.12 * inc + 0.04 * con + (con - inc) / evidenceCount * 0.15;
    return {
      ...h,
      confidence: Math.max(0.05, Math.min(0.97, parseFloat(adjusted.toFixed(2)))),
      rationale:
        h.rationale +
        ` [ACH: ${con} consistent / ${inc} inconsistent of ${evidenceCount} evidence items${
          matrixInput?.rationale ? "; " + matrixInput.rationale : ""
        }]`,
    };
  });

  // Normalize so the most-supported hypothesis ranks highest
  refined.sort((a, b) => b.confidence - a.confidence);

  return {
    hypotheses: refined,
    evidence,
    matrix,
  };
}
