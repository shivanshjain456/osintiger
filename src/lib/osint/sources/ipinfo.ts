// IP geolocation intelligence. Uses ip-api.com (no key required, 45 req/min free)
// as a no-key substitute for IPinfo. Returns geo + org data.

import type { SourceResult, NormalizedFinding } from "../types";
import { fetchWithTimeout, nowISO } from "./_helpers";

interface IpApiResult {
  status?: string;
  message?: string;
  query?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  reverse?: string;
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
}

export async function queryIpInfo(ip: string): Promise<SourceResult> {
  const start = Date.now();
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=66846719`;
    const res = await fetchWithTimeout(url, {}, 10000);
    if (!res.ok) throw new Error(`IP API HTTP ${res.status}`);
    const data: IpApiResult = await res.json();
    if (data.status && data.status !== "success") {
      throw new Error(data.message || "IP lookup failed");
    }
    const findings: NormalizedFinding[] = [];
    findings.push({
      data: `Geolocation: ${data.city || "?"}, ${data.regionName || ""}, ${data.country || "?"} (${data.countryCode || "?"})`,
      source_url: `https://ip-api.com/#${encodeURIComponent(ip)}`,
      confidence: 0.85,
      timestamp: nowISO(),
      extra: { lat: data.lat, lon: data.lon, country: data.countryCode },
    });
    if (data.org || data.isp) {
      findings.push({
        data: `Network operator: ${data.org || data.isp}${data.as ? " (" + data.as + ")" : ""}`,
        source_url: `https://ip-api.com/#${encodeURIComponent(ip)}`,
        confidence: 0.8,
        timestamp: nowISO(),
      });
    }
    if (data.hosting) {
      findings.push({
        data: `Hosted on a datacenter / hosting provider network`,
        source_url: `https://ip-api.com/#${encodeURIComponent(ip)}`,
        confidence: 0.9,
        timestamp: nowISO(),
      });
    }
    if (data.proxy) {
      findings.push({
        data: `Flagged as proxy / anonymizer by upstream geo service`,
        source_url: `https://ip-api.com/#${encodeURIComponent(ip)}`,
        confidence: 0.7,
        timestamp: nowISO(),
      });
    }
    return {
      source: "ipinfo",
      source_label: "IP Geo Intel",
      target: ip,
      status: "success",
      latency_ms: Date.now() - start,
      findings,
      raw: data,
    };
  } catch (e) {
    return {
      source: "ipinfo",
      source_label: "IP Geo Intel",
      target: ip,
      status: "error",
      error: e instanceof Error ? e.message : "IP lookup failed",
      latency_ms: Date.now() - start,
      findings: [],
    };
  }
}

// Resolve a domain to an IP via DNS-over-HTTPS (Cloudflare) — no key.
export async function resolveDomain(domain: string): Promise<string | null> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`;
    const res = await fetchWithTimeout(
      url,
      { headers: { accept: "application/dns-json" } },
      8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    const answer = data?.Answer?.find(
      (a: { type: number; data: string }) => a.type === 1
    );
    return answer?.data || null;
  } catch {
    return null;
  }
}
