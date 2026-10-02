// Source routing engine: maps input type + script + region hints to prioritized sources.
// 60+ free OSINT API sources across 12 categories.
// Sources marked FREE require no API key. Sources marked KEY are documented in SETUP.md.

import type { DetectionResult } from "./types";

export type SourceKey =
  | "web_search"
  | "edgar"
  | "opencorporates"
  | "icij"
  | "fec"
  | "crtsh"
  | "ipinfo"
  | "threat_intel"
  | "etherscan"
  | "ofac"
  // Extended sources — Round 1 (free, no key required unless noted)
  | "wayback"
  | "bgpview"
  | "cloudflare_trace"
  | "domainsdb"
  | "doh"
  | "ipquery"
  | "genderize"
  | "agify"
  | "nationalize"
  | "hackernews"
  | "duckduckgo"
  | "peeringdb"
  | "binlist"
  | "blockchair"
  | "bitcoinabuse"
  | "urlscan"
  | "otx"
  | "nvd"
  | "abuseipdb" // KEY — returns skipped without key
  | "virustotal" // KEY — returns skipped without key
  // Extended sources — Round 2 (additional free APIs)
  | "shodan_internetdb"
  | "openrdap"
  | "greynoise"
  | "gleif"
  | "opensanctions"
  | "whatsmyname"
  | "opensky"
  | "nominatim"
  | "shodan_cvedb"
  | "threatfox"
  | "cisa_kev"
  // Expanded sources — Round 3 (comprehensive free OSINT coverage)
  // Threat Intel & IOC
  | "urlhaus"
  | "malwarebazaar"
  // Vulnerability Intelligence
  | "osv"
  | "cveorg"
  | "epss"
  // Sanctions & Watchlists
  | "interpol"
  // Government & Public Spending
  | "usaspending"
  // Network & DNS
  | "dns_google"
  | "ipwhois"
  | "ipapico"
  | "freeipapi"
  // Cryptocurrency (Bitcoin)
  | "blockstream"
  | "mempool"
  // Archives
  | "archiveorg"
  // Weather & Environmental
  | "openmeteo"
  // Developer & Social OSINT
  | "github"
  | "gitlab"
  | "reddit"
  | "wikipedia"
  | "stackexchange"
  | "npm"
  | "pypi"
  // Universal sources — Round 4 (email, phone, URL, hash, news)
  | "mailcheck"
  | "gravatar"
  | "emailmx"
  | "phoneinfo"
  | "httpheaders"
  | "robotssitemap"
  | "gdelt"
  | "googlenews"
  | "wikinews"
  | "hashrep"
  | "usernamesearch";

export interface SourceRoute {
  key: SourceKey;
  priority: number;
}

const ALWAYS = (priority: number): SourceRoute => ({ key: "web_search", priority });

const ROUTING: Record<
  DetectionResult["inputType"],
  (d: DetectionResult) => SourceRoute[]
> = {
  person: (d) => {
    const routes: SourceRoute[] = [
      ALWAYS(10),
      { key: "ofac", priority: 20 },
      { key: "opensanctions", priority: 21 },
      { key: "interpol", priority: 22 },
      { key: "icij", priority: 30 },
      { key: "fec", priority: 40 },
      // Extended: name analysis
      { key: "genderize", priority: 45 },
      { key: "agify", priority: 46 },
      { key: "nationalize", priority: 47 },
      // Extended: social + search
      { key: "duckduckgo", priority: 50 },
      { key: "hackernews", priority: 51 },
      { key: "whatsmyname", priority: 52 },
      // Round 3: developer + social + reference
      { key: "wikipedia", priority: 53 },
      { key: "github", priority: 54 },
      { key: "gitlab", priority: 55 },
      { key: "reddit", priority: 56 },
      { key: "stackexchange", priority: 57 },
      { key: "archiveorg", priority: 58 },
      // Round 4: news intelligence
      { key: "gdelt", priority: 60 },
      { key: "googlenews", priority: 61 },
      { key: "wikinews", priority: 62 },
    ];
    if (d.regionHints.includes("US")) routes.push({ key: "fec", priority: 35 });
    if (d.regionHints.includes("RU") || d.script === "cyrillic")
      routes.push({ key: "icij", priority: 25 });
    return routes.sort((a, b) => a.priority - b.priority);
  },
  organization: (d) => {
    const routes: SourceRoute[] = [
      { key: "opencorporates", priority: 10 },
      { key: "gleif", priority: 11 },
      { key: "edgar", priority: 15 },
      ALWAYS(20),
      { key: "icij", priority: 30 },
      { key: "ofac", priority: 35 },
      { key: "opensanctions", priority: 36 },
      { key: "interpol", priority: 37 },
      // Extended: domain/archive/threat
      { key: "duckduckgo", priority: 40 },
      { key: "hackernews", priority: 41 },
      { key: "nvd", priority: 42 },
      // Round 3: reference + gov spending
      { key: "wikipedia", priority: 43 },
      { key: "github", priority: 44 },
      { key: "usaspending", priority: 45 },
      { key: "archiveorg", priority: 46 },
      // Round 4: news intelligence
      { key: "gdelt", priority: 47 },
      { key: "googlenews", priority: 48 },
      { key: "wikinews", priority: 49 },
    ];
    if (d.regionHints.includes("US")) {
      routes.unshift({ key: "edgar", priority: 8 });
      routes.push({ key: "usaspending", priority: 12 });
    }
    return routes.sort((a, b) => a.priority - b.priority);
  },
  domain: () => [
    { key: "crtsh", priority: 5 },
    { key: "doh", priority: 6 },
    { key: "dns_google", priority: 6 },
    { key: "openrdap", priority: 7 },
    { key: "ipinfo", priority: 10 },
    { key: "threat_intel", priority: 8 },
    ALWAYS(15),
    { key: "opencorporates", priority: 25 },
    // Extended: DNS/archive/threat
    { key: "wayback", priority: 16 },
    { key: "domainsdb", priority: 17 },
    { key: "urlscan", priority: 18 },
    { key: "otx", priority: 19 },
    { key: "duckduckgo", priority: 20 },
    { key: "nvd", priority: 21 },
    { key: "virustotal", priority: 22 },
    { key: "threatfox", priority: 23 },
    // Round 3: threat intel + archives + reference
    { key: "urlhaus", priority: 24 },
    { key: "archiveorg", priority: 26 },
    { key: "wikipedia", priority: 27 },
    // Round 4: technical intel
    { key: "httpheaders", priority: 11 },
    { key: "robotssitemap", priority: 12 },
  ],
  ip: () => [
    { key: "ipinfo", priority: 5 },
    { key: "ipquery", priority: 6 },
    { key: "ipwhois", priority: 6 },
    { key: "ipapico", priority: 6 },
    { key: "freeipapi", priority: 6 },
    { key: "shodan_internetdb", priority: 7 },
    { key: "threat_intel", priority: 8 },
    { key: "bgpview", priority: 9 },
    { key: "openrdap", priority: 9 },
    { key: "greynoise", priority: 9 },
    ALWAYS(10),
    { key: "ofac", priority: 25 },
    // Extended: threat intel
    { key: "abuseipdb", priority: 11 },
    { key: "otx", priority: 12 },
    { key: "virustotal", priority: 13 },
    { key: "urlscan", priority: 14 },
    { key: "threatfox", priority: 15 },
    // Round 3: threat intel + weather
    { key: "urlhaus", priority: 16 },
    { key: "openmeteo", priority: 30 },
  ],
  wallet: () => [
    { key: "etherscan", priority: 5 },
    { key: "blockchair", priority: 6 },
    ALWAYS(10),
    { key: "ofac", priority: 20 },
    { key: "opensanctions", priority: 21 },
    // Extended: crypto threat
    { key: "bitcoinabuse", priority: 7 },
    // Round 3: BTC blockchain explorers
    { key: "blockstream", priority: 8 },
    { key: "mempool", priority: 9 },
  ],
  cve: () => [
    { key: "osv", priority: 5 },
    { key: "cveorg", priority: 6 },
    { key: "nvd", priority: 7 },
    { key: "shodan_cvedb", priority: 8 },
    { key: "epss", priority: 9 },
    { key: "cisa_kev", priority: 10 },
    { key: "threatfox", priority: 11 },
    ALWAYS(15),
    { key: "duckduckgo", priority: 20 },
    { key: "wikipedia", priority: 21 },
  ],
  email: () => [
    { key: "mailcheck", priority: 5 },
    { key: "gravatar", priority: 6 },
    { key: "emailmx", priority: 7 },
    { key: "whatsmyname", priority: 8 },
    ALWAYS(10),
    { key: "ofac", priority: 15 },
    { key: "opensanctions", priority: 16 },
    { key: "duckduckgo", priority: 20 },
    { key: "hackernews", priority: 21 },
    { key: "wikipedia", priority: 25 },
    { key: "gdelt", priority: 30 },
    { key: "googlenews", priority: 31 },
  ],
  username: () => [
    { key: "whatsmyname", priority: 5 },
    { key: "usernamesearch", priority: 6 },
    { key: "github", priority: 7 },
    { key: "gitlab", priority: 8 },
    { key: "reddit", priority: 9 },
    ALWAYS(10),
    { key: "wikipedia", priority: 15 },
    { key: "duckduckgo", priority: 20 },
    { key: "hackernews", priority: 21 },
  ],
  phone: () => [
    { key: "phoneinfo", priority: 5 },
    ALWAYS(10),
    { key: "duckduckgo", priority: 20 },
    { key: "hackernews", priority: 21 },
    { key: "wikipedia", priority: 25 },
    { key: "gdelt", priority: 30 },
    { key: "googlenews", priority: 31 },
  ],
  url: () => [
    { key: "httpheaders", priority: 5 },
    { key: "robotssitemap", priority: 6 },
    { key: "urlscan", priority: 7 },
    { key: "urlhaus", priority: 8 },
    { key: "wayback", priority: 9 },
    { key: "virustotal", priority: 10 },
    { key: "otx", priority: 11 },
    { key: "threatfox", priority: 12 },
    ALWAYS(15),
    { key: "duckduckgo", priority: 20 },
    { key: "wikipedia", priority: 25 },
    { key: "archiveorg", priority: 26 },
  ],
  hash: () => [
    { key: "hashrep", priority: 5 },
    { key: "malwarebazaar", priority: 6 },
    { key: "threatfox", priority: 7 },
    { key: "otx", priority: 8 },
    { key: "virustotal", priority: 9 },
    ALWAYS(15),
    { key: "duckduckgo", priority: 20 },
    { key: "wikipedia", priority: 25 },
  ],
};

export function routeSources(d: DetectionResult): SourceKey[] {
  const routes = ROUTING[d.inputType](d);
  const seen = new Set<SourceKey>();
  const out: SourceKey[] = [];
  for (const r of routes) {
    if (!seen.has(r.key)) {
      seen.add(r.key);
      out.push(r.key);
    }
  }
  return out;
}

export const SOURCE_LABELS: Record<SourceKey, string> = {
  web_search: "Web Search",
  edgar: "SEC EDGAR",
  opencorporates: "OpenCorporates",
  icij: "ICIJ Offshore Leaks",
  fec: "FEC Donations",
  crtsh: "crt.sh (Cert Transparency)",
  ipinfo: "IP Geo Intel",
  threat_intel: "IP Threat Intel (Shodan/Censys)",
  etherscan: "Etherscan",
  ofac: "OFAC SDN Screening",
  // Extended — Round 1
  wayback: "Wayback Machine",
  bgpview: "BGPView",
  cloudflare_trace: "Cloudflare Trace",
  domainsdb: "DomainsDB",
  doh: "DNS over HTTPS",
  ipquery: "IPQuery.io",
  genderize: "Genderize.io",
  agify: "Agify.io",
  nationalize: "Nationalize.io",
  hackernews: "HackerNews",
  duckduckgo: "DuckDuckGo",
  peeringdb: "PeeringDB",
  binlist: "Binlist",
  blockchair: "Blockchair",
  bitcoinabuse: "BitcoinAbuse",
  urlscan: "URLScan.io",
  otx: "AlienVault OTX",
  nvd: "NVD CVE",
  abuseipdb: "AbuseIPDB",
  virustotal: "VirusTotal",
  // Extended — Round 2
  shodan_internetdb: "Shodan InternetDB",
  openrdap: "OpenRDAP WHOIS",
  greynoise: "GreyNoise",
  gleif: "GLEIF LEI",
  opensanctions: "OpenSanctions",
  whatsmyname: "WhatsMyName",
  opensky: "OpenSky Network",
  nominatim: "OSM Nominatim",
  shodan_cvedb: "Shodan CVEDB",
  threatfox: "ThreatFox (abuse.ch)",
  cisa_kev: "CISA KEV",
  // Expanded — Round 3
  urlhaus: "URLhaus (abuse.ch)",
  malwarebazaar: "MalwareBazaar (abuse.ch)",
  osv: "OSV.dev (Google)",
  cveorg: "CVE.org (MITRE)",
  epss: "EPSS (FIRST.org)",
  interpol: "Interpol Red Notices",
  usaspending: "USASpending.gov",
  dns_google: "Google DNS (DoH)",
  ipwhois: "ipwho.is",
  ipapico: "ipapi.co",
  freeipapi: "freeipapi.com",
  blockstream: "Blockstream.info",
  mempool: "mempool.space",
  archiveorg: "Archive.org Search",
  openmeteo: "Open-Meteo",
  github: "GitHub",
  gitlab: "GitLab",
  reddit: "Reddit",
  wikipedia: "Wikipedia",
  stackexchange: "Stack Exchange",
  npm: "npm registry",
  pypi: "PyPI",
  // Universal — Round 4
  mailcheck: "Mailcheck.ai",
  gravatar: "Gravatar",
  emailmx: "Email MX/DNS",
  phoneinfo: "Phone Intel",
  httpheaders: "HTTP Headers",
  robotssitemap: "robots.txt + sitemap",
  gdelt: "GDELT Project",
  googlenews: "Google News RSS",
  wikinews: "Wikinews",
  hashrep: "Hash Reputation",
  usernamesearch: "Username Search",
};

export const SOURCE_URLS: Record<SourceKey, string> = {
  web_search: "https://www.google.com",
  edgar: "https://www.sec.gov/cgi-bin/browse-edgar",
  opencorporates: "https://opencorporates.com",
  icij: "https://offshoreleaks.icij.org/",
  fec: "https://api.open.fec.gov/v1",
  crtsh: "https://crt.sh/",
  ipinfo: "https://ipinfo.io",
  threat_intel: "https://www.shodan.io",
  etherscan: "https://etherscan.io",
  ofac: "https://sanctionssearch.ofac.treas.gov/",
  // Extended — Round 1
  wayback: "https://web.archive.org",
  bgpview: "https://bgpview.io",
  cloudflare_trace: "https://1.1.1.1/cdn-cgi/trace",
  domainsdb: "https://domainsdb.info",
  doh: "https://1.1.1.1",
  ipquery: "https://ipquery.io",
  genderize: "https://genderize.io",
  agify: "https://agify.io",
  nationalize: "https://nationalize.io",
  hackernews: "https://news.ycombinator.com",
  duckduckgo: "https://duckduckgo.com",
  peeringdb: "https://www.peeringdb.com",
  binlist: "https://binlist.net",
  blockchair: "https://blockchair.com",
  bitcoinabuse: "https://www.bitcoinabuse.com",
  urlscan: "https://urlscan.io",
  otx: "https://otx.alienvault.com",
  nvd: "https://nvd.nist.gov",
  abuseipdb: "https://www.abuseipdb.com",
  virustotal: "https://www.virustotal.com",
  // Extended — Round 2
  shodan_internetdb: "https://internetdb.shodan.io",
  openrdap: "https://rdap.org",
  greynoise: "https://viz.greynoise.io",
  gleif: "https://search.gleif.org",
  opensanctions: "https://opensanctions.org",
  whatsmyname: "https://whatsmyname.app",
  opensky: "https://opensky-network.org",
  nominatim: "https://nominatim.openstreetmap.org",
  shodan_cvedb: "https://cvedb.shodan.io",
  threatfox: "https://threatfox.abuse.ch",
  cisa_kev: "https://www.cisa.gov/kev",
  // Expanded — Round 3
  urlhaus: "https://urlhaus.abuse.ch",
  malwarebazaar: "https://bazaar.abuse.ch",
  osv: "https://osv.dev",
  cveorg: "https://www.cve.org",
  epss: "https://www.first.org/epss",
  interpol: "https://www.interpol.int/en/How-we-work/Notices/Red-Notices",
  usaspending: "https://www.usaspending.gov",
  dns_google: "https://dns.google",
  ipwhois: "https://ipwho.is",
  ipapico: "https://ipapi.co",
  freeipapi: "https://freeipapi.com",
  blockstream: "https://blockstream.info",
  mempool: "https://mempool.space",
  archiveorg: "https://archive.org",
  openmeteo: "https://open-meteo.com",
  github: "https://github.com",
  gitlab: "https://gitlab.com",
  reddit: "https://www.reddit.com",
  wikipedia: "https://en.wikipedia.org",
  stackexchange: "https://stackoverflow.com",
  npm: "https://www.npmjs.com",
  pypi: "https://pypi.org",
  // Universal — Round 4
  mailcheck: "https://mailcheck.ai",
  gravatar: "https://gravatar.com",
  emailmx: "https://dns.google",
  phoneinfo: "https://en.wikipedia.org/wiki/E.164",
  httpheaders: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers",
  robotssitemap: "https://www.robotstxt.org",
  gdelt: "https://www.gdeltproject.org",
  googlenews: "https://news.google.com",
  wikinews: "https://en.wikinews.org",
  hashrep: "https://bazaar.abuse.ch",
  usernamesearch: "https://whatsmyname.app",
};
