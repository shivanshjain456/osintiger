// Extended OSINT API sources — Round 2: Additional free APIs from the master list.
// All sources here are FREE and require NO API key unless explicitly noted.

import type { SourceResult, NormalizedFinding } from "../../types";
import { nowISO } from "../_helpers";
import { rateLimitedFetch, buildSuccess, buildError, finding } from "./_shared";

// ============================================
// NETWORK, DOMAIN & IP ENRICHMENT
// ============================================

// Shodan InternetDB — FREE, no key required.
// Returns open ports, tags, hostnames, CPEs, and CVEs for an IP.
export async function queryShodanInternetDB(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Shodan InternetDB";
  try {
    const url = `https://internetdb.shodan.io/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("shodan_internetdb", url, {}, 10000);
    if (!res.ok) {
      if (res.status === 404) {
        return buildSuccess("shodan_internetdb", sourceLabel, target,
          [finding(`Shodan InternetDB: No data found for ${target}`, `https://internetdb.shodan.io/${target}`, 0.4)],
          Date.now() - start);
      }
      return buildError("shodan_internetdb", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    }
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data.ports?.length) {
      findings.push(finding(
        `Shodan InternetDB: Open ports: ${data.ports.join(", ")}`,
        `https://www.shodan.io/host/${target}`,
        0.9
      ));
    }
    if (data.hostnames?.length) {
      findings.push(finding(`Shodan hostnames: ${data.hostnames.join(", ")}`, `https://www.shodan.io/host/${target}`, 0.85));
    }
    if (data.tags?.length) {
      findings.push(finding(`Shodan tags: ${data.tags.join(", ")}`, `https://www.shodan.io/host/${target}`, 0.8));
    }
    if (data.vulns?.length) {
      findings.push(finding(`⚠ Shodan vulnerabilities: ${data.vulns.join(", ")}`, `https://www.shodan.io/host/${target}`, 0.95));
    }
    if (data.cpes?.length) {
      findings.push(finding(`Shodan CPEs: ${data.cpes.slice(0, 5).join(", ")}`, `https://www.shodan.io/host/${target}`, 0.8));
    }
    if (findings.length === 0) {
      findings.push(finding(`Shodan InternetDB: No open ports or data found for ${target}`, `https://internetdb.shodan.io/${target}`, 0.4));
    }
    return buildSuccess("shodan_internetdb", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("shodan_internetdb", sourceLabel, target, e instanceof Error ? e.message : "Shodan InternetDB failed", Date.now() - start);
  }
}

// OpenRDAP — FREE, no key required.
// Returns structured WHOIS/RDAP data for IPs and domains.
export async function queryOpenRDAP(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "OpenRDAP WHOIS";
  try {
    const isIP = /^\d{1,3}(\.\d{1,3}){3}$/.test(target) || target.includes(":");
    const type = isIP ? "ip" : "domain";
    const url = `https://rdap.org/${type}/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("openrdap", url, { headers: { Accept: "application/json" } }, 10000);
    if (!res.ok) return buildError("openrdap", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data.name) findings.push(finding(`RDAP name: ${data.name}`, url, 0.85));
    if (data.handle) findings.push(finding(`RDAP handle: ${data.handle}`, url, 0.8));
    if (data.status) findings.push(finding(`RDAP status: ${Array.isArray(data.status) ? data.status.join(", ") : data.status}`, url, 0.8));
    // Extract events (registration, expiration)
    if (data.events) {
      for (const ev of data.events) {
        if (ev.eventAction && ev.eventDate) {
          findings.push(finding(`RDAP ${ev.eventAction}: ${ev.eventDate}`, url, 0.85));
        }
      }
    }
    // Extract entities (registrar, abuse contacts)
    if (data.entities) {
      for (const ent of data.entities.slice(0, 5)) {
        const roles = ent.roles?.join(", ") || "unknown";
        const vcard = ent.vcardArray?.[1] || [];
        const emailEntry = vcard.find((v: unknown[]) => Array.isArray(v) && v[0] === "email");
        const fnEntry = vcard.find((v: unknown[]) => Array.isArray(v) && v[0] === "fn");
        let detail = `RDAP entity (${roles}): ${ent.handle || "?"}`;
        if (fnEntry) detail += ` — ${fnEntry[3]}`;
        if (emailEntry) detail += ` <${emailEntry[3]}>`;
        findings.push(finding(detail, url, 0.8));
      }
    }
    if (findings.length === 0) {
      findings.push(finding(`RDAP: No structured data found for ${target}`, url, 0.4));
    }
    return buildSuccess("openrdap", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("openrdap", sourceLabel, target, e instanceof Error ? e.message : "OpenRDAP failed", Date.now() - start);
  }
}

// GreyNoise Community API — FREE, no key required (optional key for more data).
// Returns IP classification (benign/malicious/unknown), name, and noise status.
export async function queryGreyNoise(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "GreyNoise";
  try {
    const url = `https://api.greynoise.io/v3/community/${encodeURIComponent(target)}`;
    const res = await rateLimitedFetch("greynoise", url, {}, 10000);
    if (!res.ok) {
      if (res.status === 404) {
        return buildSuccess("greynoise", sourceLabel, target,
          [finding(`GreyNoise: IP ${target} not found in database (no known activity)`, `https://viz.greynoise.io/ip/${target}`, 0.6)],
          Date.now() - start);
      }
      return buildError("greynoise", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    }
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    findings.push(finding(
      `GreyNoise: ${data.classification || "unknown"} — ${data.name || "Unknown"} (noise: ${data.noise}, riot: ${data.riot})`,
      data.link || `https://viz.greynoise.io/ip/${target}`,
      data.classification === "malicious" ? 0.95 : data.classification === "benign" ? 0.8 : 0.6
    ));
    if (data.last_seen) {
      findings.push(finding(`GreyNoise last seen: ${data.last_seen}`, `https://viz.greynoise.io/ip/${target}`, 0.7));
    }
    return buildSuccess("greynoise", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("greynoise", sourceLabel, target, e instanceof Error ? e.message : "GreyNoise failed", Date.now() - start);
  }
}

// ============================================
// CORPORATE, IDENTITY & SANCTIONS
// ============================================

// GLEIF Legal Entity Identifier — FREE, no key required.
// Returns global corporate identity data (LEI records).
export async function queryGLEIF(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "GLEIF LEI";
  try {
    const url = `https://api.gleif.org/api/v1/lei-records?filter[fulltext]=${encodeURIComponent(target)}&page[size]=5`;
    const res = await rateLimitedFetch("gleif", url, { headers: { Accept: "application/json" } }, 12000);
    if (!res.ok) return buildError("gleif", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const json = await res.json();
    const items = json?.data || [];
    const findings: NormalizedFinding[] = items.slice(0, 5).map((item: Record<string, unknown>) => {
      const attrs = (item.attributes || {}) as Record<string, unknown>;
      const entity = (attrs.entity || {}) as Record<string, unknown>;
      const legalName = (entity.legalName as Record<string, unknown>)?.name || "?";
      const status = entity.status || "?";
      const jurisdiction = entity.jurisdiction || "?";
      return finding(
        `GLEIF LEI: ${legalName} (LEI: ${item.id}, status: ${status}, jurisdiction: ${jurisdiction})`,
        `https://search.gleif.org/#/record/${item.id}`,
        0.9
      );
    });
    if (findings.length === 0) {
      findings.push(finding(`GLEIF: No LEI records found for "${target}"`, "https://search.gleif.org", 0.4));
    }
    return buildSuccess("gleif", sourceLabel, target, findings, Date.now() - start, { count: items.length });
  } catch (e) {
    return buildError("gleif", sourceLabel, target, e instanceof Error ? e.message : "GLEIF failed", Date.now() - start);
  }
}

// OpenSanctions — FREE for non-commercial use, no key required.
// Returns sanctions, PEP, and watchlist matches via matching API.
export async function queryOpenSanctions(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "OpenSanctions";
  try {
    const url = "https://api.opensanctions.org/match/default";
    const body = JSON.stringify({
      queries: {
        q1: {
          schema: "Person",
          properties: { name: [target] }
        }
      }
    });
    const res = await rateLimitedFetch("opensanctions", url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }, 12000);
    if (!res.ok) return buildError("opensanctions", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const responses = data?.responses?.q1 || [];
    const findings: NormalizedFinding[] = responses.slice(0, 5).map((r: Record<string, unknown>) => {
      const props = (r.properties || {}) as Record<string, unknown[]>;
      const name = Array.isArray(props.name) ? props.name[0] : "?";
      const countries = Array.isArray(props.country) ? props.country.join(", ") : "?";
      const datasets = Array.isArray(r.datasets) ? r.datasets.join(", ") : "?";
      return finding(
        `OpenSanctions match: ${name} (countries: ${countries}, lists: ${datasets}, score: ${r.score || "?"})`,
        `https://opensanctions.org/entities/${r.id}/`,
        0.85
      );
    });
    if (findings.length === 0) {
      findings.push(finding(`OpenSanctions: No matches found for "${target}"`, "https://opensanctions.org", 0.7));
    }
    return buildSuccess("opensanctions", sourceLabel, target, findings, Date.now() - start, { matches: responses.length });
  } catch (e) {
    return buildError("opensanctions", sourceLabel, target, e instanceof Error ? e.message : "OpenSanctions failed", Date.now() - start);
  }
}

// ============================================
// PEOPLE, USERNAME & DIGITAL FOOTPRINT
// ============================================

// WhatsMyName — FREE, no key required.
// Checks username existence across popular platforms using community-maintained database.
export async function queryWhatsMyName(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "WhatsMyName";
  try {
    // Fetch the WMN database
    const configUrl = "https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json";
    const configRes = await rateLimitedFetch("wmn_config", configUrl, {}, 15000);
    if (!configRes.ok) return buildError("whatsmyname", sourceLabel, target, "Failed to fetch WMN database", Date.now() - start);
    const configData = await configRes.json();
    let sites: Record<string, unknown>[] = configData.sites || [];

    // Filter to active sites and a curated subset of popular platforms
    sites = sites.filter((s) => s.valid);
    const popularNames = ["github", "twitter", "instagram", "reddit", "wikipedia", "pinterest", "medium", "vimeo", "slideshare", "keybase", "gitlab"];
    sites = sites.filter((s) => popularNames.includes(String(s.name).toLowerCase()));
    sites = sites.slice(0, 12); // Limit concurrency

    const results: { site: string; profileUrl: string; found: boolean }[] = [];
    const promises = sites.map(async (site) => {
      const checkUrl = String(site.uri_check || "").replace("{account}", encodeURIComponent(target));
      if (!checkUrl) return;
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(checkUrl, { signal: ctrl.signal, headers: { "User-Agent": "OSINTiger/1.0" } });
        clearTimeout(timer);
        let exists = false;
        if (res.status === site.e_code) {
          if (site.e_string) {
            const text = await res.text();
            if (text.includes(String(site.e_string))) exists = true;
          } else {
            exists = true;
          }
        }
        if (site.m_code && res.status === site.m_code) exists = false;
        if (exists) {
          results.push({ site: String(site.name), profileUrl: checkUrl, found: true });
        }
      } catch {
        // Network/timeout — skip
      }
    });
    await Promise.all(promises);

    const findings: NormalizedFinding[] = results.map((r) =>
      finding(`WhatsMyName: Username "${target}" found on ${r.site}`, r.profileUrl, 0.85)
    );
    if (findings.length === 0) {
      findings.push(finding(`WhatsMyName: Username "${target}" not found on ${sites.length} popular platforms`, "https://whatsmyname.app", 0.5));
    }
    return buildSuccess("whatsmyname", sourceLabel, target, findings, Date.now() - start, { checked: sites.length, found: results.length });
  } catch (e) {
    return buildError("whatsmyname", sourceLabel, target, e instanceof Error ? e.message : "WhatsMyName failed", Date.now() - start);
  }
}

// ============================================
// AVIATION & LOCATION OSINT
// ============================================

// OpenSky Network — FREE, no key required.
// Returns real-time aircraft data (all planes in a bounding box).
export async function queryOpenSky(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "OpenSky Network";
  try {
    // If target looks like an ICAO24 hex address (6 hex chars), search by that
    if (/^[0-9a-f]{6}$/i.test(target)) {
      const url = `https://opensky-network.org/api/states/all?icao24=${encodeURIComponent(target)}`;
      const res = await rateLimitedFetch("opensky", url, {}, 10000);
      if (!res.ok) return buildError("opensky", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
      const data = await res.json();
      const states = data?.states || [];
      const findings: NormalizedFinding[] = states.slice(0, 5).map((s: unknown[]) => {
        const callsign = s[1] ? String(s[1]).trim() : "N/A";
        const origin = s[2] || "?";
        const lon = s[5] || "?";
        const lat = s[6] || "?";
        const alt = s[7] != null ? `${s[7]}m` : "ground";
        const vel = s[9] != null ? `${Math.round(Number(s[9]) * 3.6)}km/h` : "?";
        return finding(
          `OpenSky: Aircraft ${target} (callsign: ${callsign}, origin: ${origin}, position: ${lat},${lon}, altitude: ${alt}, speed: ${vel})`,
          `https://opensky-network.org/aircraft-profile?icao24=${target}`,
          0.9
        );
      });
      if (findings.length === 0) {
        findings.push(finding(`OpenSky: Aircraft ${target} not currently airborne`, `https://opensky-network.org`, 0.5));
      }
      return buildSuccess("opensky", sourceLabel, target, findings, Date.now() - start, data);
    }
    return buildSuccess("opensky", sourceLabel, target,
      [finding(`OpenSky: Target is not an ICAO24 hex address (expected 6 hex chars)`, "https://opensky-network.org", 0.3)],
      Date.now() - start);
  } catch (e) {
    return buildError("opensky", sourceLabel, target, e instanceof Error ? e.message : "OpenSky failed", Date.now() - start);
  }
}

// OpenStreetMap Nominatim — FREE, no key required.
// Geocodes addresses, place names, or coordinates into structured location data.
export async function queryNominatim(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "OSM Nominatim";
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(target)}&format=json&limit=5`;
    const res = await rateLimitedFetch("nominatim", url, { headers: { Accept: "application/json" } }, 10000);
    if (!res.ok) return buildError("nominatim", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    const findings: NormalizedFinding[] = items.slice(0, 5).map((item: Record<string, unknown>) =>
      finding(
        `Nominatim: ${item.display_name || "?"} (type: ${item.type || "?"}, lat: ${item.lat || "?"}, lon: ${item.lon || "?"})`,
        `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}`,
        0.85
      )
    );
    if (findings.length === 0) {
      findings.push(finding(`Nominatim: No geocoding results for "${target}"`, "https://nominatim.openstreetmap.org", 0.4));
    }
    return buildSuccess("nominatim", sourceLabel, target, findings, Date.now() - start, { results: items.length });
  } catch (e) {
    return buildError("nominatim", sourceLabel, target, e instanceof Error ? e.message : "Nominatim failed", Date.now() - start);
  }
}

// ============================================
// VULNERABILITY & THREAT INTELLIGENCE
// ============================================

// Shodan CVEDB — FREE, no key required.
// Returns CVE details including CVSS, EPSS, CISA KEV status.
export async function queryShodanCVEDB(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Shodan CVEDB";
  try {
    // Only query if target looks like a CVE ID
    if (!/^CVE-\d{4}-\d+$/i.test(target)) {
      return buildSuccess("shodan_cvedb", sourceLabel, target,
        [finding(`Shodan CVEDB: Target is not a CVE ID (expected format: CVE-YYYY-NNNN)`, "https://cvedb.shodan.io", 0.3)],
        Date.now() - start);
    }
    const url = `https://cvedb.shodan.io/cve/${encodeURIComponent(target.toUpperCase())}`;
    const res = await rateLimitedFetch("shodan_cvedb", url, {}, 10000);
    if (!res.ok) return buildError("shodan_cvedb", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data.summary) findings.push(finding(`CVE summary: ${data.summary.slice(0, 400)}`, `https://nvd.nist.gov/vuln/detail/${target}`, 0.95));
    if (data.cvss) findings.push(finding(`CVSS score: ${data.cvss} (v${data.cvss_version || 3})`, `https://nvd.nist.gov/vuln/detail/${target}`, 0.9));
    if (data.epss != null) findings.push(finding(`EPSS (exploit likelihood): ${(data.epss * 100).toFixed(2)}%`, `https://nvd.nist.gov/vuln/detail/${target}`, 0.85));
    if (data.kev) findings.push(finding(`⚠ CISA KEV: This CVE is in the Known Exploited Vulnerabilities catalog`, `https://nvd.nist.gov/vuln/detail/${target}`, 0.95));
    if (data.ransomware_campaign) findings.push(finding(`⚠ Ransomware campaign: ${data.ransomware_campaign}`, `https://nvd.nist.gov/vuln/detail/${target}`, 0.95));
    return buildSuccess("shodan_cvedb", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("shodan_cvedb", sourceLabel, target, e instanceof Error ? e.message : "Shodan CVEDB failed", Date.now() - start);
  }
}

// ThreatFox (abuse.ch) — FREE, no key required.
// Returns IOC (indicator of compromise) data for IPs, domains, URLs, hashes.
export async function queryThreatFox(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "ThreatFox (abuse.ch)";
  try {
    const url = "https://threatfox-api.abuse.ch/api/v1/";
    const body = JSON.stringify({ query: "search_ioc", search_term: target, exact_match: true });
    const res = await rateLimitedFetch("threatfox", url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }, 12000);
    if (!res.ok) return buildError("threatfox", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const items = data?.data || [];
    const findings: NormalizedFinding[] = items.slice(0, 5).map((item: Record<string, unknown>) =>
      finding(
        `ThreatFox IOC: ${item.ioc || target} — threat type: ${item.threat_type || "?"}, malware: ${item.malware || "?"}, confidence: ${item.confidence_level || "?"}`,
        `https://threatfox.abuse.ch/ioc/${item.id}/`,
        0.9
      )
    );
    if (findings.length === 0) {
      findings.push(finding(`ThreatFox: No IOC matches found for "${target}"`, "https://threatfox.abuse.ch", 0.6));
    }
    return buildSuccess("threatfox", sourceLabel, target, findings, Date.now() - start, { count: items.length });
  } catch (e) {
    return buildError("threatfox", sourceLabel, target, e instanceof Error ? e.message : "ThreatFox failed", Date.now() - start);
  }
}

// CISA KEV Catalog — FREE, no key required.
// Fetches the full CISA KEV catalog and checks if a CVE is listed.
let kevCache: { data: Record<string, unknown>[]; fetchedAt: number } | null = null;
export async function queryCisaKEV(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "CISA KEV";
  try {
    if (!/^CVE-\d{4}-\d+$/i.test(target)) {
      return buildSuccess("cisa_kev", sourceLabel, target,
        [finding(`CISA KEV: Target is not a CVE ID`, "https://www.cisa.gov/kev", 0.3)],
        Date.now() - start);
    }
    const cveId = target.toUpperCase();
    // Cache KEV catalog for 1 hour
    if (!kevCache || Date.now() - kevCache.fetchedAt > 3600000) {
      const url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
      const res = await rateLimitedFetch("cisa_kev_fetch", url, {}, 15000);
      if (!res.ok) return buildError("cisa_kev", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
      const data = await res.json();
      kevCache = { data: data?.vulnerabilities || [], fetchedAt: Date.now() };
    }
    const match = kevCache.data.find((v) => v.cveID === cveId);
    const findings: NormalizedFinding[] = [];
    if (match) {
      findings.push(finding(
        `⚠ CISA KEV: ${cveId} is actively exploited! Vendor: ${match.vendorProject}, product: ${match.product}, vulnerability: ${match.vulnerabilityName}`,
        `https://nvd.nist.gov/vuln/detail/${cveId}`,
        0.98
      ));
      if (match.dateAdded) findings.push(finding(`CISA KEV date added: ${match.dateAdded}`, `https://nvd.nist.gov/vuln/detail/${cveId}`, 0.85));
      if (match.requiredAction) findings.push(finding(`CISA required action: ${match.requiredAction}`, `https://nvd.nist.gov/vuln/detail/${cveId}`, 0.9));
    } else {
      findings.push(finding(`CISA KEV: ${cveId} is NOT in the Known Exploited Vulnerabilities catalog`, "https://www.cisa.gov/kev", 0.7));
    }
    return buildSuccess("cisa_kev", sourceLabel, target, findings, Date.now() - start, { found: !!match });
  } catch (e) {
    return buildError("cisa_kev", sourceLabel, target, e instanceof Error ? e.message : "CISA KEV failed", Date.now() - start);
  }
}
