// Entity Extractor — parses source finding text to discover new entities.
// Scans finding data strings for domains, IPs, emails, wallets, CVEs, hashes, URLs.
// Uses the regex patterns from the detector module for consistency.
//
// Design:
// - Pure function: given findings, returns discovered entities. No side effects.
// - Configurable: max entities per extraction, depth tracking.
// - Deduplication: uses entityId() to avoid returning the same entity twice.
// - Confidence scoring: entities found in high-confidence findings get higher confidence.

import type { NormalizedFinding } from "../types";
import type { DiscoveredEntity } from "./types";
import { entityId } from "./types";
import { PATTERNS } from "../detector";

/** Maximum entities to extract from a single source result (prevents explosion). */
const MAX_ENTITIES_PER_SOURCE = 15;

/** Maximum context length to store with each discovered entity. */
const MAX_CONTEXT_LENGTH = 200;

/**
 * Extract entities from a list of findings.
 * @param findings The findings from a single source result.
 * @param sourceKey The source key that produced these findings.
 * @param sourceLabel The human-readable source label.
 * @param depth The recursion depth to assign to discovered entities.
 * @param existingEntityIds Set of already-discovered entity IDs (for dedup).
 * @returns Array of newly discovered entities (deduplicated, not in existingEntityIds).
 */
export function extractEntities(
  findings: NormalizedFinding[],
  sourceKey: string,
  sourceLabel: string,
  depth: number,
  existingEntityIds: Set<string>
): DiscoveredEntity[] {
  const discovered: DiscoveredEntity[] = [];
  const seenInThisExtraction = new Set<string>();
  const now = new Date().toISOString();

  for (const finding of findings) {
    if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;

    // The finding data is a text string that may contain entities
    const text = finding.data;

    // Extract domains (but not if they're part of an email or URL — those are handled separately)
    const domainMatches = extractMatches(text, PATTERNS.DOMAIN_RE);
    for (const domain of domainMatches) {
      const id = entityId(domain, "domain");
      if (existingEntityIds.has(id) || seenInThisExtraction.has(id)) continue;
      seenInThisExtraction.add(id);
      discovered.push({
        id,
        value: domain,
        type: "domain",
        depth,
        discoveredBy: sourceKey,
        discoveredByLabel: sourceLabel,
        discoveredAt: now,
        confidence: Math.min(0.95, finding.confidence + 0.05),
        context: truncate(text, MAX_CONTEXT_LENGTH),
      });
      if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;
    }

    if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;

    // Extract IPv4 addresses
    const ipv4Matches = extractMatches(text, PATTERNS.IPv4_RE);
    for (const ip of ipv4Matches) {
      const id = entityId(ip, "ip");
      if (existingEntityIds.has(id) || seenInThisExtraction.has(id)) continue;
      // Skip private/local IPs — not useful for OSINT
      if (isPrivateIP(ip)) continue;
      seenInThisExtraction.add(id);
      discovered.push({
        id,
        value: ip,
        type: "ip",
        depth,
        discoveredBy: sourceKey,
        discoveredByLabel: sourceLabel,
        discoveredAt: now,
        confidence: Math.min(0.95, finding.confidence + 0.05),
        context: truncate(text, MAX_CONTEXT_LENGTH),
      });
      if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;
    }

    if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;

    // Extract emails
    const emailMatches = extractMatches(text, PATTERNS.EMAIL_RE);
    for (const email of emailMatches) {
      const id = entityId(email, "email");
      if (existingEntityIds.has(id) || seenInThisExtraction.has(id)) continue;
      seenInThisExtraction.add(id);
      discovered.push({
        id,
        value: email,
        type: "email",
        depth,
        discoveredBy: sourceKey,
        discoveredByLabel: sourceLabel,
        discoveredAt: now,
        confidence: Math.min(0.9, finding.confidence),
        context: truncate(text, MAX_CONTEXT_LENGTH),
      });
      if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;
    }

    if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;

    // Extract CVE IDs
    const cveMatches = extractMatches(text, PATTERNS.CVE_RE);
    for (const cve of cveMatches) {
      const id = entityId(cve.toUpperCase(), "cve");
      if (existingEntityIds.has(id) || seenInThisExtraction.has(id)) continue;
      seenInThisExtraction.add(id);
      discovered.push({
        id,
        value: cve.toUpperCase(),
        type: "cve",
        depth,
        discoveredBy: sourceKey,
        discoveredByLabel: sourceLabel,
        discoveredAt: now,
        confidence: Math.min(0.95, finding.confidence + 0.05),
        context: truncate(text, MAX_CONTEXT_LENGTH),
      });
      if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;
    }

    if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;

    // Extract cryptocurrency wallets (ETH + BTC)
    const ethMatches = extractMatches(text, PATTERNS.ETH_RE);
    for (const addr of ethMatches) {
      const id = entityId(addr.toLowerCase(), "wallet");
      if (existingEntityIds.has(id) || seenInThisExtraction.has(id)) continue;
      seenInThisExtraction.add(id);
      discovered.push({
        id,
        value: addr,
        type: "wallet",
        depth,
        discoveredBy: sourceKey,
        discoveredByLabel: sourceLabel,
        discoveredAt: now,
        confidence: 0.9,
        context: truncate(text, MAX_CONTEXT_LENGTH),
      });
      if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;
    }

    const btcMatches = extractMatches(text, PATTERNS.BTC_RE);
    for (const addr of btcMatches) {
      const id = entityId(addr, "wallet");
      if (existingEntityIds.has(id) || seenInThisExtraction.has(id)) continue;
      seenInThisExtraction.add(id);
      discovered.push({
        id,
        value: addr,
        type: "wallet",
        depth,
        discoveredBy: sourceKey,
        discoveredByLabel: sourceLabel,
        discoveredAt: now,
        confidence: 0.9,
        context: truncate(text, MAX_CONTEXT_LENGTH),
      });
      if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;
    }

    // Extract file hashes (SHA256, SHA1, MD5)
    const hashMatches = extractMatches(text, PATTERNS.HASH_RE);
    for (const hash of hashMatches) {
      const id = entityId(hash.toLowerCase(), "hash");
      if (existingEntityIds.has(id) || seenInThisExtraction.has(id)) continue;
      seenInThisExtraction.add(id);
      discovered.push({
        id,
        value: hash.toLowerCase(),
        type: "hash",
        depth,
        discoveredBy: sourceKey,
        discoveredByLabel: sourceLabel,
        discoveredAt: now,
        confidence: 0.85,
        context: truncate(text, MAX_CONTEXT_LENGTH),
      });
      if (discovered.length >= MAX_ENTITIES_PER_SOURCE) break;
    }
  }

  return discovered;
}

/**
 * Extract all unique matches of a regex from a text string.
 * Uses matchAll to find all occurrences, then deduplicates.
 * Strips ^ and $ anchors so the regex can match substrings within larger text.
 */
function extractMatches(text: string, regex: RegExp): string[] {
  const matches: string[] = [];
  // Strip leading/trailing anchors and create a global regex
  let source = regex.source;
  if (source.startsWith("^")) source = source.slice(1);
  if (source.endsWith("$") && !source.endsWith("\\$")) source = source.slice(0, -1);
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  const globalRegex = new RegExp(source, flags);
  let m: RegExpExecArray | null;
  while ((m = globalRegex.exec(text)) !== null) {
    const match = m[0];
    if (match && !matches.includes(match)) {
      matches.push(match);
    }
    // Prevent infinite loop on zero-length matches
    if (m.index === globalRegex.lastIndex) {
      globalRegex.lastIndex++;
    }
  }
  return matches;
}

/** Truncate a string to maxLen, adding "…" if truncated. */
function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

/** Check if an IP is private/local (RFC 1918 + loopback + link-local). */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p))) return false;
  const [a, b] = parts;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  return false;
}
