// OFAC SDN fuzzy matcher using Levenshtein distance.
// Returns ranked matches with similarity scores.

import { SDN_SAMPLE, SDN_LIST_SIZE } from "./ofac-data";
import type { SanctionsMatch, SanctionsResult } from "./types";

// Normalize: uppercase, strip punctuation, collapse whitespace, remove common honorifics.
const STOP_PREFIXES = ["MR", "MRS", "MS", "DR", "PROF", "SHEIKH", "SHEIK", "HAJI", "HAJJI"];

export function normalizeName(name: string): string {
  let n = name.toUpperCase();
  n = n.replace(/[.,;'`"\-_/\\()]/g, " ");
  n = n.replace(/\bJR\b|\bSR\b|\bII\b|\bIII\b/g, " ");
  // remove stop prefixes
  for (const p of STOP_PREFIXES) {
    n = n.replace(new RegExp(`\\b${p}\\b`, "g"), " ");
  }
  n = n.replace(/\s+/g, " ").trim();
  return n;
}

// Classic Levenshtein distance (iterative, O(m*n)).
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function similarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  let score = 1 - dist / maxLen;

  // Token-overlap bonus (handles reordered names "JOHN DOE" vs "DOE JOHN")
  const ta = new Set(na.split(" ").filter(Boolean));
  const tb = new Set(nb.split(" ").filter(Boolean));
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  const tokenSim = (2 * common) / (ta.size + tb.size);
  score = Math.max(score, tokenSim * 0.92);

  // Partial containment bonus for org names
  if (nb.includes(na) || na.includes(nb)) {
    score = Math.max(score, 0.88);
  }
  return Math.min(1, score);
}

export function screenSanctions(
  query: string,
  threshold = 0.6
): SanctionsResult {
  const matches: SanctionsMatch[] = [];
  for (const entry of SDN_SAMPLE) {
    // Primary: match against canonical name
    let bestScore = similarity(query, entry.name);
    // Secondary: match against remarks/aliases (e.g. "El Chapo" in remarks)
    if (entry.remarks) {
      const aliasScore = similarity(query, entry.remarks);
      if (aliasScore > bestScore) bestScore = aliasScore;
    }
    if (bestScore >= threshold) {
      matches.push({
        sdn_name: entry.name,
        similarity: parseFloat(bestScore.toFixed(3)),
        program: entry.program,
        entity_type: entry.entity_type,
        remarks: entry.remarks,
        details_url: `https://sanctionssearch.ofac.treas.gov/Details.aspx?id=${encodeURIComponent(
          entry.name
        )}`,
      });
    }
  }
  matches.sort((a, b) => b.similarity - a.similarity);
  const top = matches.slice(0, 5);
  let status: SanctionsResult["match_status"] = "no_match";
  if (top.length) {
    if (top[0].similarity >= 0.92) status = "likely_match";
    else status = "possible_match";
  }
  return {
    query,
    match_status: status,
    matches: top,
    list_size: SDN_LIST_SIZE,
    checked_at: new Date().toISOString(),
  };
}
