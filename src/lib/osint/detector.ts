// Universal target detection + language/script routing for OSINTiger.
// Detects 11 target types: person, organization, domain, IPv4/IPv6,
// Ethereum/Bitcoin wallet, CVE ID, email, username, phone, URL, hash.
// Detects script (latin, arabic, hebrew, cyrillic, cjk, devanagari, greek) and region hints.
// Uses regex + heuristics + confidence scoring.

import type { DetectionResult, InputType, LanguageScript } from "./types";

const DOMAIN_RE =
  /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/i;
const IPv4_RE =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPv6_RE = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
// EIP-55 checksum aware: 0x + 40 hex
const ETH_RE = /^0x[a-fA-F0-9]{40}$/;
// Bitcoin: legacy (1...), P2SH (3...), Bech32 (bc1...)
const BTC_RE = /^(bc1[a-z0-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;
// CVE ID: CVE-YYYY-NNNN+
const CVE_RE = /^CVE-\d{4}-\d+$/i;
// Email — RFC 5322 simplified
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
// URL — http(s):// or scheme-relative
const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+[/#?]?.*$/i;
// Phone — E.164 or common international/national formats
const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;
// Hash — MD5 (32), SHA1 (40), SHA256 (64), SHA512 (128) hex
const HASH_RE = /^(?:[a-f0-9]{32}|[a-f0-9]{40}|[a-f0-9]{64}|[a-f0-9]{128})$/i;
// Username — starts with @ or is a single token of 3-30 word chars (after ruling out other types)
const USERNAME_RE = /^@?[a-zA-Z0-9_]{3,30}$/;

const CC_TLD_TO_REGION: Record<string, string> = {
  ru: "RU", su: "RU", cn: "CN", jp: "JP", kr: "KR", tw: "TW",
  uk: "GB", de: "DE", fr: "FR", it: "IT", es: "ES", br: "BR",
  in: "IN", ir: "IR", il: "IL", sa: "SA", ae: "AE", tr: "TR",
  ua: "UA", pl: "PL", nl: "NL", ch: "CH", ca: "CA", au: "AU",
  sg: "SG", hk: "HK", me: "ME", rs: "RS",
};

export function sanitize(raw: string): string {
  return raw
    .replace(/[<>]/g, "")
    .replace(/\u200b|\u200c|\u200d/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 256);
}

export function detectScript(text: string): LanguageScript {
  // Strip spaces, digits, punctuation for script detection
  const chars = text.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!chars) return "latin";
  const counts: Record<LanguageScript, number> = {
    latin: 0, arabic: 0, hebrew: 0, cyrillic: 0,
    cjk: 0, devanagari: 0, greek: 0,
  };
  for (const ch of chars) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0600 && code <= 0x06ff) counts.arabic++;
    else if (code >= 0x0590 && code <= 0x05ff) counts.hebrew++;
    else if (code >= 0x0400 && code <= 0x04ff) counts.cyrillic++;
    else if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0xac00 && code <= 0xd7af)
    )
      counts.cjk++;
    else if (code >= 0x0900 && code <= 0x097f) counts.devanagari++;
    else if (code >= 0x0370 && code <= 0x03ff) counts.greek++;
    else if (code >= 0x0041 && code <= 0x024f) counts.latin++;
  }
  let best: LanguageScript = "latin";
  let bestN = 0;
  (Object.keys(counts) as LanguageScript[]).forEach((k) => {
    if (counts[k] > bestN) {
      bestN = counts[k];
      best = k;
    }
  });
  return best;
}

export function languageFromScript(
  script: LanguageScript,
  text: string
): string {
  switch (script) {
    case "arabic":
      return "ar";
    case "hebrew":
      return "he";
    case "cyrillic":
      return "ru";
    case "cjk":
      return /[\uac00-\ud7af]/.test(text) ? "ko" : /[\u3040-\u30ff]/.test(text) ? "ja" : "zh";
    case "devanagari":
      return "hi";
    case "greek":
      return "el";
    default:
      return "en";
  }
}

export function extractRegionHints(text: string): string[] {
  const hints = new Set<string>();
  // TLD detection on a domain-like trailing token
  const tldMatch = text.match(/\.([a-z]{2,})$/i);
  if (tldMatch && CC_TLD_TO_REGION[tldMatch[1].toLowerCase()]) {
    hints.add(CC_TLD_TO_REGION[tldMatch[1].toLowerCase()]);
  }
  // Country names (lightweight)
  const countryWords: Record<string, string> = {
    russia: "RU", russian: "RU", moscow: "RU",
    china: "CN", chinese: "CN", beijing: "CN", shanghai: "CN",
    iran: "IR", tehran: "IR",
    israel: "IL", tel: "IL", jerusalem: "IL",
    ukraine: "UA", kyiv: "UA",
    india: "IN", mumbai: "IN", delhi: "IN",
    "north korea": "KP", pyongyang: "KP",
    "united states": "US", america: "US", washington: "US",
    "united kingdom": "GB", london: "GB",
  };
  const lower = text.toLowerCase();
  for (const [word, code] of Object.entries(countryWords)) {
    if (lower.includes(word)) hints.add(code);
  }
  return [...hints];
}

// Heuristic-based detection scoring — returns confidence 0-1 for each candidate type.
function scoreType(s: string): Record<string, number> {
  const scores: Record<string, number> = {
    person: 0, organization: 0, domain: 0, ip: 0, wallet: 0,
    cve: 0, email: 0, username: 0, phone: 0, url: 0, hash: 0,
  };

  // Strong signal: exact regex matches
  if (CVE_RE.test(s)) scores.cve = 1.0;
  if (ETH_RE.test(s)) scores.wallet = 1.0;
  if (BTC_RE.test(s)) scores.wallet = 1.0;
  if (IPv4_RE.test(s) || IPv6_RE.test(s)) scores.ip = 1.0;
  if (EMAIL_RE.test(s)) scores.email = 1.0;
  if (HASH_RE.test(s)) scores.hash = 0.95;
  if (URL_RE.test(s) && (s.startsWith("http://") || s.startsWith("https://"))) scores.url = 0.95;

  // Domain: must look like domain AND not be email/URL
  if (DOMAIN_RE.test(s) && s.includes(".") && !s.includes("@") && !s.startsWith("http")) {
    scores.domain = 0.9;
  }

  // Phone: must be mostly digits with optional +/spaces/dashes/parens
  const digitCount = (s.match(/\d/g) || []).length;
  const stripped = s.replace(/[\s\-().]/g, "");
  if (PHONE_RE.test(s) && digitCount >= 7 && digitCount <= 15 && !s.includes("@")) {
    scores.phone = 0.85;
  }

  // Username: single token starting with @ OR a single lowercase/handle word
  if (s.startsWith("@") && USERNAME_RE.test(s.slice(1))) {
    scores.username = 0.9;
  } else if (!s.includes(" ") && !s.includes(".") && !s.includes("@") && USERNAME_RE.test(s) && stripped.length < 25) {
    // Could be a username OR a person name — lower confidence
    scores.username = 0.4;
  }

  // Person vs Organization heuristics
  const orgSignals =
    /\b(inc|llc|ltd|corp|corporation|gmbh|s\.?a\.?|ag|sarl|bv|nv|pty|plc|co|group|holdings|foundation|limited)\b/i.test(s);
  const multiWord = s.trim().split(/\s+/).length;
  if (orgSignals && multiWord <= 5) {
    scores.organization = 0.8;
  } else if (multiWord >= 2 && multiWord <= 4) {
    scores.person = 0.6;
  } else if (multiWord === 1 && !scores.username && !scores.domain) {
    scores.person = 0.3;
  }

  return scores;
}

export function detectInput(raw: string, override?: InputType): DetectionResult {
  const sanitized = sanitize(raw);
  if (!sanitized) {
    return {
      inputType: "person",
      script: "latin",
      languageGuess: "en",
      regionHints: [],
      sanitized: "",
      valid: false,
      reason: "Empty input",
      detectionConfidence: 0,
    };
  }

  const script = detectScript(sanitized);
  const languageGuess = languageFromScript(script, sanitized);
  const regionHints = extractRegionHints(sanitized);

  // Determine type — respect manual override first
  let inputType: Exclude<InputType, "auto">;
  let detectionConfidence: number;

  if (override && override !== "auto") {
    inputType = override;
    detectionConfidence = 1.0; // user explicitly chose
  } else {
    // Use scored heuristics — pick the highest-scoring type
    const scores = scoreType(sanitized);
    let bestType: Exclude<InputType, "auto"> = "person";
    let bestScore = 0;
    for (const [k, v] of Object.entries(scores)) {
      if (v > bestScore) {
        bestScore = v;
        bestType = k as Exclude<InputType, "auto">;
      }
    }
    inputType = bestType;
    detectionConfidence = bestScore;

    // LLM fallback would go here — for now, if confidence < 0.4, default to person search
    if (bestScore < 0.4) {
      inputType = "person";
      detectionConfidence = 0.3;
    }
  }

  let valid = true;
  let reason: string | undefined;
  if (inputType === "wallet" && !ETH_RE.test(sanitized) && !BTC_RE.test(sanitized)) {
    valid = false;
    reason = "Invalid wallet address (expected ETH 0x...40hex or BTC 1.../3.../bc1...)";
  } else if (inputType === "cve" && !CVE_RE.test(sanitized)) {
    valid = false;
    reason = "Invalid CVE ID (expected CVE-YYYY-NNNN)";
  } else if (inputType === "domain" && !DOMAIN_RE.test(sanitized)) {
    valid = false;
    reason = "Invalid domain format";
  } else if (inputType === "ip" && !IPv4_RE.test(sanitized) && !IPv6_RE.test(sanitized)) {
    valid = false;
    reason = "Invalid IP address";
  } else if (inputType === "email" && !EMAIL_RE.test(sanitized)) {
    valid = false;
    reason = "Invalid email address";
  } else if (inputType === "phone" && !PHONE_RE.test(sanitized)) {
    valid = false;
    reason = "Invalid phone number";
  } else if (inputType === "url" && !URL_RE.test(sanitized)) {
    valid = false;
    reason = "Invalid URL";
  } else if (inputType === "hash" && !HASH_RE.test(sanitized)) {
    valid = false;
    reason = "Invalid hash (expected MD5/SHA1/SHA256/SHA512 hex)";
  } else if (inputType === "person" && sanitized.length < 2) {
    valid = false;
    reason = "Name too short";
  }

  return {
    inputType,
    script,
    languageGuess,
    regionHints,
    sanitized,
    valid,
    reason,
    detectionConfidence,
  };
}

export function isValidEthereumAddress(addr: string): boolean {
  return ETH_RE.test(addr);
}

// Export regex patterns for reuse in source modules.
export const PATTERNS = {
  DOMAIN_RE, IPv4_RE, IPv6_RE, ETH_RE, BTC_RE, CVE_RE,
  EMAIL_RE, URL_RE, PHONE_RE, HASH_RE, USERNAME_RE,
};
