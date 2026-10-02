// Source Runner — the shared source dispatch function.
// Extracted from pipeline.ts to avoid circular dependencies.
// Both the fixed pipeline and the autonomous agent use this module
// to execute source queries by SourceKey.

import type { DetectionResult, SourceResult } from "./types";
import type { SourceKey } from "./router";
import { SOURCE_LABELS } from "./router";
import { queryWebSearch } from "./sources/web-search";
import { queryCrtSh } from "./sources/crtsh";
import { queryIpInfo, resolveDomain } from "./sources/ipinfo";
import { queryThreatIntel } from "./sources/threat-intel";
import { queryEdgar } from "./sources/edgar";
import { queryIcij } from "./sources/icij";
import { queryOpenCorporates } from "./sources/opencorporates";
import { queryFec } from "./sources/fec";
import { queryOfac } from "./sources/ofac";
import {
  queryWayback,
  queryBGPView,
  queryCloudflareTrace,
  queryDomainsDB,
  queryDoH,
  queryIPQuery,
  queryGenderize,
  queryAgify,
  queryNationalize,
  queryHackerNews,
  queryDuckDuckGo,
  queryPeeringDB,
  queryBinlist,
  queryBlockchair,
  queryBitcoinAbuse,
  queryURLScan,
  queryOTX,
  queryNVD,
  queryAbuseIPDB,
  queryVirusTotal,
} from "./sources/extended";
import {
  queryShodanInternetDB,
  queryOpenRDAP,
  queryGreyNoise,
  queryGLEIF,
  queryOpenSanctions,
  queryWhatsMyName,
  queryOpenSky,
  queryNominatim,
  queryShodanCVEDB,
  queryThreatFox,
  queryCisaKEV,
} from "./sources/extended/additional-sources";
import {
  queryURLhaus,
  queryMalwareBazaar,
  queryOSV,
  queryCVEorg,
  queryEPSS,
  queryInterpol,
  queryUSASpending,
  queryGoogleDoH,
  queryIpWhoIs,
  queryIpApiCo,
  queryFreeIpApi,
  queryBlockstream,
  queryMempool,
  queryArchiveOrg,
  queryOpenMeteo,
  queryGitHub,
  queryGitLab,
  queryReddit,
  queryWikipedia,
  queryStackExchange,
  queryNpm,
  queryPyPI,
} from "./sources/extended/expanded-sources";
import {
  queryMailcheck,
  queryGravatar,
  queryEmailMX,
  queryPhoneInfo,
  queryHTTPHeaders,
  queryRobotsSitemap,
  queryGDELT,
  queryGoogleNews,
  queryWikinews,
  queryHashReputation,
  queryUsernameSearch,
} from "./sources/extended/universal-sources";

export async function runSource(
  key: SourceKey,
  detection: DetectionResult
): Promise<SourceResult> {
  const target = detection.sanitized;
  switch (key) {
    case "web_search":
      return queryWebSearch(target, SOURCE_LABELS.web_search);
    case "crtsh":
      return queryCrtSh(target);
    case "ipinfo": {
      // For a domain, resolve to IP first then geo-lookup
      if (detection.inputType === "domain") {
        const ip = await resolveDomain(target);
        if (ip) {
          const r = await queryIpInfo(ip);
          // also include the domain→ip resolution as a finding
          r.findings.unshift({
            data: `Domain ${target} resolves to ${ip}`,
            source_url: `https://1.1.1.1/dns-query?name=${encodeURIComponent(target)}`,
            confidence: 0.92,
            timestamp: new Date().toISOString(),
          });
          return r;
        }
        return {
          source: "ipinfo",
          source_label: SOURCE_LABELS.ipinfo,
          target,
          status: "error",
          error: "Could not resolve domain to an IP address",
          findings: [],
        };
      }
      return queryIpInfo(target);
    }
    case "threat_intel":
      return queryThreatIntel(target);
    case "edgar":
      return queryEdgar(target);
    case "icij":
      return queryIcij(target);
    case "opencorporates":
      return queryOpenCorporates(target);
    case "fec":
      return queryFec(target);
    case "ofac":
      return queryOfac(target);
    case "etherscan":
      return {
        source: "etherscan",
        source_label: SOURCE_LABELS.etherscan,
        target,
        status: "skipped",
        findings: [],
      };
    // Extended sources (free, no key required unless noted)
    case "wayback":
      return queryWayback(target);
    case "bgpview":
      return queryBGPView(target);
    case "cloudflare_trace":
      return queryCloudflareTrace(target);
    case "domainsdb":
      return queryDomainsDB(target);
    case "doh":
      return queryDoH(target);
    case "ipquery":
      return queryIPQuery(target);
    case "genderize":
      return queryGenderize(target);
    case "agify":
      return queryAgify(target);
    case "nationalize":
      return queryNationalize(target);
    case "hackernews":
      return queryHackerNews(target);
    case "duckduckgo":
      return queryDuckDuckGo(target);
    case "peeringdb":
      return queryPeeringDB(target);
    case "binlist":
      return queryBinlist(target);
    case "blockchair":
      return queryBlockchair(target);
    case "bitcoinabuse":
      return queryBitcoinAbuse(target);
    case "urlscan":
      return queryURLScan(target);
    case "otx":
      return queryOTX(target);
    case "nvd":
      return queryNVD(target);
    case "abuseipdb":
      return queryAbuseIPDB(target);
    case "virustotal":
      return queryVirusTotal(target);
    // Additional free sources
    case "shodan_internetdb":
      return queryShodanInternetDB(target);
    case "openrdap":
      return queryOpenRDAP(target);
    case "greynoise":
      return queryGreyNoise(target);
    case "gleif":
      return queryGLEIF(target);
    case "opensanctions":
      return queryOpenSanctions(target);
    case "whatsmyname":
      return queryWhatsMyName(target);
    case "opensky":
      return queryOpenSky(target);
    case "nominatim":
      return queryNominatim(target);
    case "shodan_cvedb":
      return queryShodanCVEDB(target);
    case "threatfox":
      return queryThreatFox(target);
    case "cisa_kev":
      return queryCisaKEV(target);
    // Expanded sources — Round 3
    case "urlhaus":
      return queryURLhaus(target);
    case "malwarebazaar":
      return queryMalwareBazaar(target);
    case "osv":
      return queryOSV(target);
    case "cveorg":
      return queryCVEorg(target);
    case "epss":
      return queryEPSS(target);
    case "interpol":
      return queryInterpol(target);
    case "usaspending":
      return queryUSASpending(target);
    case "dns_google":
      return queryGoogleDoH(target);
    case "ipwhois":
      return queryIpWhoIs(target);
    case "ipapico":
      return queryIpApiCo(target);
    case "freeipapi":
      return queryFreeIpApi(target);
    case "blockstream":
      return queryBlockstream(target);
    case "mempool":
      return queryMempool(target);
    case "archiveorg":
      return queryArchiveOrg(target);
    case "openmeteo":
      return queryOpenMeteo(target);
    case "github":
      return queryGitHub(target);
    case "gitlab":
      return queryGitLab(target);
    case "reddit":
      return queryReddit(target);
    case "wikipedia":
      return queryWikipedia(target);
    case "stackexchange":
      return queryStackExchange(target);
    case "npm":
      return queryNpm(target);
    case "pypi":
      return queryPyPI(target);
    // Universal sources — Round 4
    case "mailcheck":
      return queryMailcheck(target);
    case "gravatar":
      return queryGravatar(target);
    case "emailmx":
      return queryEmailMX(target);
    case "phoneinfo":
      return queryPhoneInfo(target);
    case "httpheaders":
      return queryHTTPHeaders(target);
    case "robotssitemap":
      return queryRobotsSitemap(target);
    case "gdelt":
      return queryGDELT(target);
    case "googlenews":
      return queryGoogleNews(target);
    case "wikinews":
      return queryWikinews(target);
    case "hashrep":
      return queryHashReputation(target);
    case "usernamesearch":
      return queryUsernameSearch(target);
  }
}
