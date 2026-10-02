# OSINTiger — API Key Setup Guide

This document lists all OSINT sources integrated into OSINTiger that require an API key
or account registration. All sources listed here have **free tiers** sufficient for
personal/research use. To enable any of them, set the corresponding environment variable
in `.env.local` at the project root.

Sources **not** listed here are already fully functional with no key (60+ free APIs).

---

## How to add a key

1. Sign up at the provider's site (links below).
2. Copy your API key.
3. Add a line to `.env.local`:
   ```bash
   ABUSEIPDB_API_KEY=your_key_here
   ```
4. Restart the dev server (`bun run dev`).

OSINTiger reads these env vars at query time and gracefully skips the source if the key
is missing or invalid.

---

## Threat Intelligence & Reputation

### AbuseIPDB
- **Env var:** `ABUSEIPDB_API_KEY`
- **Sign up:** https://www.abuseipdb.com/account
- **Free tier:** 1000 checks/day
- **Endpoint:** `GET https://api.abuseipdb.com/api/v2/check?ipAddress={ip}`
- **Returns:** Abuse confidence score, ISP, usage type, country, reports count
- **OSINT value:** IP reputation — identifies malicious IPs reported by the community

### VirusTotal
- **Env var:** `VIRUSTOTAL_API_KEY`
- **Sign up:** https://www.virustotal.com/gui/my-apikey
- **Free tier:** 4 requests/minute, 500/day
- **Endpoint:** `GET https://www.virustotal.com/api/v3/ip_addresses/{ip}`
- **Returns:** Multi-engine scan results, community score, categories, related URLs
- **OSINT value:** Aggregated malware detection across 70+ engines

### AlienVault OTX (optional — works without key but higher limits with one)
- **Env var:** `OTX_API_KEY`
- **Sign up:** https://otx.alienvault.com/api
- **Free tier:** Unlimited with key (lower without)
- **Endpoint:** `GET https://otx.alienvault.com/api/v1/indicators/indicator/{type}/{value}/general`
- **Returns:** Pulse indicators, threat intel reports, related IOCs
- **OSINT value:** Community-driven threat intel pulses

### GreyNoise Enterprise (optional — community tier already integrated)
- **Env var:** `GREYNOISE_API_KEY`
- **Sign up:** https://www.greynoise.io/viz/apikeys
- **Free tier:** Community (no key) — already integrated; Enterprise requires paid key
- **Endpoint:** `GET https://api.greynoise.io/v3/enterprise/{ip}`
- **Returns:** Full classification, metadata, spoofable status, actors
- **OSINT value:** Distinguish targeted scanning from internet-wide noise

---

## Domain & WHOIS Enrichment

### WhoisXML (WhoisFreaks)
- **Env var:** `WHOISFREAKS_API_KEY`
- **Sign up:** https://whoisfreaks.com/
- **Free tier:** 100 lookups/month
- **Endpoint:** `GET https://api.whoisfreaks.com/v1.0/whois?whois=live&domainName={domain}&apiKey={key}`
- **Returns:** Registrant, registrar, dates, contact info, name servers
- **OSINT value:** Domain ownership history + registrant pivot

### SecurityTrails
- **Env var:** `SECURITYTRAILS_API_KEY`
- **Sign up:** https://securitytrails.com/app/account
- **Free tier:** 50 queries/month
- **Endpoint:** `GET https://api.securitytrails.com/v1/domain/{domain}`
- **Returns:** Historical WHOIS, subdomains, associated domains, DNS history
- **OSINT value:** Historical DNS/WHOIS pivot — uncover hidden infrastructure

### BuiltWith
- **Env var:** `BUILTWITH_API_KEY`
- **Sign up:** https://api.builtwith.com/
- **Free tier:** Limited free with key
- **Endpoint:** `GET https://api.builtwith.com/v19/api.json?KEY={key}&LOOKUP={domain}`
- **Returns:** Technology stack, hosting provider, frameworks, analytics tools
- **OSINT value:** Tech stack fingerprinting for attribution

---

## Cryptocurrency & Blockchain

### Etherscan
- **Env var:** `ETHERSCAN_API_KEY`
- **Sign up:** https://etherscan.io/myapikey
- **Free tier:** 5 calls/sec, 100k/day
- **Endpoint:** `GET https://api.etherscan.io/api?module=account&action=txlist&address={addr}&apikey={key}`
- **Returns:** ETH transactions, internal txs, ERC-20 transfers, contract source
- **OSINT value:** Ethereum wallet activity tracing (already using Blockscout as free fallback)

### Blockchair (enhanced tier)
- **Env var:** `BLOCKCHAIR_API_KEY`
- **Sign up:** https://blockchair.com/api/pricing
- **Free tier:** 30 calls/min (no key), higher with key
- **Endpoint:** `GET https://api.blockchair.com/{chain}/dashboards/address/{addr}`
- **Returns:** Multi-chain balances, transactions, entity tags
- **OSINT value:** Cross-chain (BTC/ETH/XRP) wallet analysis

### Chainalysis (paid — listed for completeness)
- **Env var:** `CHAINALYSIS_API_KEY`
- **Sign up:** https://www.chainalysis.com/
- **Returns:** Wallet risk scoring, entity attribution, cluster analysis
- **OSINT value:** Industry-standard crypto attribution (paid only)

### WalletExplorer
- **Env var:** `WALLETEXPLORER_API_KEY`
- **Sign up:** https://walletexplorer.com/
- **Free tier:** Limited with key
- **Endpoint:** `GET https://api.walletexplorer.com/?q={addr}&from={offset}&count=50`
- **Returns:** BTC wallet clustering, entity labels, transaction history
- **OSINT value:** BTC wallet entity attribution

---

## Sanctions & Watchlists (Enhanced)

### UK Companies House
- **Env var:** `COMPANIES_HOUSE_API_KEY`
- **Sign up:** https://developer.company-information.service.gov.uk/
- **Free tier:** Unlimited with registration
- **Endpoint:** `GET https://api.company-information.service.gov.uk/search/companies?q={name}`
- **Returns:** UK company filings, directors, registered address, accounts
- **OSINT value:** UK corporate registry — director + filing history

### OpenCorporates (enhanced)
- **Env var:** `OPENCORPORATES_API_KEY`
- **Sign up:** https://opencorporates.com/users/sign_up
- **Free tier:** 500/month without key, 2500/month with key
- **Endpoint:** `GET https://api.opencorporates.com/v0.4/companies/search?q={name}&api_token={key}`
- **Returns:** Global company registry data, officers, filings
- **OSINT value:** Worldwide corporate registry (already integrated without key, enhanced with key)

### Refinitiv World-Check (paid — listed for completeness)
- **Env var:** `WORLDCHECK_API_KEY`
- **Returns:** PEP, sanctions, adverse media screening
- **OSINT value:** Industry-standard KYC/AML screening (paid only)

---

## Phone, Email & Identity

### Numverify
- **Env var:** `NUMVERIFY_API_KEY`
- **Sign up:** https://numverify.com/
- **Free tier:** 1000 requests/month
- **Endpoint:** `GET http://apilayer.net/api/validate?access_key={key}&number={phone}`
- **Returns:** Line type, carrier, location, valid flag
- **OSINT value:** Phone number carrier + location intelligence

### Hunter.io
- **Env var:** `HUNTER_API_KEY`
- **Sign up:** https://hunter.io/api-keys
- **Free tier:** 25 searches/month
- **Endpoint:** `GET https://api.hunter.io/v2/email-finder?domain={domain}&api_key={key}`
- **Returns:** Email patterns, verified addresses, sources
- **OSINT value:** Email enumeration from a domain

### Have I Been Pwned
- **Env var:** `HIBP_API_KEY`
- **Sign up:** https://haveibeenpwned.com/API/Key
- **Free tier:** 10 searches/month
- **Endpoint:** `GET https://haveibeenpwned.com/api/v3/breachedaccount/{email}`
- **Returns:** Breach history, compromised data types
- **OSINT value:** Breach exposure for an email address

### Veriphone
- **Env var:** `VERIPHONE_API_KEY`
- **Sign up:** https://veriphone.io/
- **Free tier:** 1000 requests/month
- **Endpoint:** `GET https://api.veriphone.io/v2/verify?phone={phone}&api_key={key}`
- **Returns:** Phone validity, carrier, line type, country
- **OSINT value:** Phone validation + carrier identification

---

## Aviation & Maritime

### ADS-B Exchange (enhanced)
- **Env var:** `ADSBEXCHANGE_API_KEY`
- **Sign up:** https://www.adsbexchange.com/data/
- **Free tier:** RapidAPI key for fast queries
- **Endpoint:** `GET https://adsbexchange-com1.p.rapidapi.com/v2/icao/{icao}/`
- **Returns:** Real-time aircraft positions, military/anonymous filtering
- **OSINT value:** Aircraft tracking with military aircraft visibility

### AirLabs
- **Env var:** `AIRLABS_API_KEY`
- **Sign up:** https://airlabs.co/
- **Free tier:** 1000 requests/month
- **Endpoint:** `GET https://airlabs.co/api/v9/schedules?dep_iata={airport}&api_key={key}`
- **Returns:** Flight schedules, delays, airline info, route data
- **OSINT value:** Flight schedule + delay intelligence

### MarineTraffic (paid — listed for completeness)
- **Env var:** `MARINETRAFFIC_API_KEY`
- **Sign up:** https://www.marinetraffic.com/en/ais-api/
- **Returns:** Vessel positions, port calls, ownership
- **OSINT value:** Maritime vessel tracking (paid only)

---

## Media & Document Intelligence

### Google Custom Search
- **Env var:** `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_ID`
- **Sign up:** https://developers.google.com/custom-search/v1/overview
- **Free tier:** 100 queries/day
- **Endpoint:** `GET https://www.googleapis.com/customsearch/v1?q={query}&key={key}&cx={id}`
- **Returns:** Search results scoped to a custom site list
- **OSINT value:** Targeted search across specific domains/sites

### Serper.dev
- **Env var:** `SERPER_API_KEY`
- **Sign up:** https://serper.dev/
- **Free tier:** 2500 credits
- **Endpoint:** `POST https://google.serper.dev/search`
- **Returns:** Google search results programmatically
- **OSINT value:** Programmatic Google search fallback

---

## Geolocation & Maps

### Google Maps Geocoding
- **Env var:** `GOOGLE_MAPS_API_KEY`
- **Sign up:** https://developers.google.com/maps/documentation/geocoding/get-api-key
- **Free tier:** $200/month credit (~40000 geocodes)
- **Endpoint:** `GET https://maps.googleapis.com/maps/api/geocode/json?address={addr}&key={key}`
- **Returns:** Precise geocoding, reverse geocoding, places
- **OSINT value:** High-precision address geocoding

### IPGeolocation.io
- **Env var:** `IPGEOLOCATION_API_KEY`
- **Sign up:** https://ipgeolocation.io/
- **Free tier:** 30000 requests/month
- **Endpoint:** `GET https://api.ipgeolocation.io/ipgeo?apiKey={key}&ip={ip}`
- **Returns:** City-level geolocation, ISP, connection type, security flags
- **OSINT value:** Higher-precision IP geolocation than free tier

---

## News & Media Intelligence

### NewsAPI
- **Env var:** `NEWSAPI_API_KEY`
- **Sign up:** https://newsapi.org/register
- **Free tier:** 100 requests/day
- **Endpoint:** `GET https://newsapi.org/v2/everything?q={query}&apiKey={key}`
- **Returns:** News articles, sources, publish times
- **OSINT value:** News article search for person/org mentions

### GDELT Project (enhanced)
- **Env var:** `GDELT_API_KEY` (optional — works without key at lower rate)
- **Sign up:** https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- **Endpoint:** `GET https://api.gdeltproject.org/api/v2/doc/doc?query={q}&format=json`
- **Returns:** Global news event extraction, tone, geography
- **OSINT value:** Global news event timeline + tone analysis

---

## Vulnerability & Exploit Intelligence

### CircleCI Vulners (enhanced)
- **Env var:** `VULNERS_API_KEY`
- **Sign up:** https://vulners.com/
- **Free tier:** Limited with key
- **Endpoint:** `GET https://vulners.com/api/v3/search/lucene/?query={query}&apikey={key}`
- **Returns:** Aggregated CVE data, exploits, patch status
- **OSINT value:** Unified vulnerability + exploit search

### VulnDB (Risk Based Security)
- **Env var:** `VULNDB_API_KEY`
- **Sign up:** https://www.rbscorp.com/
- **Returns:** Vulnerability disclosures with vendor advisories
- **OSINT value:** Vendor-disclosed vulnerability research (paid only)

---

## Government & Public Records (Enhanced)

### ProPublica Nonprofit Explorer API
- **Env var:** None — already free, no key
- **Endpoint:** `GET https://projects.propublica.org/nonprofits/api/v2/search.json?q={name}`
- **Returns:** US nonprofit filings, financials, executives
- **OSINT value:** US 501(c) nonprofit financials (no key required — already integrated)

### LittleSis
- **Env var:** `LITTLESIS_API_KEY`
- **Sign up:** https://littlesis.org/api
- **Free tier:** Available with registration
- **Endpoint:** `GET https://littlesis.org/api/v2/entities/search?q={name}`
- **Returns:** Connections between people, orgs, government
- **OSINT value:** Power-relationships network analysis

---

## Cloud & Infrastructure

### Censys
- **Env var:** `CENSYS_API_ID` + `CENSYS_API_SECRET`
- **Sign up:** https://search.censys.io/account/api
- **Free tier:** 250 queries/month
- **Endpoint:** `GET https://search.censys.io/api/v2/hosts/{ip}`
- **Returns:** Host scan data, services, certificates, banners
- **OSINT value:** Complementary to Shodan — different scan coverage

### ZoomEye
- **Env var:** `ZOOMEYE_API_KEY`
- **Sign up:** https://www.zoomeye.org/
- **Free tier:** 10000 results/month
- **Endpoint:** `GET https://api.zoomeye.org/host/search?query={ip}`
- **Returns:** Device fingerprinting, services, banners
- **OSINT value:** Chinese-origin cyberspace search engine

### BinaryEdge
- **Env var:** `BINARYEDGE_API_KEY`
- **Sign up:** https://binaryedge.io/
- **Free tier:** 20 queries/month
- **Endpoint:** `GET https://api.binaryedge.io/v2/query/ip/{ip}`
- **Returns:** Exposure data, scan events, CVEs
- **OSINT value:** Real-time exposure monitoring

---

## Summary

- **60+ sources** are fully integrated and require **no API key**.
- **30+ additional sources** are documented here with free-tier API key signup.
- Set the env vars you need in `.env.local`; sources without keys gracefully skip.
- All sources honor per-source rate limiting and graceful error handling.
