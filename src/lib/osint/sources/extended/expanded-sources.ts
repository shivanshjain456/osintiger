// Expanded OSINT API sources — Round 3: Comprehensive free OSINT coverage.
// ALL sources here are FREE and require NO API key.
// Sources organized by category for maintainability.
//
// New categories covered:
//  - Threat Intel & IOC (abuse.ch family: URLhaus, MalwareBazaar)
//  - Vulnerability Intelligence (OSV.dev, CVE.org, EPSS)
//  - Sanctions & Watchlists (Interpol Red Notices)
//  - Government & Public Spending (USASpending.gov)
//  - Network & DNS (Google DoH, ipwho.is, ipapi.co, freeipapi.com)
//  - Cryptocurrency (Blockstream, mempool.space for BTC)
//  - Archives (archive.org metadata search)
//  - Weather & Environmental (Open-Meteo)
//  - Social/Developer OSINT (GitHub, GitLab, Reddit, Wikipedia, StackExchange, Keybase)
//  - Package registries (npm, PyPI)

import type { SourceResult, NormalizedFinding } from "../../types";
import { rateLimitedFetch, buildSuccess, buildError, finding } from "./_shared";

// Pattern matchers
const CVE_RE = /^CVE-\d{4}-\d+$/i;
const SHA256_RE = /^[a-f0-9]{64}$/i;
const BTC_RE = /^(bc1[a-z0-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/;

// ============================================
// CATEGORY: Threat Intel & IOC (abuse.ch family)
// ============================================

// URLhaus (abuse.ch) — FREE, no key.
// Returns malicious URLs associated with a host (IP or domain).
export async function queryURLhaus(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "URLhaus (abuse.ch)";
  try {
    const url = "https://urlhaus-api.abuse.ch/v1/host/";
    const res = await rateLimitedFetch("urlhaus", url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `host=${encodeURIComponent(target)}`,
    }, 10000);
    if (!res.ok) return buildError("urlhaus", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data.query_status === "ok" && data.url_count > 0) {
      findings.push(finding(
        `⚠ URLhaus: ${data.url_count} malicious URLs found for host ${target} (first seen: ${data.first_seen || "?"}, last seen: ${data.last_seen || "?"})`,
        `https://urlhaus.abuse.ch/host/${target}/`,
        0.95
      ));
      const urls = Array.isArray(data.urls) ? data.urls.slice(0, 5) : [];
      for (const u of urls) {
        findings.push(finding(
          `URLhaus malicious URL: ${u.url} — threat: ${u.threat_tags || "malware"} — status: ${u.url_status}`,
          `https://urlhaus.abuse.ch/url/${u.id}/`,
          0.9
        ));
      }
    } else {
      findings.push(finding(`URLhaus: No malicious URLs found for host ${target}`, `https://urlhaus.abuse.ch/host/${target}/`, 0.7));
    }
    return buildSuccess("urlhaus", sourceLabel, target, findings, Date.now() - start, { url_count: data.url_count || 0 });
  } catch (e) {
    return buildError("urlhaus", sourceLabel, target, e instanceof Error ? e.message : "URLhaus failed", Date.now() - start);
  }
}

// MalwareBazaar (abuse.ch) — FREE, no key.
// Returns malware samples for a SHA256 hash or signature name.
export async function queryMalwareBazaar(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "MalwareBazaar (abuse.ch)";
  try {
    const url = "https://mb-api.abuse.ch/api/v1/";
    const body = SHA256_RE.test(target)
      ? `query=get_info&hash=${encodeURIComponent(target)}`
      : `query=get_siginfo&signature=${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("malwarebazaar", url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }, 10000);
    if (!res.ok) return buildError("malwarebazaar", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    const samples = Array.isArray(data.data) ? data.data : [];
    if (data.query_status === "ok" && samples.length > 0) {
      findings.push(finding(`⚠ MalwareBazaar: ${samples.length} malware samples found for "${target}"`, `https://bazaar.abuse.ch/`, 0.9));
      for (const s of samples.slice(0, 5)) {
        const tags = Array.isArray(s.tags) ? s.tags.join(", ") : "none";
        findings.push(finding(
          `MalwareBazaar sample: ${s.sha256_hash || "?"} — signature: ${s.signature || "unknown"} — tags: ${tags}`,
          `https://bazaar.abuse.ch/sample/${s.sha256_hash}/`,
          0.85
        ));
      }
    } else {
      findings.push(finding(`MalwareBazaar: No samples found for "${target}"`, "https://bazaar.abuse.ch", 0.6));
    }
    return buildSuccess("malwarebazaar", sourceLabel, target, findings, Date.now() - start, { sample_count: samples.length });
  } catch (e) {
    return buildError("malwarebazaar", sourceLabel, target, e instanceof Error ? e.message : "MalwareBazaar failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Vulnerability Intelligence
// ============================================

// OSV.dev (Google) — FREE, no key.
// Returns open-source vulnerability data for a CVE or package.
export async function queryOSV(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "OSV.dev (Google)";
  try {
    if (CVE_RE.test(target)) {
      // Query by CVE ID
      const url = `https://api.osv.dev/v1/vulns/${encodeURIComponent(target.toUpperCase())}`;
      const res = await rateLimitedFetch("osv", url, {}, 10000);
      if (!res.ok) {
        if (res.status === 404) {
          return buildSuccess("osv", sourceLabel, target, [finding(`OSV.dev: No vulnerability found for ${target}`, "https://osv.dev", 0.7)], Date.now() - start);
        }
        return buildError("osv", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
      }
      const data = await res.json();
      const findings: NormalizedFinding[] = [];
      if (data.summary) findings.push(finding(`OSV summary: ${data.summary.slice(0, 400)}`, `https://osv.dev/vulnerability/${target}`, 0.95));
      if (data.affected?.length) {
        const pkgs = new Set<string>();
        for (const a of data.affected) {
          const p = a.package?.name;
          if (p) pkgs.add(`${a.package?.ecosystem || "?"}/${p}`);
        }
        if (pkgs.size) findings.push(finding(`OSV affected packages: ${[...pkgs].slice(0, 10).join(", ")}`, `https://osv.dev/vulnerability/${target}`, 0.9));
      }
      if (data.severity?.length) {
        const sev = data.severity.map((s: Record<string, unknown>) => `${s.type || "?"}: ${s.score || "?"}`).join(", ");
        findings.push(finding(`OSV severity: ${sev}`, `https://osv.dev/vulnerability/${target}`, 0.9));
      }
      if (findings.length === 0) findings.push(finding(`OSV.dev: Vulnerability ${target} found but no details extracted`, `https://osv.dev/vulnerability/${target}`, 0.7));
      return buildSuccess("osv", sourceLabel, target, findings, Date.now() - start, data);
    }
    // Query by package name
    const url = "https://api.osv.dev/v1/query";
    const res = await rateLimitedFetch("osv", url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { name: target } }),
    }, 10000);
    if (!res.ok) return buildError("osv", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const vulns = Array.isArray(data.vulns) ? data.vulns : [];
    const findings: NormalizedFinding[] = vulns.slice(0, 5).map((v: Record<string, unknown>) =>
      finding(`OSV vulnerability for "${target}": ${v.id} — ${v.summary || "no summary"}`, `https://osv.dev/vulnerability/${v.id}`, 0.9)
    );
    if (findings.length === 0) findings.push(finding(`OSV.dev: No vulnerabilities found for package "${target}"`, "https://osv.dev", 0.6));
    return buildSuccess("osv", sourceLabel, target, findings, Date.now() - start, { vuln_count: vulns.length });
  } catch (e) {
    return buildError("osv", sourceLabel, target, e instanceof Error ? e.message : "OSV failed", Date.now() - start);
  }
}

// CVE.org (MITRE) — FREE, no key.
// Returns official CVE records via the CVE Services API.
export async function queryCVEorg(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "CVE.org (MITRE)";
  try {
    if (!CVE_RE.test(target)) {
      return buildSuccess("cveorg", sourceLabel, target, [finding(`CVE.org: Target is not a CVE ID (expected format: CVE-YYYY-NNNN)`, "https://www.cve.org", 0.3)], Date.now() - start);
    }
    const url = `https://cveawg.mitre.org/api/cve/${encodeURIComponent(target.toUpperCase())}`;
    const res = await rateLimitedFetch("cveorg", url, { headers: { Accept: "application/json" } }, 10000);
    if (!res.ok) {
      if (res.status === 404) return buildSuccess("cveorg", sourceLabel, target, [finding(`CVE.org: ${target} not found in published CVE records`, "https://www.cve.org", 0.7)], Date.now() - start);
      return buildError("cveorg", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    }
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    const cve = data?.containers?.cna || {};
    if (cve.descriptions?.length) {
      const desc = cve.descriptions.find((d: Record<string, unknown>) => d.lang === "en") || cve.descriptions[0];
      if (desc?.value) findings.push(finding(`CVE description: ${desc.value.slice(0, 500)}`, `https://www.cve.org/vuln/detail/${target.toUpperCase()}`, 0.95));
    }
    if (cve.affected?.length) {
      const products = cve.affected.slice(0, 5).map((a: Record<string, unknown>) => `${a.vendor || "?"}/${a.product || "?"} ${Array.isArray(a.versions) ? a.versions.map((v: Record<string, unknown>) => v.version || "?").join(",") : ""}`).join("; ");
      findings.push(finding(`CVE affected products: ${products}`, `https://www.cve.org/vuln/detail/${target.toUpperCase()}`, 0.9));
    }
    if (cve.metrics?.cvssMetricV31?.length) {
      const m = cve.metrics.cvssMetricV31[0];
      findings.push(finding(`CVSS v3.1: ${m.cvssData?.baseScore || "?"} (${m.cvssData?.baseSeverity || "?"})`, `https://www.cve.org/vuln/detail/${target.toUpperCase()}`, 0.9));
    }
    if (cve.references?.length) {
      findings.push(finding(`CVE references: ${cve.references.slice(0, 3).map((r: Record<string, unknown>) => r.url).join(" | ")}`, `https://www.cve.org/vuln/detail/${target.toUpperCase()}`, 0.8));
    }
    if (findings.length === 0) findings.push(finding(`CVE.org: Record found for ${target} but no structured details extracted`, `https://www.cve.org/vuln/detail/${target.toUpperCase()}`, 0.7));
    return buildSuccess("cveorg", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("cveorg", sourceLabel, target, e instanceof Error ? e.message : "CVE.org failed", Date.now() - start);
  }
}

// EPSS (FIRST.org) — FREE, no key.
// Returns Exploit Prediction Scoring System scores for CVEs.
export async function queryEPSS(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "EPSS (FIRST.org)";
  try {
    if (!CVE_RE.test(target)) {
      return buildSuccess("epss", sourceLabel, target, [finding(`EPSS: Target is not a CVE ID`, "https://www.first.org/epss", 0.3)], Date.now() - start);
    }
    const url = `https://api.first.org/data/v1/epss?cve=${encodeURIComponent(target.toUpperCase())}`;
    const res = await rateLimitedFetch("epss", url, {}, 10000);
    if (!res.ok) return buildError("epss", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const entries = Array.isArray(data.data) ? data.data : [];
    const findings: NormalizedFinding[] = entries.map((e: Record<string, unknown>) => {
      const epss = e.epss ? `${(Number(e.epss) * 100).toFixed(2)}%` : "?";
      const percentile = e.percentile ? `${(Number(e.percentile) * 100).toFixed(2)}%` : "?";
      return finding(
        `EPSS: ${e.cve} — exploit probability: ${epss}, percentile: ${percentile} (date: ${e.date || "?"})`,
        `https://www.first.org/epss/data/${e.cve}`,
        0.9
      );
    });
    if (findings.length === 0) findings.push(finding(`EPSS: No score found for ${target}`, "https://www.first.org/epss", 0.6));
    return buildSuccess("epss", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("epss", sourceLabel, target, e instanceof Error ? e.message : "EPSS failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Sanctions & Watchlists
// ============================================

// Interpol Red Notices — FREE, no key.
// Searches wanted persons by name.
export async function queryInterpol(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Interpol Red Notices";
  try {
    // Split target into forename + name (assume last token is surname)
    const parts = target.trim().split(/\s+/);
    const name = parts.length > 1 ? parts[parts.length - 1] : target;
    const forename = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";
    const params = new URLSearchParams({ name, forename, resultPerPage: "10" });
    const url = `https://ws-public.interpol.int/notices/v1/red?${params.toString()}`;
    const res = await rateLimitedFetch("interpol", url, { headers: { Accept: "application/json" } }, 12000);
    if (!res.ok) return buildError("interpol", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const notices = (data?._embedded?.notices) || [];
    const findings: NormalizedFinding[] = notices.slice(0, 5).map((n: Record<string, unknown>) => {
      const nName = Array.isArray(n.name) ? n.name.join(" ") : (n.name || "?");
      const nForename = Array.isArray(n.forename) ? n.forename.join(" ") : (n.forename || "");
      const nationalities = Array.isArray(n.nationalities) ? n.nationalities.join(", ") : "?";
      const dob = n.date_of_birth || "?";
      return finding(
        `⚠ Interpol Red Notice: ${nForename} ${nName} (DOB: ${dob}, nationalities: ${nationalities}) — subject to arrest for extradition`,
        `https://www.interpol.int/en/How-we-work/Notices/View-Red-Notices#${n.entity_id || ""}`,
        0.95
      );
    });
    if (findings.length === 0) {
      findings.push(finding(`Interpol: No Red Notices found for "${target}" (total in DB: ${data?.total || 0})`, "https://www.interpol.int/en/How-we-work/Notices/Red-Notices", 0.8));
    }
    return buildSuccess("interpol", sourceLabel, target, findings, Date.now() - start, { total: data?.total || 0, matches: notices.length });
  } catch (e) {
    return buildError("interpol", sourceLabel, target, e instanceof Error ? e.message : "Interpol failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Government & Public Spending
// ============================================

// USASpending.gov — FREE, no key.
// Returns US federal spending/awards for an organization or name.
export async function queryUSASpending(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "USASpending.gov";
  try {
    const url = "https://api.usaspending.gov/api/v2/search/spending_by_award/";
    const body = JSON.stringify({
      filters: {
        keywords: [target],
        time_period: [{ start_date: "2020-01-01", end_date: "2025-12-31" }],
        award_type_codes: ["A", "B", "C", "D"],
      },
      fields: ["Award ID", "Recipient Name", "Award Amount", "Awarding Agency", "Start Date", "End Date"],
      page: 1,
      limit: 5,
      sort: "Award Amount",
      order: "desc",
    });
    const res = await rateLimitedFetch("usaspending", url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }, 12000);
    if (!res.ok) return buildError("usaspending", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const awards = Array.isArray(data.results) ? data.results : [];
    const findings: NormalizedFinding[] = awards.slice(0, 5).map((a: Record<string, unknown>) => {
      const recipient = a["Recipient Name"] || "?";
      const amount = a["Award Amount"] != null ? `$${Number(a["Award Amount"]).toLocaleString()}` : "?";
      const agency = a["Awarding Agency"] || "?";
      return finding(
        `USASpending: Award to ${recipient} — amount: ${amount} — agency: ${agency} — period: ${a["Start Date"] || "?"} to ${a["End Date"] || "?"}`,
        `https://www.usaspending.gov/search/?hash=${encodeURIComponent(String(a["Award ID"] || ""))}`,
        0.9
      );
    });
    if (findings.length === 0) {
      findings.push(finding(`USASpending.gov: No federal awards found for "${target}"`, "https://www.usaspending.gov", 0.6));
    }
    return buildSuccess("usaspending", sourceLabel, target, findings, Date.now() - start, { award_count: awards.length });
  } catch (e) {
    return buildError("usaspending", sourceLabel, target, e instanceof Error ? e.message : "USASpending failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Network & DNS Enrichment
// ============================================

// Google DNS-over-HTTPS — FREE, no key.
// Returns DNS records (A, AAAA, MX, NS, TXT, etc.) for a domain.
export async function queryGoogleDoH(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Google DNS (DoH)";
  try {
    const recordTypes = ["A", "AAAA", "MX", "NS", "TXT", "CNAME"];
    const findings: NormalizedFinding[] = [];
    for (const type of recordTypes) {
      const url = `https://dns.google/resolve?name=${encodeURIComponent(target)}&type=${type}`;
      const res = await rateLimitedFetch("dns_google", url, {}, 6000);
      if (!res.ok) continue;
      const data = await res.json();
      const answers = Array.isArray(data.Answer) ? data.Answer : [];
      for (const a of answers) {
        findings.push(finding(`DNS ${type} record for ${target}: ${a.data} (TTL: ${a.TTL || "?"}s)`, `https://dns.google/query?name=${encodeURIComponent(target)}&type=${type}`, 0.9));
      }
    }
    if (findings.length === 0) findings.push(finding(`Google DoH: No DNS records found for ${target}`, "https://dns.google", 0.5));
    return buildSuccess("dns_google", sourceLabel, target, findings, Date.now() - start, { record_count: findings.length });
  } catch (e) {
    return buildError("dns_google", sourceLabel, target, e instanceof Error ? e.message : "Google DoH failed", Date.now() - start);
  }
}

// ipwho.is — FREE, no key.
// Returns IP geolocation, ASN, and connection info.
export async function queryIpWhoIs(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "ipwho.is";
  try {
    const url = `https://ipwho.is/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("ipwhois", url, {}, 10000);
    if (!res.ok) return buildError("ipwhois", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    if (data.success === false) {
      return buildError("ipwhois", sourceLabel, target, data.message || "Lookup failed", Date.now() - start);
    }
    const findings: NormalizedFinding[] = [];
    if (data.ip) findings.push(finding(`ipwho.is: ${data.ip} — ${data.connection?.isp || data.connection?.org || "?"} (${data.connection?.domain || "?"})`, `https://ipwho.is/${target}`, 0.9));
    if (data.country) findings.push(finding(`Location: ${data.city || "?"}, ${data.region || "?"}, ${data.country} (${data.country_code || "?"})`, `https://ipwho.is/${target}`, 0.85));
    if (data.latitude && data.longitude) findings.push(finding(`Coordinates: ${data.latitude}, ${data.longitude} (timezone: ${data.timezone?.id || "?"})`, `https://ipwho.is/${target}`, 0.85));
    if (data.connection?.asn) findings.push(finding(`ASN: AS${data.connection.asn} — ${data.connection.org || "?"}`, `https://ipwho.is/${target}`, 0.85));
    return buildSuccess("ipwhois", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("ipwhois", sourceLabel, target, e instanceof Error ? e.message : "ipwho.is failed", Date.now() - start);
  }
}

// ipapi.co — FREE, no key (rate limited: ~1000/day).
// Returns IP geolocation and network info.
export async function queryIpApiCo(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "ipapi.co";
  try {
    const url = `https://ipapi.co/${encodeURIComponent(target)}/json/`;
    const res = await rateLimitedFetch("ipapico", url, {}, 10000);
    if (!res.ok) return buildError("ipapico", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    if (data.error) return buildError("ipapico", sourceLabel, target, data.reason || "Lookup failed", Date.now() - start);
    const findings: NormalizedFinding[] = [];
    if (data.ip) findings.push(finding(`ipapi.co: ${data.ip} — ${data.org || data.asn || "?"}`, `https://ipapi.co/${target}/`, 0.9));
    if (data.city) findings.push(finding(`Location: ${data.city}, ${data.region}, ${data.country_name} (${data.country})`, `https://ipapi.co/${target}/`, 0.85));
    if (data.latitude && data.longitude) findings.push(finding(`Coordinates: ${data.latitude}, ${data.longitude} — timezone: ${data.timezone}`, `https://ipapi.co/${target}/`, 0.85));
    if (data.asn) findings.push(finding(`ASN: AS${data.asn} — org: ${data.org || "?"}`, `https://ipapi.co/${target}/`, 0.85));
    return buildSuccess("ipapico", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("ipapico", sourceLabel, target, e instanceof Error ? e.message : "ipapi.co failed", Date.now() - start);
  }
}

// freeipapi.com — FREE, no key.
// Returns IP geolocation data.
export async function queryFreeIpApi(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "freeipapi.com";
  try {
    const url = `https://freeipapi.com/api/json/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("freeipapi", url, {}, 10000);
    if (!res.ok) return buildError("freeipapi", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data.ipAddress) findings.push(finding(`freeipapi: ${data.ipAddress} — ${data.isp || "?"}`, `https://freeipapi.com/ip/${target}`, 0.85));
    if (data.cityName) findings.push(finding(`Location: ${data.cityName}, ${data.regionName}, ${data.countryName} (${data.countryCode})`, `https://freeipapi.com/ip/${target}`, 0.85));
    if (data.latitude && data.longitude) findings.push(finding(`Coordinates: ${data.latitude}, ${data.longitude}`, `https://freeipapi.com/ip/${target}`, 0.85));
    if (data.asn) findings.push(finding(`ASN: ${data.asn} — ${data.isp || "?"}`, `https://freeipapi.com/ip/${target}`, 0.8));
    if (findings.length === 0) findings.push(finding(`freeipapi: No data for ${target}`, `https://freeipapi.com`, 0.4));
    return buildSuccess("freeipapi", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("freeipapi", sourceLabel, target, e instanceof Error ? e.message : "freeipapi failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Cryptocurrency (Bitcoin)
// ============================================

// Blockstream.info — FREE, no key.
// Returns BTC address info (balance, tx count).
export async function queryBlockstream(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Blockstream.info";
  try {
    if (!BTC_RE.test(target)) {
      return buildSuccess("blockstream", sourceLabel, target, [finding(`Blockstream: Target is not a Bitcoin address`, "https://blockstream.info", 0.3)], Date.now() - start);
    }
    const url = `https://blockstream.info/api/address/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("blockstream", url, {}, 10000);
    if (!res.ok) return buildError("blockstream", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    const funded = data.chain_stats?.funded_txo_sum ? data.chain_stats.funded_txo_sum / 1e8 : 0;
    const spent = data.chain_stats?.spent_txo_sum ? data.chain_stats.spent_txo_sum / 1e8 : 0;
    const balance = funded - spent;
    const txCount = data.chain_stats?.tx_count || 0;
    findings.push(finding(`Blockstream BTC address ${target}: balance ${balance.toFixed(8)} BTC, ${txCount} transactions (received: ${funded.toFixed(8)} BTC, spent: ${spent.toFixed(8)} BTC)`, `https://blockstream.info/address/${target}`, 0.95));
    if (data.mempool_stats?.tx_count) {
      findings.push(finding(`Blockstream: ${data.mempool_stats.tx_count} unconfirmed transactions in mempool`, `https://blockstream.info/address/${target}`, 0.8));
    }
    return buildSuccess("blockstream", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("blockstream", sourceLabel, target, e instanceof Error ? e.message : "Blockstream failed", Date.now() - start);
  }
}

// mempool.space — FREE, no key.
// Returns BTC address info from the mempool.space explorer.
export async function queryMempool(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "mempool.space";
  try {
    if (!BTC_RE.test(target)) {
      return buildSuccess("mempool", sourceLabel, target, [finding(`mempool.space: Target is not a Bitcoin address`, "https://mempool.space", 0.3)], Date.now() - start);
    }
    const url = `https://mempool.space/api/address/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("mempool", url, {}, 10000);
    if (!res.ok) return buildError("mempool", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    const funded = data.chain_stats?.funded_txo_sum ? data.chain_stats.funded_txo_sum / 1e8 : 0;
    const spent = data.chain_stats?.spent_txo_sum ? data.chain_stats.spent_txo_sum / 1e8 : 0;
    const balance = funded - spent;
    const txCount = data.chain_stats?.tx_count || 0;
    findings.push(finding(`mempool.space BTC address ${target}: balance ${balance.toFixed(8)} BTC, ${txCount} confirmed transactions`, `https://mempool.space/address/${target}`, 0.95));
    // Fetch recent transactions
    const txUrl = `https://mempool.space/api/address/${encodeURIComponent(target)}/txs`;
    const txRes = await rateLimitedFetch("mempool_txs", txUrl, {}, 8000);
    if (txRes.ok) {
      const txs = await txRes.json();
      const txList = Array.isArray(txs) ? txs.slice(0, 3) : [];
      for (const tx of txList) {
        const val = tx.vout?.reduce((s: number, o: Record<string, unknown>) => s + Number(o.value || 0), 0) / 1e8 || 0;
        findings.push(finding(`mempool.space tx: ${tx.txid?.slice(0, 16)}... value ${val.toFixed(8)} BTC, ${tx.status?.confirmed ? "confirmed" : "unconfirmed"} (${tx.status?.block_height || "mempool"})`, `https://mempool.space/tx/${tx.txid}`, 0.85));
      }
    }
    return buildSuccess("mempool", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("mempool", sourceLabel, target, e instanceof Error ? e.message : "mempool.space failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Archives
// ============================================

// Internet Archive Search — FREE, no key.
// Returns archived items matching the query.
export async function queryArchiveOrg(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Archive.org Search";
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(target)}&fl[]=identifier,title,creator,date,description,mediatype&output=json&rows=5`;
    const res = await rateLimitedFetch("archiveorg", url, {}, 12000);
    if (!res.ok) return buildError("archiveorg", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const docs = data?.response?.docs || [];
    const findings: NormalizedFinding[] = docs.slice(0, 5).map((d: Record<string, unknown>) => {
      const creator = Array.isArray(d.creator) ? d.creator.join(", ") : (d.creator || "unknown");
      return finding(
        `Archive.org: "${d.title || "?"}" by ${creator} (${d.date || "?"}, type: ${d.mediatype || "?"})`,
        `https://archive.org/details/${d.identifier}`,
        0.85
      );
    });
    if (findings.length === 0) findings.push(finding(`Archive.org: No items found for "${target}"`, "https://archive.org", 0.5));
    return buildSuccess("archiveorg", sourceLabel, target, findings, Date.now() - start, { total: data?.response?.numFound || 0 });
  } catch (e) {
    return buildError("archiveorg", sourceLabel, target, e instanceof Error ? e.message : "Archive.org failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Weather & Environmental
// ============================================

// Open-Meteo — FREE, no key.
// Returns current weather for a location (lat/lon derived from target if possible).
export async function queryOpenMeteo(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Open-Meteo";
  try {
    // Try geocoding the target first
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(target)}&count=1&language=en&format=json`;
    const geoRes = await rateLimitedFetch("openmeteo_geo", geoUrl, {}, 8000);
    if (!geoRes.ok) return buildError("openmeteo", sourceLabel, target, `Geocode HTTP ${geoRes.status}`, Date.now() - start);
    const geoData = await geoRes.json();
    const place = geoData?.results?.[0];
    if (!place) {
      return buildSuccess("openmeteo", sourceLabel, target, [finding(`Open-Meteo: Could not geocode "${target}"`, "https://open-meteo.com", 0.4)], Date.now() - start);
    }
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;
    const res = await rateLimitedFetch("openmeteo", weatherUrl, {}, 8000);
    if (!res.ok) return buildError("openmeteo", sourceLabel, target, `Weather HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const c = data?.current;
    const findings: NormalizedFinding[] = [];
    findings.push(finding(
      `Open-Meteo weather at ${place.name}, ${place.country}: ${c?.temperature_2m ?? "?"}°C (feels like ${c?.apparent_temperature ?? "?"}°C), humidity ${c?.relative_humidity_2m ?? "?"}%, wind ${c?.wind_speed_10m ?? "?"} km/h from ${c?.wind_direction_10m ?? "?"}°`,
      `https://open-meteo.com/en/docs`,
      0.85
    ));
    if (place.timezone) findings.push(finding(`Open-Meteo: timezone ${place.timezone}, elevation ${place.elevation ?? "?"}m, population ${place.population ?? "?"}`, `https://open-meteo.com`, 0.7));
    return buildSuccess("openmeteo", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("openmeteo", sourceLabel, target, e instanceof Error ? e.message : "Open-Meteo failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Developer / Social OSINT
// ============================================

// GitHub API — FREE, no key (60 req/hr per IP).
// Returns user profile if target matches a GitHub username, or searches users by name.
export async function queryGitHub(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "GitHub";
  try {
    // Try direct user lookup first
    const userUrl = `https://api.github.com/users/${encodeURIComponent(target)}`;
    const userRes = await rateLimitedFetch("github", userUrl, { headers: { Accept: "application/vnd.github+json" } }, 8000);
    if (userRes.ok) {
      const data = await userRes.json();
      const findings: NormalizedFinding[] = [];
      if (data.login) findings.push(finding(`GitHub user: ${data.login} (${data.name || "no name"}) — ${data.bio || "no bio"} — ${data.public_repos} repos, ${data.followers} followers`, data.html_url, 0.9));
      if (data.company) findings.push(finding(`GitHub company: ${data.company}`, data.html_url, 0.85));
      if (data.location) findings.push(finding(`GitHub location: ${data.location}`, data.html_url, 0.85));
      if (data.blog) findings.push(finding(`GitHub blog: ${data.blog}`, data.html_url, 0.8));
      if (data.created_at) findings.push(finding(`GitHub account created: ${data.created_at} (last updated: ${data.updated_at || "?"})`, data.html_url, 0.8));
      if (findings.length > 0) return buildSuccess("github", sourceLabel, target, findings, Date.now() - start, data);
    }
    // Fall back to search
    const searchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(target)}&per_page=5`;
    const searchRes = await rateLimitedFetch("github_search", searchUrl, { headers: { Accept: "application/vnd.github+json" } }, 8000);
    if (!searchRes.ok) return buildError("github", sourceLabel, target, `HTTP ${searchRes.status}`, Date.now() - start);
    const searchData = await searchRes.json();
    const users = Array.isArray(searchData.items) ? searchData.items : [];
    const findings: NormalizedFinding[] = users.slice(0, 5).map((u: Record<string, unknown>) =>
      finding(`GitHub user match: ${u.login} (id: ${u.id}, type: ${u.type || "?"})`, String(u.html_url || "https://github.com"), 0.8)
    );
    if (findings.length === 0) findings.push(finding(`GitHub: No users found for "${target}"`, "https://github.com", 0.5));
    return buildSuccess("github", sourceLabel, target, findings, Date.now() - start, { total: searchData.total_count || 0 });
  } catch (e) {
    return buildError("github", sourceLabel, target, e instanceof Error ? e.message : "GitHub failed", Date.now() - start);
  }
}

// GitLab API — FREE, no key.
// Returns user profile if target matches a GitLab username, or searches users by name.
export async function queryGitLab(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "GitLab";
  try {
    const url = `https://gitlab.com/api/v4/users?username=${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("gitlab", url, {}, 8000);
    if (!res.ok) return buildError("gitlab", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const users = Array.isArray(data) ? data : [];
    const findings: NormalizedFinding[] = users.slice(0, 5).map((u: Record<string, unknown>) => {
      const detail: string[] = [];
      if (u.name) detail.push(`name: ${u.name}`);
      if (u.bio) detail.push(`bio: ${u.bio}`);
      if (u.location) detail.push(`location: ${u.location}`);
      if (u.organization) detail.push(`org: ${u.organization}`);
      if (u.web_url) detail.push(`url: ${u.web_url}`);
      return finding(`GitLab user: ${u.username} — ${detail.join(" | ") || "no details"}`, String(u.web_url || `https://gitlab.com/${u.username}`), 0.85);
    });
    if (findings.length === 0) {
      // Try search
      const sUrl = `https://gitlab.com/api/v4/search?scope=users&search=${encodeURIComponent(target)}`;
      const sRes = await rateLimitedFetch("gitlab_search", sUrl, {}, 8000);
      if (sRes.ok) {
        const sData = await sRes.json();
        const sUsers = Array.isArray(sData) ? sData : [];
        for (const u of sUsers.slice(0, 5)) {
          findings.push(finding(`GitLab user search match: ${u.username} (${u.name || "no name"})`, u.web_url || "https://gitlab.com", 0.75));
        }
      }
    }
    if (findings.length === 0) findings.push(finding(`GitLab: No users found for "${target}"`, "https://gitlab.com", 0.5));
    return buildSuccess("gitlab", sourceLabel, target, findings, Date.now() - start, { count: users.length });
  } catch (e) {
    return buildError("gitlab", sourceLabel, target, e instanceof Error ? e.message : "GitLab failed", Date.now() - start);
  }
}

// Reddit JSON API — FREE, no key.
// Returns user profile (about.json) or subreddit posts.
export async function queryReddit(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Reddit";
  try {
    // Try user about
    const userUrl = `https://www.reddit.com/user/${encodeURIComponent(target)}/about.json`;
    const res = await rateLimitedFetch("reddit", userUrl, { headers: { "User-Agent": "OSINTiger/1.0" } }, 8000);
    if (!res.ok) return buildError("reddit", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const user = data?.data;
    const findings: NormalizedFinding[] = [];
    if (user?.name) {
      findings.push(finding(`Reddit user: u/${user.name} — karma: ${user.total_karma || 0} (comment: ${user.comment_karma || 0}, link: ${user.link_karma || 0})`, `https://www.reddit.com/user/${user.name}`, 0.9));
      if (user.created_utc) {
        const created = new Date(user.created_utc * 1000).toISOString().slice(0, 10);
        findings.push(finding(`Reddit account created: ${created} — verified: ${user.verified ? "yes" : "no"}`, `https://www.reddit.com/user/${user.name}`, 0.85));
      }
      if (user.subreddit?.title) findings.push(finding(`Reddit profile title: ${user.subreddit.title} — public description: ${user.subreddit.public_description?.slice(0, 200) || "none"}`, `https://www.reddit.com/user/${user.name}`, 0.8));
      if (user.is_employee || user.is_mod) findings.push(finding(`Reddit: employee=${user.is_employee ? "yes" : "no"}, moderator=${user.is_mod ? "yes" : "no"}`, `https://www.reddit.com/user/${user.name}`, 0.85));
    }
    if (findings.length === 0) {
      // Try as subreddit
      const subUrl = `https://www.reddit.com/r/${encodeURIComponent(target)}/about.json`;
      const subRes = await rateLimitedFetch("reddit_sub", subUrl, { headers: { "User-Agent": "OSINTiger/1.0" } }, 8000);
      if (subRes.ok) {
        const subData = await subRes.json();
        const sub = subData?.data;
        if (sub?.display_name) {
          findings.push(finding(`Reddit subreddit: r/${sub.display_name} — ${sub.subscribers || 0} subscribers — ${sub.active_user_count || 0} active`, `https://www.reddit.com/r/${sub.display_name}`, 0.85));
          if (sub.public_description) findings.push(finding(`Reddit r/${sub.display_name} description: ${sub.public_description.slice(0, 300)}`, `https://www.reddit.com/r/${sub.display_name}`, 0.8));
        }
      }
    }
    if (findings.length === 0) findings.push(finding(`Reddit: No user or subreddit found for "${target}"`, "https://www.reddit.com", 0.5));
    return buildSuccess("reddit", sourceLabel, target, findings, Date.now() - start, { found: findings.length > 0 });
  } catch (e) {
    return buildError("reddit", sourceLabel, target, e instanceof Error ? e.message : "Reddit failed", Date.now() - start);
  }
}

// Wikipedia API — FREE, no key.
// Searches Wikipedia articles matching the target.
export async function queryWikipedia(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Wikipedia";
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(target)}&format=json&srlimit=5&srprop=snippet`;
    const res = await rateLimitedFetch("wikipedia", url, { headers: { Accept: "application/json" } }, 10000);
    if (!res.ok) return buildError("wikipedia", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const hits = data?.query?.search || [];
    const findings: NormalizedFinding[] = hits.map((h: Record<string, unknown>) => {
      const snippet = String(h.snippet || "").replace(/<[^>]+>/g, "");
      return finding(
        `Wikipedia: "${h.title}" — ${snippet.slice(0, 200)}`,
        `https://en.wikipedia.org/wiki/${encodeURIComponent(String(h.title).replace(/ /g, "_"))}`,
        0.85
      );
    });
    if (findings.length === 0) findings.push(finding(`Wikipedia: No articles found for "${target}"`, "https://en.wikipedia.org", 0.5));
    return buildSuccess("wikipedia", sourceLabel, target, findings, Date.now() - start, { total_hits: data?.query?.searchinfo?.totalhits || 0 });
  } catch (e) {
    return buildError("wikipedia", sourceLabel, target, e instanceof Error ? e.message : "Wikipedia failed", Date.now() - start);
  }
}

// Stack Exchange API — FREE, no key.
// Searches Stack Overflow users by name.
export async function queryStackExchange(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Stack Exchange";
  try {
    const url = `https://api.stackexchange.com/2.3/users?inname=${encodeURIComponent(target)}&site=stackoverflow&pagesize=5&filter=default`;
    const res = await rateLimitedFetch("stackexchange", url, {}, 10000);
    if (!res.ok) return buildError("stackexchange", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const users = Array.isArray(data.items) ? data.items : [];
    const findings: NormalizedFinding[] = users.slice(0, 5).map((u: Record<string, unknown>) => {
      const detail: string[] = [];
      detail.push(`reputation: ${u.reputation || 0}`);
      if (u.location) detail.push(`location: ${u.location}`);
      if (u.website_url) detail.push(`website: ${u.website_url}`);
      if (u.creation_date) detail.push(`joined: ${new Date(Number(u.creation_date) * 1000).toISOString().slice(0, 10)}`);
      return finding(`Stack Overflow user: ${u.display_name} — ${detail.join(", ")}`, String(u.link || "https://stackoverflow.com"), 0.85);
    });
    if (findings.length === 0) findings.push(finding(`Stack Exchange: No users found for "${target}"`, "https://stackoverflow.com", 0.5));
    return buildSuccess("stackexchange", sourceLabel, target, findings, Date.now() - start, { count: users.length });
  } catch (e) {
    return buildError("stackexchange", sourceLabel, target, e instanceof Error ? e.message : "Stack Exchange failed", Date.now() - start);
  }
}

// npm registry — FREE, no key.
// Returns npm package metadata.
export async function queryNpm(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "npm registry";
  try {
    const url = `https://registry.npmjs.org/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("npm", url, {}, 10000);
    if (!res.ok) {
      if (res.status === 404) return buildSuccess("npm", sourceLabel, target, [finding(`npm: Package "${target}" not found`, "https://www.npmjs.com", 0.6)], Date.now() - start);
      return buildError("npm", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    }
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data.name) {
      const latest = data["dist-tags"]?.latest;
      const latestVersion = data.versions?.[latest] || {};
      findings.push(finding(`npm package: ${data.name}@${latest} — ${latestVersion.description || "no description"}`, `https://www.npmjs.com/package/${data.name}`, 0.9));
      if (data.author) findings.push(finding(`npm author: ${typeof data.author === "string" ? data.author : data.author?.name || "?"}`, `https://www.npmjs.com/package/${data.name}`, 0.85));
      if (data.license) findings.push(finding(`npm license: ${data.license}`, `https://www.npmjs.com/package/${data.name}`, 0.8));
      if (data.time?.created) findings.push(finding(`npm created: ${data.time.created} — modified: ${data.time.modified || "?"}`, `https://www.npmjs.com/package/${data.name}`, 0.8));
      if (latestVersion.repository?.url) findings.push(finding(`npm repository: ${latestVersion.repository.url}`, `https://www.npmjs.com/package/${data.name}`, 0.8));
      if (latestVersion.maintainers?.length) {
        const maintainers = latestVersion.maintainers.map((m: Record<string, unknown>) => m.name).join(", ");
        findings.push(finding(`npm maintainers: ${maintainers}`, `https://www.npmjs.com/package/${data.name}`, 0.8));
      }
    }
    if (findings.length === 0) findings.push(finding(`npm: No metadata for "${target}"`, "https://www.npmjs.com", 0.4));
    return buildSuccess("npm", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("npm", sourceLabel, target, e instanceof Error ? e.message : "npm failed", Date.now() - start);
  }
}

// PyPI JSON API — FREE, no key.
// Returns Python package metadata.
export async function queryPyPI(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "PyPI";
  try {
    const url = `https://pypi.org/pypi/${encodeURIComponent(target)}/json`;
    const res = await rateLimitedFetch("pypi", url, {}, 10000);
    if (!res.ok) {
      if (res.status === 404) return buildSuccess("pypi", sourceLabel, target, [finding(`PyPI: Package "${target}" not found`, "https://pypi.org", 0.6)], Date.now() - start);
      return buildError("pypi", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    }
    const data = await res.json();
    const info = data?.info || {};
    const findings: NormalizedFinding[] = [];
    if (info.name) {
      findings.push(finding(`PyPI package: ${info.name}@${info.version} — ${info.summary || "no summary"}`, `https://pypi.org/project/${info.name}/`, 0.9));
      if (info.author) findings.push(finding(`PyPI author: ${info.author}${info.author_email ? ` <${info.author_email}>` : ""}`, `https://pypi.org/project/${info.name}/`, 0.85));
      if (info.home_page || info.project_url) findings.push(finding(`PyPI homepage: ${info.home_page || info.project_url}`, `https://pypi.org/project/${info.name}/`, 0.8));
      if (info.license) findings.push(finding(`PyPI license: ${info.license}`, `https://pypi.org/project/${info.name}/`, 0.8));
      if (info.classifiers?.length) {
        const relevant = info.classifiers.filter((c: string) => c.startsWith("Development Status") || c.startsWith("License") || c.startsWith("Programming Language :: Python")).slice(0, 5);
        if (relevant.length) findings.push(finding(`PyPI classifiers: ${relevant.join(" | ")}`, `https://pypi.org/project/${info.name}/`, 0.75));
      }
      if (info.requires_dist?.length) {
        findings.push(finding(`PyPI dependencies (${info.requires_dist.length}): ${info.requires_dist.slice(0, 5).join(", ")}`, `https://pypi.org/project/${info.name}/`, 0.75));
      }
    }
    if (findings.length === 0) findings.push(finding(`PyPI: No metadata for "${target}"`, "https://pypi.org", 0.4));
    return buildSuccess("pypi", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("pypi", sourceLabel, target, e instanceof Error ? e.message : "PyPI failed", Date.now() - start);
  }
}
