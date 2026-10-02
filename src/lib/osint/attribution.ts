// Source attribution enforcement. HARD REQUIREMENT: every claim must carry a
// [SOURCE: ...] tag. This module validates AI output and flags unsourced claims.

import type { KeyFinding, ReportData } from "./types";

const SOURCE_TAG_RE = /\[SOURCE:\s*[^,\]]+,\s*URL:\s*[^\]]+\]/i;
const SOURCE_TAG_LOOSE_RE = /\[SOURCE[:\s]/i;

export interface AttributionValidation {
  valid: boolean;
  unsourced_claims: string[];
  total_claims: number;
  sourced_claims: number;
}

export function claimHasSource(claim: string): boolean {
  return SOURCE_TAG_RE.test(claim) || SOURCE_TAG_LOOSE_RE.test(claim);
}

export function validateAttribution(findings: KeyFinding[]): AttributionValidation {
  const unsourced: string[] = [];
  for (const f of findings) {
    if (!claimHasSource(f.claim)) {
      unsourced.push(f.claim.slice(0, 120));
    }
  }
  return {
    valid: unsourced.length === 0,
    unsourced_claims: unsourced.slice(0, 8),
    total_claims: findings.length,
    sourced_claims: findings.length - unsourced.length,
  };
}

// Split a long text body into sentences and verify each substantive sentence
// carries a source tag. Returns unsourced sentences for the manual-review flag.
export function validateDetailedAnalysis(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40);
  return sentences.filter((s) => !claimHasSource(s)).slice(0, 6);
}

export function markAttribution(report: ReportData): ReportData {
  const fnd = validateAttribution(report.key_findings);
  const unsourcedDetailed = validateDetailedAnalysis(report.detailed_analysis);
  const attributionValid = fnd.valid && unsourcedDetailed.length === 0;
  return {
    ...report,
    attribution_valid: attributionValid,
    needs_manual_review: !attributionValid,
  };
}
