// Extended OSINT API sources — ALL FREE, no API key required.
// Each function returns a SourceResult in the standard normalized format.
// Sources are organized by category.

import type { SourceResult, NormalizedFinding } from "../../types";
import { nowISO } from "../_helpers";
import { rateLimitedFetch, buildSuccess, buildError, finding } from "./_shared";

// ============================================
// CATEGORY: Archives
// ============================================

// Wayback Machine — FREE, no key required.
// Returns archived snapshots of a URL from the Internet Archive.
export async function queryWayback(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Wayback Machine";
  try {
    const url = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(target)}&output=json&limit=10&fl=timestamp,original,statuscode`;
    const res = await rateLimitedFetch("wayback", url, {}, 12000);
    if (!res.ok) return buildError("wayback", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const rows = Array.isArray(data) ? data.slice(1) : []; // skip header row
    const findings: NormalizedFinding[] = rows.slice(0, 10).map((row: string[]) =>
      finding(
        `Wayback Machine archive snapshot: ${row[1] || target} captured ${row[0]} (status ${row[2]})`,
        `https://web.archive.org/web/${row[0]}/${row[1]}`,
        0.85
      )
    );
    if (findings.length === 0) {
      findings.push(finding(`No Wayback Machine snapshots found for ${target}`, "https://web.archive.org", 0.5));
    }
    return buildSuccess("wayback", sourceLabel, target, findings, Date.now() - start, { snapshots: rows.length });
  } catch (e) {
    return buildError("wayback", sourceLabel, target, e instanceof Error ? e.message : "Wayback query failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Domain/DNS/IP Lookup
// ============================================

// BGPView — FREE, no key required.
// Returns BGP/ASN data for IPs and ASNs.
export async function queryBGPView(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "BGPView";
  try {
    // Try as IP — query ASN info
    const url = `https://api.bgpview.io/ip/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("bgpview", url, {}, 10000);
    if (!res.ok) return buildError("bgpview", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data?.data?.prefixes) {
      for (const p of data.data.prefixes.slice(0, 5)) {
        findings.push(finding(
          `BGP prefix ${p.prefix} (ASN ${p.asn?.asn || "?"}, ${p.asn?.name || "unknown"})`,
          `https://bgpview.io/ip/${encodeURIComponent(target)}`,
          0.85
        ));
      }
    }
    if (data?.data?.rirAllocation) {
      findings.push(finding(
        `RIR allocation: ${data.data.rirAllocation.rirName || "?"}, country ${data.data.rirAllocation.country || "?"}`,
        `https://bgpview.io/ip/${encodeURIComponent(target)}`,
        0.8
      ));
    }
    if (findings.length === 0) {
      findings.push(finding(`No BGP data found for ${target}`, "https://bgpview.io", 0.4));
    }
    return buildSuccess("bgpview", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("bgpview", sourceLabel, target, e instanceof Error ? e.message : "BGPView query failed", Date.now() - start);
  }
}

// Cloudflare Trace — FREE, no key required.
// Returns Cloudflare CDN trace info for a domain.
export async function queryCloudflareTrace(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Cloudflare Trace";
  try {
    const url = `https://1.1.1.1/cdn-cgi/trace`;
    const res = await rateLimitedFetch("cloudflare_trace", url, {}, 8000);
    if (!res.ok) return buildError("cloudflare_trace", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const text = await res.text();
    const lines = text.split("\n").filter(Boolean);
    const findings: NormalizedFinding[] = [];
    for (const line of lines.slice(0, 10)) {
      const [key, val] = line.split("=");
      if (key && val) {
        findings.push(finding(`Cloudflare trace: ${key} = ${val}`, "https://1.1.1.1/cdn-cgi/trace", 0.7));
      }
    }
    return buildSuccess("cloudflare_trace", sourceLabel, target, findings, Date.now() - start, text);
  } catch (e) {
    return buildError("cloudflare_trace", sourceLabel, target, e instanceof Error ? e.message : "Cloudflare trace failed", Date.now() - start);
  }
}

// DomainsDB — FREE, no key required.
// Returns domain registration data.
export async function queryDomainsDB(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "DomainsDB";
  try {
    const url = `https://api.domainsdb.info/v1/domains/search?domain=${encodeURIComponent(target)}&limit=10`;
    const res = await rateLimitedFetch("domainsdb", url, {}, 10000);
    if (!res.ok) return buildError("domainsdb", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const domains = data?.domains || [];
    const findings: NormalizedFinding[] = domains.slice(0, 10).map((d: Record<string, unknown>) =>
      finding(
        `Domain registration: ${d.domain} (created ${d.create_date || "?"}, registrar ${d.registrar || "?"})`,
        `https://domainsdb.info/domains/${d.domain}`,
        0.8
      )
    );
    if (findings.length === 0) {
      findings.push(finding(`No domain registrations found matching ${target}`, "https://domainsdb.info", 0.5));
    }
    return buildSuccess("domainsdb", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("domainsdb", sourceLabel, target, e instanceof Error ? e.message : "DomainsDB query failed", Date.now() - start);
  }
}

// DNS over HTTPS (Cloudflare) — FREE, no key.
// Returns DNS records for a domain.
export async function queryDoH(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "DNS over HTTPS";
  try {
    const recordTypes = ["A", "AAAA", "MX", "TXT", "NS"];
    const findings: NormalizedFinding[] = [];
    for (const type of recordTypes) {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(target)}&type=${type}`;
      const res = await rateLimitedFetch("doh", url, { headers: { accept: "application/dns-json" } }, 8000);
      if (res.ok) {
        const data = await res.json();
        const answers = data?.Answer || [];
        for (const a of answers) {
          findings.push(finding(
            `DNS ${type} record: ${a.name} → ${a.data} (TTL ${a.TTL})`,
            `https://1.1.1.1/dns-query?name=${encodeURIComponent(target)}&type=${type}`,
            0.92
          ));
        }
      }
    }
    if (findings.length === 0) {
      findings.push(finding(`No DNS records found for ${target}`, "https://1.1.1.1", 0.5));
    }
    return buildSuccess("doh", sourceLabel, target, findings, Date.now() - start);
  } catch (e) {
    return buildError("doh", sourceLabel, target, e instanceof Error ? e.message : "DoH query failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: GEO IP
// ============================================

// IPQuery.io — FREE, no key required.
// Returns IP geolocation + threat data.
export async function queryIPQuery(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "IPQuery.io";
  try {
    const url = `https://api.ipquery.io/${encodeURIComponent(target)}?format=json`;
    const res = await rateLimitedFetch("ipquery", url, {}, 10000);
    if (!res.ok) return buildError("ipquery", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data?.location) {
      findings.push(finding(
        `IP geolocation: ${data.location.city || "?"}, ${data.location.region || "?"}, ${data.location.country || "?"}`,
        `https://ipquery.io/ip/${encodeURIComponent(target)}`,
        0.85
      ));
    }
    if (data?.isp) {
      findings.push(finding(`ISP: ${data.isp}`, `https://ipquery.io/ip/${encodeURIComponent(target)}`, 0.8));
    }
    if (data?.asn) {
      findings.push(finding(`ASN: ${data.asn} (${data.asn_org || data.asn_name || "?"})`, `https://ipquery.io/ip/${encodeURIComponent(target)}`, 0.8));
    }
    if (data?.risk_score != null) {
      findings.push(finding(`Risk score: ${data.risk_score}`, `https://ipquery.io/ip/${encodeURIComponent(target)}`, 0.75));
    }
    if (findings.length === 0) {
      findings.push(finding(`No IP data found for ${target}`, "https://ipquery.io", 0.4));
    }
    return buildSuccess("ipquery", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("ipquery", sourceLabel, target, e instanceof Error ? e.message : "IPQuery failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Names/Surnames
// ============================================

// Genderize.io — FREE, 1000 names/day, no key required (optional key).
// Predicts gender from a first name.
export async function queryGenderize(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Genderize.io";
  try {
    const firstName = target.split(" ")[0];
    const url = `https://api.genderize.io?name=${encodeURIComponent(firstName)}`;
    const res = await rateLimitedFetch("genderize", url, {}, 8000);
    if (!res.ok) return buildError("genderize", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data?.gender) {
      findings.push(finding(
        `Gender prediction: ${data.gender} (probability ${Math.round((data.probability || 0) * 100)}%, based on ${data.count || 0} samples)`,
        `https://genderize.io`,
        data.probability || 0.6
      ));
    } else {
      findings.push(finding(`No gender prediction for "${firstName}"`, "https://genderize.io", 0.4));
    }
    return buildSuccess("genderize", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("genderize", sourceLabel, target, e instanceof Error ? e.message : "Genderize failed", Date.now() - start);
  }
}

// Agify.io — FREE, 1000 names/day, no key required.
// Predicts age from a first name.
export async function queryAgify(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Agify.io";
  try {
    const firstName = target.split(" ")[0];
    const url = `https://api.agify.io?name=${encodeURIComponent(firstName)}`;
    const res = await rateLimitedFetch("agify", url, {}, 8000);
    if (!res.ok) return buildError("agify", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data?.age) {
      findings.push(finding(
        `Age prediction: ${data.age} years (based on ${data.count || 0} samples)`,
        `https://agify.io`,
        0.6
      ));
    } else {
      findings.push(finding(`No age prediction for "${firstName}"`, "https://agify.io", 0.4));
    }
    return buildSuccess("agify", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("agify", sourceLabel, target, e instanceof Error ? e.message : "Agify failed", Date.now() - start);
  }
}

// Nationalize.io — FREE, 1000 names/day, no key required.
// Predicts nationality from a first name.
export async function queryNationalize(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Nationalize.io";
  try {
    const firstName = target.split(" ")[0];
    const url = `https://api.nationalize.io?name=${encodeURIComponent(firstName)}`;
    const res = await rateLimitedFetch("nationalize", url, {}, 8000);
    if (!res.ok) return buildError("nationalize", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    const countries = data?.country || [];
    for (const c of countries.slice(0, 3)) {
      findings.push(finding(
        `Nationality prediction: ${c.country_id} (probability ${Math.round((c.probability || 0) * 100)}%)`,
        `https://nationalize.io`,
        c.probability || 0.5
      ));
    }
    if (findings.length === 0) {
      findings.push(finding(`No nationality prediction for "${firstName}"`, "https://nationalize.io", 0.4));
    }
    return buildSuccess("nationalize", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("nationalize", sourceLabel, target, e instanceof Error ? e.message : "Nationalize failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Social Media
// ============================================

// HackerNews API — FREE, no key required.
// Searches Hacker News stories for a target.
export async function queryHackerNews(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "HackerNews";
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(target)}&tags=story&hitsPerPage=10`;
    const res = await rateLimitedFetch("hackernews", url, {}, 10000);
    if (!res.ok) return buildError("hackernews", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const hits = data?.hits || [];
    const findings: NormalizedFinding[] = hits.slice(0, 10).map((h: Record<string, unknown>) =>
      finding(
        `HackerNews story: ${h.title || h.story_title || "?"} (${h.points || 0} points, ${h.num_comments || 0} comments)`,
        (h.url as string) || `https://news.ycombinator.com/item?id=${h.objectID as string}`,
        0.7
      )
    );
    if (findings.length === 0) {
      findings.push(finding(`No HackerNews stories found for ${target}`, "https://news.ycombinator.com", 0.4));
    }
    return buildSuccess("hackernews", sourceLabel, target, findings, Date.now() - start, { hits: hits.length });
  } catch (e) {
    return buildError("hackernews", sourceLabel, target, e instanceof Error ? e.message : "HackerNews query failed", Date.now() - start);
  }
}

// DuckDuckGo Instant Answers — FREE, no key required.
// Returns instant answer summaries from DuckDuckGo.
export async function queryDuckDuckGo(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "DuckDuckGo";
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(target)}&format=json&no_html=1&skip_disambig=1`;
    const res = await rateLimitedFetch("duckduckgo", url, {}, 10000);
    if (!res.ok) return buildError("duckduckgo", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data?.AbstractText) {
      findings.push(finding(
        `DuckDuckGo summary: ${data.AbstractText.slice(0, 500)}`,
        data.AbstractURL || "https://duckduckgo.com",
        0.75
      ));
    }
    if (data?.Heading) {
      findings.push(finding(`DuckDuckGo heading: ${data.Heading}`, "https://duckduckgo.com", 0.6));
    }
    const related = data?.RelatedTopics || [];
    for (const t of related.slice(0, 5)) {
      if (t?.Text) {
        findings.push(finding(`DuckDuckGo related: ${t.Text.slice(0, 200)}`, t.FirstURL || "https://duckduckgo.com", 0.6));
      }
    }
    if (findings.length === 0) {
      findings.push(finding(`No DuckDuckGo instant answers for ${target}`, "https://duckduckgo.com", 0.4));
    }
    return buildSuccess("duckduckgo", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("duckduckgo", sourceLabel, target, e instanceof Error ? e.message : "DuckDuckGo query failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Network
// ============================================

// PeeringDB — FREE, no key required.
// Returns network/ASN peering info.
export async function queryPeeringDB(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "PeeringDB";
  try {
    // Search for the target as an ASN or network name
    const url = `https://www.peeringdb.com/api/net?name__contains=${encodeURIComponent(target)}&depth=1`;
    const res = await rateLimitedFetch("peeringdb", url, {}, 10000);
    if (!res.ok) return buildError("peeringdb", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const nets = data?.data || [];
    const findings: NormalizedFinding[] = nets.slice(0, 5).map((n: Record<string, unknown>) =>
      finding(
        `PeeringDB network: ${n.name} (ASN ${n.asn || "?"}, ${n.info_traffic || "unknown traffic"})`,
        `https://www.peeringdb.net/net/${n.id}`,
        0.8
      )
    );
    if (findings.length === 0) {
      findings.push(finding(`No PeeringDB networks found for ${target}`, "https://www.peeringdb.com", 0.4));
    }
    return buildSuccess("peeringdb", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("peeringdb", sourceLabel, target, e instanceof Error ? e.message : "PeeringDB query failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Finance
// ============================================

// Binlist.net — FREE, no key required.
// Returns BIN/IIN card issuer info.
export async function queryBinlist(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Binlist";
  try {
    // Extract first 6-8 digits if target looks like a card number
    const bin = target.replace(/\D/g, "").slice(0, 8);
    if (bin.length < 6) {
      return buildError("binlist", sourceLabel, target, "Need at least 6 digits for BIN lookup", Date.now() - start);
    }
    const url = `https://lookup.binlist.net/${bin}`;
    const res = await rateLimitedFetch("binlist", url, {}, 8000);
    if (!res.ok) return buildError("binlist", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data?.scheme) findings.push(finding(`Card scheme: ${data.scheme}`, `https://binlist.net`, 0.85));
    if (data?.brand) findings.push(finding(`Card brand: ${data.brand}`, `https://binlist.net`, 0.8));
    if (data?.bank?.name) findings.push(finding(`Issuing bank: ${data.bank.name} (${data.bank.city || "?"}, ${data.bank.phone || "?"})`, `https://binlist.net`, 0.85));
    if (data?.country?.name) findings.push(finding(`Issuing country: ${data.country.name} (${data.country.alpha2})`, `https://binlist.net`, 0.85));
    if (data?.type) findings.push(finding(`Card type: ${data.type}`, `https://binlist.net`, 0.8));
    return buildSuccess("binlist", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("binlist", sourceLabel, target, e instanceof Error ? e.message : "Binlist query failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Crypto
// ============================================

// Blockchair — FREE tier, no key required (rate limited).
// Returns blockchain data for BTC/ETH addresses.
export async function queryBlockchair(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Blockchair";
  try {
    // Detect if BTC or ETH address
    const isEth = target.startsWith("0x") && target.length === 42;
    const blockchain = isEth ? "ethereum" : "bitcoin";
    const url = `https://api.blockchair.com/${blockchain}/dashboards/address/${encodeURIComponent(target)}?limit=5`;
    const res = await rateLimitedFetch("blockchair", url, {}, 12000);
    if (!res.ok) return buildError("blockchair", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const addrData = data?.data?.[target];
    const findings: NormalizedFinding[] = [];
    if (addrData?.address) {
      const a = addrData.address;
      findings.push(finding(
        `Blockchair: ${blockchain} address with balance ${a.balance ? (a.balance / 1e8).toFixed(4) : "0"} ${isEth ? "ETH" : "BTC"}, ${a.transaction_count || 0} transactions`,
        `https://blockchair.com/${blockchain}/address/${target}`,
        0.9
      ));
      if (a.first_seen_receiving) findings.push(finding(`First activity: ${a.first_seen_receiving}`, `https://blockchair.com/${blockchain}/address/${target}`, 0.85));
      if (a.last_seen_spending) findings.push(finding(`Last spending: ${a.last_seen_spending}`, `https://blockchair.com/${blockchain}/address/${target}`, 0.85));
    }
    if (findings.length === 0) {
      findings.push(finding(`No Blockchair data found for ${target}`, "https://blockchair.com", 0.4));
    }
    return buildSuccess("blockchair", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("blockchair", sourceLabel, target, e instanceof Error ? e.message : "Blockchair query failed", Date.now() - start);
  }
}

// Bitcoinabuse — FREE, no key required for lookups.
// Checks if a BTC address is reported as abusive.
export async function queryBitcoinAbuse(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "BitcoinAbuse";
  try {
    if (target.startsWith("0x")) return buildError("bitcoinabuse", sourceLabel, target, "BTC addresses only", Date.now() - start);
    const url = `https://www.bitcoinabuse.com/api/reports/check?address=${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("bitcoinabuse", url, {}, 10000);
    if (!res.ok) return buildError("bitcoinabuse", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data?.count > 0) {
      findings.push(finding(
        `⚠ BitcoinAbuse: ${data.count} abuse reports for this address. Categories: ${(data.recent || []).map((r: Record<string, unknown>) => r.abuse_type).join(", ")}`,
        `https://www.bitcoinabuse.com/reports/${encodeURIComponent(target)}`,
        0.9
      ));
    } else {
      findings.push(finding(`No abuse reports found for ${target}`, `https://www.bitcoinabuse.com`, 0.7));
    }
    return buildSuccess("bitcoinabuse", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("bitcoinabuse", sourceLabel, target, e instanceof Error ? e.message : "BitcoinAbuse query failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Threat Intelligence
// ============================================

// URLScan.io — FREE tier, no key required (public searches).
// Returns URL scan results.
export async function queryURLScan(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "URLScan.io";
  try {
    const url = `https://urlscan.io/api/v1/search/?q=domain:${encodeURIComponent(target)}&size=10`;
    const res = await rateLimitedFetch("urlscan", url, {}, 10000);
    if (!res.ok) return buildError("urlscan", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const results = data?.results || [];
    const findings: NormalizedFinding[] = results.slice(0, 10).map((r: Record<string, unknown>) =>
      finding(
        `URLScan: ${r._id as string} scanned ${(r.task as Record<string, unknown>)?.time || "?"} — page ${(r.page as Record<string, unknown>)?.title || "?"} (${(r.page as Record<string, unknown>)?.ip || "?"})`,
        `https://urlscan.io/result/${r._id as string}/`,
        0.8
      )
    );
    if (findings.length === 0) {
      findings.push(finding(`No URLScan results for ${target}`, "https://urlscan.io", 0.4));
    }
    return buildSuccess("urlscan", sourceLabel, target, findings, Date.now() - start, { total: data?.total || 0 });
  } catch (e) {
    return buildError("urlscan", sourceLabel, target, e instanceof Error ? e.message : "URLScan query failed", Date.now() - start);
  }
}

// AlienVault OTX — FREE, no key required for public pulses.
// Returns threat intel pulses for an indicator.
export async function queryOTX(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "AlienVault OTX";
  try {
    // Determine indicator type
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(target);
    const isDomain = /^[a-z0-9-]+\.[a-z]{2,}$/i.test(target);
    const type = isIp ? "IPv4" : isDomain ? "domain" : "hostname";
    const url = `https://otx.alienvault.com/api/v1/indicators/${type}/${encodeURIComponent(target)}/general`;
    const res = await rateLimitedFetch("otx", url, {}, 10000);
    if (!res.ok) return buildError("otx", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data?.pulse_info?.count > 0) {
      findings.push(finding(
        `OTX: ${data.pulse_info.count} threat pulses reference this indicator`,
        `https://otx.alienvault.com/indicator/${type}/${encodeURIComponent(target)}`,
        0.85
      ));
      const pulses = data.pulse_info.pulses || [];
      for (const p of pulses.slice(0, 5)) {
        findings.push(finding(
          `OTX pulse: ${p.name} by ${p.author_name} (tags: ${(p.tags || []).join(", ")})`,
          `https://otx.alienvault.com/pulse/${p.id}`,
          0.8
        ));
      }
    } else {
      findings.push(finding(`No OTX threat pulses for ${target}`, "https://otx.alienvault.com", 0.6));
    }
    return buildSuccess("otx", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("otx", sourceLabel, target, e instanceof Error ? e.message : "OTX query failed", Date.now() - start);
  }
}

// NVD CVE Search — FREE, no key required.
// Searches NIST NVD for CVEs matching a keyword (product/vendor).
export async function queryNVD(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "NVD CVE";
  try {
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(target)}&resultsPerPage=10`;
    const res = await rateLimitedFetch("nvd", url, {}, 12000);
    if (!res.ok) return buildError("nvd", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const vulns = data?.vulnerabilities || [];
    const findings: NormalizedFinding[] = vulns.slice(0, 10).map((v: Record<string, unknown>) => {
      const cve = v.cve as Record<string, unknown>;
      const id = cve?.id || "?";
      const desc = ((cve?.descriptions as unknown[]) || []).find((d) => (d as Record<string, unknown>)?.lang === "en");
      return finding(
        `NVD CVE: ${id} — ${desc ? (desc as Record<string, unknown>).value : "no description"}`.slice(0, 500),
        `https://nvd.nist.gov/vuln/detail/${id}`,
        0.9
      );
    });
    if (findings.length === 0) {
      findings.push(finding(`No NVD CVEs found for ${target}`, "https://nvd.nist.gov", 0.4));
    }
    return buildSuccess("nvd", sourceLabel, target, findings, Date.now() - start, { total: data?.totalResults || 0 });
  } catch (e) {
    return buildError("nvd", sourceLabel, target, e instanceof Error ? e.message : "NVD query failed", Date.now() - start);
  }
}

// AbuseIPDB — FREE tier (1000 req/day), requires API key.
// If ABUSEIPDB_API_KEY not set, returns "skipped".
export async function queryAbuseIPDB(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "AbuseIPDB";
  if (!process.env.ABUSEIPDB_API_KEY) {
    return { source: "abuseipdb", source_label: sourceLabel, target, status: "skipped", error: "ABUSEIPDB_API_KEY not configured (free tier: 1000 req/day — sign up at abuseipdb.com)", findings: [] };
  }
  try {
    const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(target)}&maxAgeInDays=90`;
    const res = await rateLimitedFetch("abuseipdb", url, {
      headers: { Key: process.env.ABUSEIPDB_API_KEY, Accept: "application/json" },
    }, 10000);
    if (!res.ok) return buildError("abuseipdb", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const d = data?.data;
    const findings: NormalizedFinding[] = [];
    if (d) {
      findings.push(finding(
        `AbuseIPDB: ${d.abuseConfidenceScore}% confidence, ${d.totalReports} reports, ${d.usageType || "unknown usage"}`,
        `https://www.abuseipdb.com/check/${encodeURIComponent(target)}`,
        0.9
      ));
      if (d.isPublic) findings.push(finding(`Public IP, country ${d.countryCode || "?"}`, `https://www.abuseipdb.com/check/${encodeURIComponent(target)}`, 0.8));
      if (d.domain) findings.push(finding(`Associated domain: ${d.domain}`, `https://www.abuseipdb.com/check/${encodeURIComponent(target)}`, 0.75));
    }
    return buildSuccess("abuseipdb", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("abuseipdb", sourceLabel, target, e instanceof Error ? e.message : "AbuseIPDB query failed", Date.now() - start);
  }
}

// VirusTotal — FREE public API (4 req/min), requires API key.
// If VIRUSTOTAL_API_KEY not set, returns "skipped".
export async function queryVirusTotal(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "VirusTotal";
  if (!process.env.VIRUSTOTAL_API_KEY) {
    return { source: "virustotal", source_label: sourceLabel, target, status: "skipped", error: "VIRUSTOTAL_API_KEY not configured (free tier: 4 req/min — sign up at virustotal.com)", findings: [] };
  }
  try {
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(target);
    const isDomain = /^[a-z0-9-]+\.[a-z]{2,}$/i.test(target);
    const endpoint = isIp ? "ip_addresses" : isDomain ? "domains" : "ip_addresses";
    const url = `https://www.virustotal.com/api/v3/${endpoint}/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("virustotal", url, {
      headers: { "x-apikey": process.env.VIRUSTOTAL_API_KEY },
    }, 15000);
    if (!res.ok) return buildError("virustotal", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const attrs = data?.data?.attributes;
    const findings: NormalizedFinding[] = [];
    if (attrs?.last_analysis_stats) {
      const stats = attrs.last_analysis_stats;
      findings.push(finding(
        `VirusTotal: ${stats.malicious} malicious, ${stats.suspicious} suspicious, ${stats.harmless} harmless, ${stats.undetected} undetected (of ${stats.malicious + stats.suspicious + stats.harmless + stats.undetected} engines)`,
        `https://www.virustotal.com/gui/${endpoint === "ip_addresses" ? "ip-address" : "domain"}/${encodeURIComponent(target)}`,
        0.95
      ));
    }
    if (attrs?.reputation != null) {
      findings.push(finding(`VirusTotal reputation: ${attrs.reputation}`, `https://www.virustotal.com`, 0.8));
    }
    return buildSuccess("virustotal", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("virustotal", sourceLabel, target, e instanceof Error ? e.message : "VirusTotal query failed", Date.now() - start);
  }
}
