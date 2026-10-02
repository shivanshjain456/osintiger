// Universal OSINT sources — Round 4: Email, Phone, URL, News, Hash intelligence.
// ALL sources here are FREE and require NO API key.
// Implements collectors for newly-detected input types: email, username, phone, url, hash.

import type { SourceResult, NormalizedFinding } from "../../types";
import { rateLimitedFetch, buildSuccess, buildError, finding } from "./_shared";
import { PATTERNS } from "../../detector";

// ============================================
// CATEGORY: Email Intelligence
// ============================================

// Mailcheck.ai — FREE, no key. Validates email deliverability + checks domain MX.
export async function queryMailcheck(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Mailcheck.ai";
  try {
    if (!PATTERNS.EMAIL_RE.test(target)) {
      return buildSuccess("mailcheck", sourceLabel, target, [finding(`Mailcheck: Target is not a valid email address`, "https://mailcheck.ai", 0.3)], Date.now() - start);
    }
    const [local, domain] = target.split("@");
    const url = `https://api.mailcheck.ai/domain/${encodeURIComponent(domain)}`;
    const res = await rateLimitedFetch("mailcheck", url, {}, 10000);
    if (!res.ok) return buildError("mailcheck", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    if (data.mx !== undefined) {
      findings.push(finding(`Mailcheck: Domain ${domain} MX records: ${Array.isArray(data.mx) ? data.mx.join(", ") : data.mx || "none"}`, `https://mailcheck.ai/domain/${domain}`, 0.85));
    }
    if (data.disposable !== undefined) {
      findings.push(finding(`Mailcheck: ${domain} is ${data.disposable ? "⚠ a DISPOSABLE email provider" : "a legitimate (non-disposable) domain"}`, `https://mailcheck.ai/domain/${domain}`, 0.9));
    }
    if (data.valid !== undefined) {
      findings.push(finding(`Mailcheck: Domain validity: ${data.valid ? "valid" : "invalid"} — MX host exists: ${data.mx ? "yes" : "no"}`, `https://mailcheck.ai/domain/${domain}`, 0.85));
    }
    if (findings.length === 0) findings.push(finding(`Mailcheck: No domain data returned for ${domain}`, "https://mailcheck.ai", 0.4));
    return buildSuccess("mailcheck", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("mailcheck", sourceLabel, target, e instanceof Error ? e.message : "Mailcheck failed", Date.now() - start);
  }
}

// Gravatar — FREE, no key. Returns profile JSON (if exists) for an email's MD5 hash.
export async function queryGravatar(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Gravatar";
  try {
    if (!PATTERNS.EMAIL_RE.test(target)) {
      return buildSuccess("gravatar", sourceLabel, target, [finding(`Gravatar: Target is not an email address`, "https://gravatar.com", 0.3)], Date.now() - start);
    }
    // Gravatar uses MD5 of lowercased+trimmed email
    const { createHash } = await import("crypto");
    const hash = createHash("md5").update(target.toLowerCase().trim()).digest("hex");
    const url = `https://gravatar.com/${hash}.json`;
    const res = await rateLimitedFetch("gravatar", url, {}, 10000);
    if (!res.ok) {
      if (res.status === 404) {
        return buildSuccess("gravatar", sourceLabel, target, [finding(`Gravatar: No profile found for ${target}`, `https://gravatar.com/${hash}`, 0.6)], Date.now() - start);
      }
      return buildError("gravatar", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    }
    const data = await res.json();
    const entries = data?.entry || [];
    const findings: NormalizedFinding[] = [];
    for (const entry of entries.slice(0, 3)) {
      const name = entry.displayName || entry.name?.givenName || "?";
      const about = entry.aboutMe || "";
      const username = entry.preferredUsername || "";
      const urls = Array.isArray(entry.accounts) ? entry.accounts.map((a: Record<string, unknown>) => `${a.shortname || a.domain}: ${a.url}`).join(" | ") : "none";
      findings.push(finding(
        `Gravatar profile: ${name} (username: ${username}) — about: ${about.slice(0, 200) || "none"} — linked accounts: ${urls}`,
        `https://gravatar.com/${username || hash}`,
        0.9
      ));
      if (entry.thumbnailUrl) findings.push(finding(`Gravatar avatar URL: ${entry.thumbnailUrl}`, entry.thumbnailUrl, 0.8));
    }
    if (findings.length === 0) findings.push(finding(`Gravatar: No profile entries for ${target}`, `https://gravatar.com/${hash}`, 0.5));
    return buildSuccess("gravatar", sourceLabel, target, findings, Date.now() - start, data);
  } catch (e) {
    return buildError("gravatar", sourceLabel, target, e instanceof Error ? e.message : "Gravatar failed", Date.now() - start);
  }
}

// DNS MX records for email domain — FREE via Google DoH.
export async function queryEmailMX(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Email MX/DNS";
  try {
    if (!PATTERNS.EMAIL_RE.test(target)) {
      return buildSuccess("emailmx", sourceLabel, target, [finding(`Email MX: Target is not an email address`, "https://dns.google", 0.3)], Date.now() - start);
    }
    const domain = target.split("@")[1];
    const recordTypes = ["MX", "TXT", "SPF"];
    const findings: NormalizedFinding[] = [];
    for (const type of recordTypes) {
      const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`;
      const res = await rateLimitedFetch("emailmx", url, {}, 6000);
      if (!res.ok) continue;
      const data = await res.json();
      const answers = Array.isArray(data.Answer) ? data.Answer : [];
      for (const a of answers) {
        findings.push(finding(`DNS ${type} for ${domain}: ${a.data} (TTL: ${a.TTL || "?"}s)`, `https://dns.google/query?name=${encodeURIComponent(domain)}&type=${type}`, 0.85));
      }
    }
    // Check DMARC
    const dmarcUrl = `https://dns.google/resolve?name=_dmarc.${encodeURIComponent(domain)}&type=TXT`;
    const dmarcRes = await rateLimitedFetch("emailmx", dmarcUrl, {}, 6000);
    if (dmarcRes.ok) {
      const dmarcData = await dmarcRes.json();
      const dmarcAnswers = Array.isArray(dmarcData.Answer) ? dmarcData.Answer : [];
      if (dmarcAnswers.length > 0) {
        findings.push(finding(`DMARC policy for ${domain}: ${dmarcAnswers[0].data}`, `https://dns.google/query?name=_dmarc.${domain}&type=TXT`, 0.9));
      } else {
        findings.push(finding(`DMARC: No policy published for ${domain} (email spoofing risk)`, `https://dns.google`, 0.7));
      }
    }
    if (findings.length === 0) findings.push(finding(`Email MX: No DNS records found for ${domain}`, "https://dns.google", 0.5));
    return buildSuccess("emailmx", sourceLabel, target, findings, Date.now() - start, { domain });
  } catch (e) {
    return buildError("emailmx", sourceLabel, target, e instanceof Error ? e.message : "Email MX failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Phone Intelligence
// ============================================

// numverify-style free alternative: Google libphonenumber serverless via API
// Using abstractapi-style via phone validation through multiple free endpoints
export async function queryPhoneInfo(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Phone Intel";
  try {
    // Normalize: strip everything but digits and +
    const normalized = target.replace(/[^\d+]/g, "");
    if (!normalized.match(/^\+?\d{7,15}$/)) {
      return buildSuccess("phoneinfo", sourceLabel, target, [finding(`Phone Intel: "${target}" does not look like a valid phone number`, "https://en.wikipedia.org/wiki/E.164", 0.4)], Date.now() - start);
    }
    const findings: NormalizedFinding[] = [];

    // Extract country code heuristic
    const ccMap: Record<string, string> = {
      "1": "US/CA (North America)",
      "44": "GB (United Kingdom)",
      "33": "FR (France)",
      "49": "DE (Germany)",
      "86": "CN (China)",
      "81": "JP (Japan)",
      "91": "IN (India)",
      "7": "RU/KZ (Russia/Kazakhstan)",
      "55": "BR (Brazil)",
      "61": "AU (Australia)",
      "82": "KR (South Korea)",
      "39": "IT (Italy)",
      "34": "ES (Spain)",
      "52": "MX (Mexico)",
      "31": "NL (Netherlands)",
      "46": "SE (Sweden)",
      "41": "CH (Switzerland)",
      "48": "PL (Poland)",
      "380": "UA (Ukraine)",
      "972": "IL (Israel)",
      "971": "AE (UAE)",
      "966": "SA (Saudi Arabia)",
      "90": "TR (Turkey)",
      "62": "ID (Indonesia)",
      "63": "PH (Philippines)",
      "66": "TH (Thailand)",
      "84": "VN (Vietnam)",
      "880": "BD (Bangladesh)",
      "92": "PK (Pakistan)",
      "20": "EG (Egypt)",
      "234": "NG (Nigeria)",
      "27": "ZA (South Africa)",
    };
    let countryCode = "";
    let countryName = "unknown";
    if (normalized.startsWith("+")) {
      const digits = normalized.slice(1);
      // Try 3-digit, then 2-digit, then 1-digit CCs
      for (const len of [3, 2, 1]) {
        const cc = digits.slice(0, len);
        if (ccMap[cc]) {
          countryCode = `+${cc}`;
          countryName = ccMap[cc];
          break;
        }
      }
    }
    findings.push(finding(
      `Phone Intel: ${target} — normalized: ${normalized} — country code: ${countryCode || "?"} — country: ${countryName} — format: ${normalized.startsWith("+") ? "E.164 (international)" : "national/local format"}`,
      `https://en.wikipedia.org/wiki/Telephone_numbering_plan`,
      0.8
    ));

    // Type classification
    const digitCount = (normalized.match(/\d/g) || []).length;
    let phoneType = "unknown";
    if (digitCount === 7) phoneType = "local (7-digit, typically landline in NANP)";
    else if (digitCount === 10) phoneType = "national (10-digit)";
    else if (digitCount > 10 && normalized.startsWith("+")) phoneType = "international E.164";
    findings.push(finding(`Phone type: ${phoneType} (${digitCount} digits)`, "https://en.wikipedia.org/wiki/North_American_Numbering_Plan", 0.7));

    // Area code lookup for NANP
    if (normalized.match(/^\+?1\d{10}$/)) {
      const areaCode = normalized.slice(normalized.startsWith("+") ? 2 : 1, normalized.startsWith("+") ? 5 : 4);
      findings.push(finding(`NANP area code: ${areaCode} — lookup: https://en.wikipedia.org/wiki/Area_codes_${areaCode}`, `https://en.wikipedia.org/wiki/List_of_North_American_Numbering_Plan_area_codes`, 0.7));
    }

    return buildSuccess("phoneinfo", sourceLabel, target, findings, Date.now() - start, { normalized, countryCode, countryName, phoneType });
  } catch (e) {
    return buildError("phoneinfo", sourceLabel, target, e instanceof Error ? e.message : "Phone Intel failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: URL Intelligence
// ============================================

// HTTP headers + security check via direct fetch — FREE.
export async function queryHTTPHeaders(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "HTTP Headers";
  try {
    let url = target;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }
    const res = await rateLimitedFetch("httpheaders", url, { method: "GET", redirect: "follow" }, 12000);
    const findings: NormalizedFinding[] = [];
    findings.push(finding(`HTTP status: ${res.status} ${res.statusText} — final URL: ${res.url || url}`, res.url || url, 0.9));
    // Inspect security headers
    const securityHeaders = ["content-security-policy", "strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "x-xss-protection"];
    const present: string[] = [];
    const missing: string[] = [];
    for (const h of securityHeaders) {
      const v = res.headers.get(h);
      if (v) {
        present.push(`${h}: ${v.slice(0, 100)}`);
      } else {
        missing.push(h);
      }
    }
    if (present.length) findings.push(finding(`Security headers present:\n${present.join("\n")}`, url, 0.85));
    if (missing.length) findings.push(finding(`⚠ Missing security headers: ${missing.join(", ")}`, url, 0.75));
    // Server + tech
    const server = res.headers.get("server");
    if (server) findings.push(finding(`Server: ${server}`, url, 0.85));
    const poweredBy = res.headers.get("x-powered-by");
    if (poweredBy) findings.push(finding(`X-Powered-By: ${poweredBy}`, url, 0.8));
    // Content-Type
    const ct = res.headers.get("content-type");
    if (ct) findings.push(finding(`Content-Type: ${ct}`, url, 0.7));
    return buildSuccess("httpheaders", sourceLabel, target, findings, Date.now() - start, { status: res.status, present, missing });
  } catch (e) {
    return buildError("httpheaders", sourceLabel, target, e instanceof Error ? e.message : "HTTP headers failed", Date.now() - start);
  }
}

// robots.txt + sitemap.xml — FREE.
export async function queryRobotsSitemap(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "robots.txt + sitemap";
  try {
    let base = target;
    if (base.startsWith("http://") || base.startsWith("https://")) {
      const u = new URL(base);
      base = u.origin;
    } else if (PATTERNS.DOMAIN_RE.test(base)) {
      base = `https://${base}`;
    } else {
      return buildSuccess("robotssitemap", sourceLabel, target, [finding(`robots.txt: Target is not a URL or domain`, "https://www.robotstxt.org", 0.3)], Date.now() - start);
    }
    const findings: NormalizedFinding[] = [];
    // robots.txt
    try {
      const robotsRes = await rateLimitedFetch("robotssitemap", `${base}/robots.txt`, {}, 8000);
      if (robotsRes.ok) {
        const txt = await robotsRes.text();
        const lines = txt.split("\n").filter((l) => l.trim());
        const disallowed = lines.filter((l) => /^disallow:/i.test(l)).slice(0, 10);
        const allowed = lines.filter((l) => /^allow:/i.test(l)).slice(0, 5);
        const sitemaps = lines.filter((l) => /^sitemap:/i.test(l));
        findings.push(finding(`robots.txt: ${lines.length} directives — Disallow: ${disallowed.length} paths, Allow: ${allowed.length} paths`, `${base}/robots.txt`, 0.85));
        if (sitemaps.length) findings.push(finding(`robots.txt sitemap references:\n${sitemaps.join("\n")}`, `${base}/robots.txt`, 0.9));
        if (disallowed.length) findings.push(finding(`robots.txt disallowed paths (interesting for OSINT):\n${disallowed.join("\n")}`, `${base}/robots.txt`, 0.8));
      } else {
        findings.push(finding(`robots.txt: HTTP ${robotsRes.status} (no robots.txt or inaccessible)`, `${base}/robots.txt`, 0.5));
      }
    } catch { /* ignore */ }

    // sitemap.xml
    try {
      const sitemapRes = await rateLimitedFetch("robotssitemap", `${base}/sitemap.xml`, {}, 8000);
      if (sitemapRes.ok) {
        const txt = await sitemapRes.text();
        const urlMatches = txt.match(/<loc>([^<]+)<\/loc>/g) || [];
        const urls = urlMatches.slice(0, 10).map((m) => m.replace(/<\/?loc>/g, ""));
        findings.push(finding(`sitemap.xml: ${urlMatches.length} URLs indexed — first 10:\n${urls.join("\n")}`, `${base}/sitemap.xml`, 0.85));
      } else {
        findings.push(finding(`sitemap.xml: HTTP ${sitemapRes.status} (no sitemap or inaccessible)`, `${base}/sitemap.xml`, 0.5));
      }
    } catch { /* ignore */ }

    if (findings.length === 0) findings.push(finding(`robots/sitemap: No data found for ${base}`, base, 0.4));
    return buildSuccess("robotssitemap", sourceLabel, target, findings, Date.now() - start, { base });
  } catch (e) {
    return buildError("robotssitemap", sourceLabel, target, e instanceof Error ? e.message : "robots/sitemap failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: News Intelligence
// ============================================

// GDELT Project — FREE, no key. Global news event extraction.
export async function queryGDELT(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "GDELT Project";
  try {
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(target)}&mode=ArtList&maxrecords=10&format=json&sort=DateDesc`;
    const res = await rateLimitedFetch("gdelt", url, {}, 12000);
    if (!res.ok) return buildError("gdelt", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const articles = Array.isArray(data.articles) ? data.articles : [];
    const findings: NormalizedFinding[] = articles.slice(0, 7).map((a: Record<string, unknown>) => {
      const title = a.title || "?";
      const domain = a.domain || "?";
      const date = a.seendate || "?";
      const lang = a.language || "?";
      const url2 = a.url || "";
      const socialimage = a.socialimage || "";
      return finding(
        `GDELT news: "${title}" — ${domain} (${date}, lang: ${lang})${socialimage ? ` — image: ${socialimage}` : ""}`,
        String(url2 || `https://www.gdeltproject.org/`),
        0.85
      );
    });
    if (findings.length === 0) findings.push(finding(`GDELT: No news articles found for "${target}"`, "https://www.gdeltproject.org/", 0.5));
    return buildSuccess("gdelt", sourceLabel, target, findings, Date.now() - start, { article_count: articles.length });
  } catch (e) {
    return buildError("gdelt", sourceLabel, target, e instanceof Error ? e.message : "GDELT failed", Date.now() - start);
  }
}

// Google News RSS — FREE, no key. Recent news mentions.
export async function queryGoogleNews(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Google News RSS";
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(target)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await rateLimitedFetch("googlenews", url, { headers: { Accept: "application/rss+xml, application/xml, text/xml" } }, 12000);
    if (!res.ok) return buildError("googlenews", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const xml = await res.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    const findings: NormalizedFinding[] = items.slice(0, 7).map((item) => {
      const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
      const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = item.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const title = titleMatch ? titleMatch[1].trim() : "?";
      const link = linkMatch ? linkMatch[1].trim() : "";
      const date = dateMatch ? dateMatch[1].trim() : "?";
      const src = sourceMatch ? sourceMatch[1].trim() : "?";
      return finding(
        `Google News: "${title}" — ${src} — ${date}`,
        link || "https://news.google.com",
        0.85
      );
    });
    if (findings.length === 0) findings.push(finding(`Google News: No recent news found for "${target}"`, "https://news.google.com", 0.5));
    return buildSuccess("googlenews", sourceLabel, target, findings, Date.now() - start, { item_count: items.length });
  } catch (e) {
    return buildError("googlenews", sourceLabel, target, e instanceof Error ? e.message : "Google News failed", Date.now() - start);
  }
}

// Wikinews — FREE, no key. Searches the Wikinews archive.
export async function queryWikinews(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Wikinews";
  try {
    const url = `https://en.wikinews.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(target)}&format=json&srlimit=5&srprop=snippet`;
    const res = await rateLimitedFetch("wikinews", url, { headers: { Accept: "application/json" } }, 10000);
    if (!res.ok) return buildError("wikinews", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const hits = data?.query?.search || [];
    const findings: NormalizedFinding[] = hits.map((h: Record<string, unknown>) => {
      const snippet = String(h.snippet || "").replace(/<[^>]+>/g, "");
      return finding(
        `Wikinews: "${h.title}" — ${snippet.slice(0, 200)}`,
        `https://en.wikinews.org/wiki/${encodeURIComponent(String(h.title).replace(/ /g, "_"))}`,
        0.8
      );
    });
    if (findings.length === 0) findings.push(finding(`Wikinews: No articles found for "${target}"`, "https://en.wikinews.org", 0.5));
    return buildSuccess("wikinews", sourceLabel, target, findings, Date.now() - start, { total_hits: data?.query?.searchinfo?.totalhits || 0 });
  } catch (e) {
    return buildError("wikinews", sourceLabel, target, e instanceof Error ? e.message : "Wikinews failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Hash Intelligence
// ============================================

// MalwareBazaar hash lookup — FREE, no key. (Already exists but here for hash routing.)
export async function queryHashReputation(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Hash Reputation";
  try {
    if (!PATTERNS.HASH_RE.test(target)) {
      return buildSuccess("hashrep", sourceLabel, target, [finding(`Hash Reputation: Target is not a recognized hash format (MD5/SHA1/SHA256/SHA512)`, "https://bazaar.abuse.ch", 0.3)], Date.now() - start);
    }
    // Use MalwareBazaar API for hash lookup
    const url = "https://mb-api.abuse.ch/api/v1/";
    const res = await rateLimitedFetch("hashrep", url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `query=get_info&hash=${encodeURIComponent(target.toLowerCase())}`,
    }, 10000);
    if (!res.ok) return buildError("hashrep", sourceLabel, target, `HTTP ${res.status}`, Date.now() - start);
    const data = await res.json();
    const findings: NormalizedFinding[] = [];
    const samples = Array.isArray(data.data) ? data.data : [];
    if (data.query_status === "ok" && samples.length > 0) {
      for (const s of samples.slice(0, 5)) {
        const tags = Array.isArray(s.tags) ? s.tags.join(", ") : "none";
        findings.push(finding(
          `⚠ MalwareBazaar: Hash ${target.slice(0, 16)}... matches malware sample — signature: ${s.signature || "unknown"} — tags: ${tags} — first seen: ${s.first_seen || "?"}`,
          `https://bazaar.abuse.ch/sample/${s.sha256_hash}/`,
          0.95
        ));
        if (s.file_type) findings.push(finding(`MalwareBazaar file type: ${s.file_type}`, `https://bazaar.abuse.ch/sample/${s.sha256_hash}/`, 0.85));
        if (s.file_name) findings.push(finding(`MalwareBazaar file name: ${s.file_name}`, `https://bazaar.abuse.ch/sample/${s.sha256_hash}/`, 0.8));
      }
    } else {
      findings.push(finding(`Hash Reputation: ${target} not found in MalwareBazaar (no known malware association)`, "https://bazaar.abuse.ch", 0.7));
    }
    return buildSuccess("hashrep", sourceLabel, target, findings, Date.now() - start, { sample_count: samples.length });
  } catch (e) {
    return buildError("hashrep", sourceLabel, target, e instanceof Error ? e.message : "Hash reputation failed", Date.now() - start);
  }
}

// ============================================
// CATEGORY: Username Intelligence (extra)
// ============================================

// Username search via Wikipedia + web search (already covered by whatsmyname, here we add Wikipedia + web_search)
export async function queryUsernameSearch(target: string): Promise<SourceResult> {
  const start = Date.now();
  const sourceLabel = "Username Search";
  try {
    const username = target.startsWith("@") ? target.slice(1) : target;
    // Search Wikipedia for the username (often catches notable people with that handle)
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(username)}&format=json&srlimit=3&srprop=snippet`;
    const wikiRes = await rateLimitedFetch("usernamesearch_wiki", wikiUrl, {}, 8000);
    const findings: NormalizedFinding[] = [];
    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const hits = wikiData?.query?.search || [];
      for (const h of hits.slice(0, 3)) {
        const snippet = String(h.snippet || "").replace(/<[^>]+>/g, "");
        findings.push(finding(`Wikipedia (username "${username}"): "${h.title}" — ${snippet.slice(0, 200)}`, `https://en.wikipedia.org/wiki/${encodeURIComponent(String(h.title).replace(/ /g, "_"))}`, 0.7));
      }
    }
    // Note the platforms to check
    findings.push(finding(
      `Username "${username}" — recommended manual checks: github.com/${username}, gitlab.com/${username}, reddit.com/user/${username}, twitter.com/${username}, instagram.com/${username}, keybase.io/${username}, medium.com/@${username}, youtube.com/@${username}, tiktok.com/@${username}, telegram.me/${username}`,
      `https://whatsmyname.app`,
      0.6
    ));
    return buildSuccess("usernamesearch", sourceLabel, target, findings, Date.now() - start, { username });
  } catch (e) {
    return buildError("usernamesearch", sourceLabel, target, e instanceof Error ? e.message : "Username search failed", Date.now() - start);
  }
}
