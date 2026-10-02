// Discovery Chain Registry — defines what entity types can be discovered from each entity type.
// Each chain link specifies: fromType → toType + which sources can discover it.
//
// This is the "recipe" for recursive expansion. The discovery engine follows these chains
// to automatically expand the investigation tree.
//
// Example chains:
//   domain → [crt.sh, doh, dns_google] → subdomains, IPs, certificates
//   ip → [ipinfo, bgpview, shodan_internetdb] → domains, ASN, certificates
//   email → [emailmx, gravatar, web_search] → domains, social profiles
//   person → [github, web_search, wikipedia] → domains, emails, social accounts
//   organization → [opencorporates, gleif, edgar] → domains, people, certificates

import type { InputType } from "../types";
import type { SourceKey } from "../router";
import type { DiscoveryChainLink } from "./discovery-types";

// =====================
// Discovery Chain Definitions
// =====================

/** All discovery chain links, keyed by fromType. */
export const DISCOVERY_CHAINS: DiscoveryChainLink[] = [
  // =====================
  // domain → downstream
  // =====================
  {
    fromType: "domain",
    toType: "domain",
    sources: ["crtsh", "domainsdb", "wayback"],
    description: "Discover subdomains and related domains via certificate transparency, domain databases, and archives",
  },
  {
    fromType: "domain",
    toType: "ip",
    sources: ["doh", "dns_google", "ipinfo"],
    description: "Resolve domain to IP addresses via DNS and geolocation",
  },
  {
    fromType: "domain",
    toType: "email",
    sources: ["emailmx", "doh"],
    description: "Discover email infrastructure (MX records) and contact emails",
  },
  {
    fromType: "domain",
    toType: "organization",
    sources: ["openrdap", "opencorporates", "gleif"],
    description: "Identify the organization that owns/registered the domain",
  },
  {
    fromType: "domain",
    toType: "cve",
    sources: ["nvd", "otx", "threatfox"],
    description: "Find vulnerabilities associated with the domain's infrastructure",
  },
  {
    fromType: "domain",
    toType: "url",
    sources: ["urlscan", "urlhaus", "wayback"],
    description: "Find URLs hosted on or associated with the domain",
  },

  // =====================
  // ip → downstream
  // =====================
  {
    fromType: "ip",
    toType: "domain",
    sources: ["ipinfo", "threat_intel", "otx"],
    description: "Reverse DNS: find domains hosted on this IP",
  },
  {
    fromType: "ip",
    toType: "organization",
    sources: ["ipinfo", "bgpview", "peeringdb"],
    description: "Identify the ASN/organization that owns this IP",
  },
  {
    fromType: "ip",
    toType: "cve",
    sources: ["shodan_internetdb", "otx", "nvd"],
    description: "Find vulnerabilities based on open ports and services",
  },
  {
    fromType: "ip",
    toType: "domain",
    sources: ["crtsh"],
    description: "Find domains sharing certificates with this IP",
  },

  // =====================
  // email → downstream
  // =====================
  {
    fromType: "email",
    toType: "domain",
    sources: ["emailmx", "doh", "dns_google"],
    description: "Extract and investigate the email's domain (MX, SPF, DMARC)",
  },
  {
    fromType: "email",
    toType: "person",
    sources: ["gravatar", "web_search", "wikipedia"],
    description: "Identify the person associated with this email",
  },
  {
    fromType: "email",
    toType: "username",
    sources: ["gravatar", "whatsmyname"],
    description: "Extract usernames from email local part and Gravatar profile",
  },

  // =====================
  // person → downstream
  // =====================
  {
    fromType: "person",
    toType: "username",
    sources: ["whatsmyname", "usernamesearch", "github"],
    description: "Find usernames/social accounts for this person",
  },
  {
    fromType: "person",
    toType: "domain",
    sources: ["web_search", "github", "wikipedia"],
    description: "Find personal websites or domains associated with this person",
  },
  {
    fromType: "person",
    toType: "email",
    sources: ["web_search", "github", "hackernews"],
    description: "Find email addresses associated with this person",
  },
  {
    fromType: "person",
    toType: "organization",
    sources: ["wikipedia", "web_search", "opencorporates"],
    description: "Find organizations this person is associated with",
  },

  // =====================
  // organization → downstream
  // =====================
  {
    fromType: "organization",
    toType: "domain",
    sources: ["crtsh", "web_search", "opencorporates"],
    description: "Find domains owned by this organization",
  },
  {
    fromType: "organization",
    toType: "person",
    sources: ["edgar", "opencorporates", "web_search"],
    description: "Find executives, founders, and key people",
  },
  {
    fromType: "organization",
    toType: "email",
    sources: ["web_search", "edgar"],
    description: "Find contact email addresses",
  },
  {
    fromType: "organization",
    toType: "cve",
    sources: ["nvd", "otx"],
    description: "Find vulnerabilities in the organization's software/products",
  },

  // =====================
  // username → downstream
  // =====================
  {
    fromType: "username",
    toType: "person",
    sources: ["github", "gitlab", "wikipedia"],
    description: "Identify the real person behind this username",
  },
  {
    fromType: "username",
    toType: "domain",
    sources: ["github", "web_search", "reddit"],
    description: "Find personal websites or domains linked to this username",
  },
  {
    fromType: "username",
    toType: "email",
    sources: ["github", "web_search"],
    description: "Find email addresses associated with this username",
  },

  // =====================
  // wallet → downstream
  // =====================
  {
    fromType: "wallet",
    toType: "wallet",
    sources: ["etherscan", "blockchair", "blockstream"],
    description: "Find counterparty wallets via transaction analysis",
  },
  {
    fromType: "wallet",
    toType: "domain",
    sources: ["web_search", "otx"],
    description: "Find domains associated with this wallet (exchange, service)",
  },

  // =====================
  // cve → downstream
  // =====================
  {
    fromType: "cve",
    toType: "cve",
    sources: ["nvd", "osv"],
    description: "Find related CVEs (same product, same vulnerability type)",
  },
  {
    fromType: "cve",
    toType: "organization",
    sources: ["cveorg", "nvd", "web_search"],
    description: "Identify the vendor/organization affected by this CVE",
  },

  // =====================
  // phone → downstream
  // =====================
  {
    fromType: "phone",
    toType: "person",
    sources: ["web_search", "hackernews"],
    description: "Identify the person associated with this phone number",
  },
  {
    fromType: "phone",
    toType: "organization",
    sources: ["web_search"],
    description: "Find organizations associated with this phone number",
  },

  // =====================
  // url → downstream
  // =====================
  {
    fromType: "url",
    toType: "domain",
    sources: ["httpheaders", "robotssitemap"],
    description: "Extract the domain from the URL",
  },
  {
    fromType: "url",
    toType: "ip",
    sources: ["ipinfo", "threat_intel"],
    description: "Resolve the URL's host to an IP address",
  },

  // =====================
  // hash → downstream
  // =====================
  {
    fromType: "hash",
    toType: "cve",
    sources: ["malwarebazaar", "threatfox", "otx"],
    description: "Find CVEs associated with this malware hash",
  },
  {
    fromType: "hash",
    toType: "url",
    sources: ["malwarebazaar", "urlhaus"],
    description: "Find URLs where this malware hash was observed",
  },
];

// =====================
// Chain Lookup Functions
// =====================

/**
 * Get all discovery chain links for a given entity type.
 * @param type The entity type to expand.
 * @returns All chain links that start from this type.
 */
export function getChainsForType(type: Exclude<InputType, "auto">): DiscoveryChainLink[] {
  return DISCOVERY_CHAINS.filter((c) => c.fromType === type);
}

/**
 * Get all discoverable entity types from a given type.
 * @param type The entity type to expand.
 * @returns Array of discoverable types.
 */
export function getDiscoverableTypes(type: Exclude<InputType, "auto">): Exclude<InputType, "auto">[] {
  const chains = getChainsForType(type);
  const types = new Set<Exclude<InputType, "auto">>();
  for (const c of chains) {
    types.add(c.toType);
  }
  return [...types];
}

/**
 * Get the sources that can discover a specific target type from a source type.
 * @param fromType The source entity type.
 * @param toType The target entity type.
 * @returns Array of source keys.
 */
export function getSourcesForChain(
  fromType: Exclude<InputType, "auto">,
  toType: Exclude<InputType, "auto">
): SourceKey[] {
  const chain = DISCOVERY_CHAINS.find((c) => c.fromType === fromType && c.toType === toType);
  return chain?.sources || [];
}

/**
 * Get a human-readable description of what can be discovered from a type.
 * @param type The entity type.
 * @returns Description string.
 */
export function getChainDescription(type: Exclude<InputType, "auto">): string {
  const chains = getChainsForType(type);
  if (chains.length === 0) return "No discovery chains defined for this type.";
  const targetTypes = chains.map((c) => `${c.toType}s (${c.sources.length} sources)`).join(", ");
  return `Can discover: ${targetTypes}`;
}
