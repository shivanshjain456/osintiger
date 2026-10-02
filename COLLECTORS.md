# OSINTiger — Collector Registry

74 OSINT source collectors across 12 categories. All are **free** and require **no API key**
unless marked with 🔑 (documented in SETUP.md).

## 1. Search & Aggregation (2)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `web_search` | Web Search | z-ai-web-dev-sdk `web_search` | AI-powered web search |
| `duckduckgo` | DuckDuckGo | https://duckduckgo.com | Instant Answer API |

## 2. Domain & DNS (8)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `crtsh` | crt.sh | https://crt.sh | Certificate Transparency logs |
| `doh` | DNS over HTTPS | https://1.1.1.1 | Cloudflare DoH (A, AAAA, MX, NS, TXT) |
| `dns_google` | Google DNS | https://dns.google | Google DoH (A, AAAA, MX, NS, TXT, CNAME) |
| `openrdap` | OpenRDAP | https://rdap.org | Structured WHOIS/RDAP |
| `domainsdb` | DomainsDB | https://domainsdb.info | Domain search |
| `cloudflare_trace` | Cloudflare Trace | https://1.1.1.1/cdn-cgi/trace | CDN/colo detection |
| `httpheaders` | HTTP Headers | Direct fetch | Security headers + server tech |
| `robotssitemap` | robots.txt + sitemap | Direct fetch | Disallowed paths + sitemap URLs |

## 3. IP & Network (9)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `ipinfo` | IP Geo Intel | https://ip-api.com | Geolocation + ISP + ASN |
| `ipquery` | IPQuery.io | https://ipquery.io | IP reputation + geo |
| `ipwhois` | ipwho.is | https://ipwho.is | IP geo + ASN + connection |
| `ipapico` | ipapi.co | https://ipapi.co | IP geo + network |
| `freeipapi` | freeipapi.com | https://freeipapi.com | IP geo |
| `shodan_internetdb` | Shodan InternetDB | https://internetdb.shodan.io | Open ports + vulns (free) |
| `bgpview` | BGPView | https://bgpview.io | ASN + BGP routes |
| `peeringdb` | PeeringDB | https://www.peeringdb.com | Network peering data |
| `threat_intel` | Threat Intel | Shodan-style | IP threat scoring |

## 4. Threat Intelligence & IOC (10)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `urlhaus` | URLhaus | https://urlhaus.abuse.ch | Malicious URLs (abuse.ch) |
| `malwarebazaar` | MalwareBazaar | https://bazaar.abuse.ch | Malware samples (abuse.ch) |
| `threatfox` | ThreatFox | https://threatfox.abuse.ch | IOCs (abuse.ch) |
| `otx` | AlienVault OTX | https://otx.alienvault.com | Threat pulses |
| `urlscan` | URLScan.io | https://urlscan.io | URL scan results |
| `greynoise` | GreyNoise | https://api.greynoise.io | IP classification (community) |
| `abuseipdb` 🔑 | AbuseIPDB | https://www.abuseipdb.com | IP abuse reports |
| `virustotal` 🔑 | VirusTotal | https://www.virustotal.com | Multi-engine scan |
| `hashrep` | Hash Reputation | https://bazaar.abuse.ch | Hash → malware lookup |
| `cisa_kev` | CISA KEV | https://www.cisa.gov/kev | Known Exploited Vulnerabilities |

## 5. Vulnerability Intelligence (5)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `osv` | OSV.dev | https://api.osv.dev | Open-source vulns (Google) |
| `cveorg` | CVE.org | https://cveawg.mitre.org | Official CVE records (MITRE) |
| `nvd` | NVD CVE | https://nvd.nist.gov | NIST vulnerability DB |
| `shodan_cvedb` | Shodan CVEDB | https://cvedb.shodan.io | CVE + EPSS + KEV |
| `epss` | EPSS | https://api.first.org | Exploit prediction scoring |

## 6. Sanctions & Watchlists (4)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `ofac` | OFAC SDN | https://sanctionssearch.ofac.treas.gov | US Treasury sanctions |
| `opensanctions` | OpenSanctions | https://api.opensanctions.org | Global sanctions + PEPs |
| `interpol` | Interpol Red Notices | https://ws-public.interpol.int | Wanted persons |
| `icij` | ICIJ Offshore Leaks | https://offshoreleaks.icij.org | Offshore entity leaks |

## 7. Corporate & Government (5)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `opencorporates` | OpenCorporates | https://opencorporates.com | Global company registry |
| `gleif` | GLEIF LEI | https://api.gleif.org | Legal Entity Identifier |
| `edgar` | SEC EDGAR | https://www.sec.gov | US public company filings |
| `fec` | FEC Donations | https://api.open.fec.gov | US campaign finance |
| `usaspending` | USASpending.gov | https://api.usaspending.gov | US federal spending |

## 8. Cryptocurrency (5)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `etherscan` | Etherscan | https://etherscan.io | ETH wallet (Blockscout fallback) |
| `blockchair` | Blockchair | https://blockchair.com | Multi-chain explorer |
| `blockstream` | Blockstream | https://blockstream.info | BTC address info |
| `mempool` | mempool.space | https://mempool.space | BTC address + transactions |
| `bitcoinabuse` | BitcoinAbuse | https://www.bitcoinabuse.com | BTC abuse reports |

## 9. News & Media (4)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `gdelt` | GDELT Project | https://api.gdeltproject.org | Global news events |
| `googlenews` | Google News RSS | https://news.google.com/rss | Recent news mentions |
| `wikinews` | Wikinews | https://en.wikinews.org | Citizen journalism |
| `hackernews` | HackerNews | https://hn.algolia.com | Tech news + discussion |

## 10. Developer & Social OSINT (8)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `github` | GitHub | https://api.github.com | User profile + search |
| `gitlab` | GitLab | https://gitlab.com/api/v4 | User profile |
| `reddit` | Reddit | https://www.reddit.com | User + subreddit |
| `wikipedia` | Wikipedia | https://en.wikipedia.org/w/api.php | Article search |
| `stackexchange` | Stack Exchange | https://api.stackexchange.com | SO user search |
| `whatsmyname` | WhatsMyName | https://whatsmyname.app | Username existence check |
| `usernamesearch` | Username Search | Wikipedia + manual checks | Username OSINT |
| `archiveorg` | Archive.org | https://archive.org | Historical items |

## 11. Email & Phone Intelligence (4)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `mailcheck` | Mailcheck.ai | https://api.mailcheck.ai | Email domain MX + disposable |
| `gravatar` | Gravatar | https://gravatar.com | Email → profile (MD5 hash) |
| `emailmx` | Email MX/DNS | https://dns.google | MX + TXT + SPF + DMARC |
| `phoneinfo` | Phone Intel | Heuristic | Country code + format + type |

## 12. Archives, Location & Misc (10)

| Key | Label | Endpoint | Notes |
|-----|-------|----------|-------|
| `wayback` | Wayback Machine | https://web.archive.org | Archived snapshots |
| `nominatim` | OSM Nominatim | https://nominatim.openstreetmap.org | Geocoding |
| `opensky` | OpenSky Network | https://opensky-network.org | Aircraft tracking |
| `openmeteo` | Open-Meteo | https://open-meteo.com | Weather + geocoding |
| `genderize` | Genderize.io | https://genderize.io | Name → gender prediction |
| `agify` | Agify.io | https://agify.io | Name → age prediction |
| `nationalize` | Nationalize.io | https://nationalize.io | Name → nationality |
| `binlist` | Binlist | https://binlist.net | BIN/IIN card lookup |
| `npm` | npm registry | https://registry.npmjs.org | npm package metadata |
| `pypi` | PyPI | https://pypi.org/pypi | Python package metadata |

## Summary

- **Total sources**: 74
- **No-key free sources**: 72
- **Key-required sources**: 2 (AbuseIPDB, VirusTotal) — gracefully skip without key
- **Categories**: 12
- **Input types supported**: 11 (person, organization, domain, ip, email, username, phone, url, hash, wallet, cve)
