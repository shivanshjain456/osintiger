# OSINTiger — Manual API Key Setup Guide

## Overview
OSINTiger uses 41 OSINT sources. Most are **completely free with no API key required**.
A few sources offer free tiers that require registration for an API key.
This file lists the sources that need manual setup.

---

## Sources Requiring API Keys (Free Tiers)

### 1. AbuseIPDB — IP Abuse Reputation
- **Free tier**: 1,000 requests/day
- **Signup URL**: https://www.abuseipdb.com/account
- **Env variable**: `ABUSEIPDB_API_KEY`
- **Setup**:
  1. Create a free account at https://www.abuseipdb.com/account
  2. Go to Account → API
  3. Copy your API key
  4. Add to `.env`: `ABUSEIPDB_API_KEY=your_key_here`

### 2. VirusTotal — Malware/URL/File Scanner
- **Free tier**: 500 requests/day, 4 requests/minute
- **Signup URL**: https://www.virustotal.com/gui/my-apikey
- **Env variable**: `VIRUSTOTAL_API_KEY`
- **Setup**:
  1. Create a free account at https://www.virustotal.com
  2. Go to Profile → API Key
  3. Copy your API key
  4. Add to `.env`: `VIRUSTOTAL_API_KEY=your_key_here`

### 3. Etherscan — Ethereum Blockchain Explorer
- **Free tier**: 5 calls/second, 100,000 calls/day
- **Signup URL**: https://etherscan.io/myapikey
- **Env variable**: `ETHERSCAN_API_KEY`
- **Setup**:
  1. Create a free account at https://etherscan.io/register
  2. Go to API Keys → Add
  3. Copy your API key
  4. Add to `.env`: `ETHERSCAN_API_KEY=your_key_here`
  - **Note**: If not set, OSINTiger falls back to Blockscout (free, no key).

### 4. FEC API — US Federal Election Commission (Optional)
- **Free tier**: 1,000 requests/hour (no key required, but key increases limit)
- **Signup URL**: https://api.open.fec.gov/developers/
- **Env variable**: `FEC_API_KEY` (optional)
- **Note**: Works without a key at a lower rate limit.

---

## Sources That Work Without Any API Key (41 total)

| # | Source | Category | Key Required? |
|---|--------|----------|---------------|
| 1 | Web Search (z-ai SDK) | Search | No |
| 2 | SEC EDGAR | Corporate | No |
| 3 | OpenCorporates | Corporate | No |
| 4 | ICIJ Offshore Leaks | Leaks | No |
| 5 | FEC Donations | Finance | No (optional key) |
| 6 | crt.sh | Domain/DNS | No |
| 7 | IP Geo (ip-api.com) | Geo IP | No |
| 8 | IP Threat Intel (web_search) | Threat Intel | No |
| 9 | Etherscan/Blockscout | Crypto | No (Blockscout fallback) |
| 10 | OFAC SDN Screening | Sanctions | No |
| 11 | Wayback Machine | Archives | No |
| 12 | BGPView | Network | No |
| 13 | Cloudflare Trace | Network | No |
| 14 | DomainsDB | Domain | No |
| 15 | DNS over HTTPS | Domain/DNS | No |
| 16 | IPQuery.io | Geo IP | No |
| 17 | Genderize.io | Name Analysis | No |
| 18 | Agify.io | Name Analysis | No |
| 19 | Nationalize.io | Name Analysis | No |
| 20 | HackerNews | Social | No |
| 21 | DuckDuckGo | Search | No |
| 22 | PeeringDB | Network | No |
| 23 | Binlist | Finance | No |
| 24 | Blockchair | Crypto | No |
| 25 | BitcoinAbuse | Crypto | No |
| 26 | URLScan.io | Threat Intel | No |
| 27 | AlienVault OTX | Threat Intel | No |
| 28 | NVD CVE | Vulnerabilities | No |
| 29 | AbuseIPDB | Threat Intel | **Yes** (free: 1000/day) |
| 30 | VirusTotal | Threat Intel | **Yes** (free: 500/day) |
| 31 | Shodan InternetDB | Network/IP | No |
| 32 | OpenRDAP WHOIS | Domain/IP | No |
| 33 | GreyNoise | Threat Intel | No |
| 34 | GLEIF LEI | Corporate | No |
| 35 | OpenSanctions | Sanctions/PEP | No |
| 36 | WhatsMyName | Username | No |
| 37 | OpenSky Network | Aviation | No |
| 38 | OSM Nominatim | Geolocation | No |
| 39 | Shodan CVEDB | Vulnerabilities | No |
| 40 | ThreatFox (abuse.ch) | Threat Intel | No |
| 41 | CISA KEV | Vulnerabilities | No |

---

## Environment Variables Summary

Add these to your `.env` file (only if you want the key-required sources):

```env
# Optional — free tier API keys for enhanced sources
ABUSEIPDB_API_KEY=your_key_here
VIRUSTOTAL_API_KEY=your_key_here
ETHERSCAN_API_KEY=your_key_here
FEC_API_KEY=your_key_here
```

All other 37 sources work immediately without any configuration.
