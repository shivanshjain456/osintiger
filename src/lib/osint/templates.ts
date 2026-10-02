// Investigation templates — pre-configured source sets for common target types.
// Each template defines which sources to prioritize + a description.

export interface InvestigationTemplate {
  id: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  inputType: string;
  // Note: actual source routing is automatic by input type, but templates provide
  // pre-filled example targets + context for the user.
  exampleTargets: string[];
  color: string; // tailwind gradient class
}

export const TEMPLATES: InvestigationTemplate[] = [
  {
    id: "person-screening",
    label: "Person Screening",
    description: "Comprehensive background check on an individual — sanctions, corporate affiliations, web presence, political donations.",
    icon: "User",
    inputType: "person",
    exampleTargets: ["Vladimir Putin", "Roman Abramovich", "Daniel Kinahan"],
    color: "from-[var(--hack-green)]/10 to-[var(--hack-green)]/5",
  },
  {
    id: "corporate-intel",
    label: "Corporate Intelligence",
    description: "Deep dive on a company — SEC filings, corporate registries, offshore leaks, certificate transparency.",
    icon: "Building2",
    inputType: "organization",
    exampleTargets: ["Tesla, Inc.", "Gazprom", "PDVSA"],
    color: "from-[var(--hack-green)]/10 to-[var(--hack-cyan)]/5",
  },
  {
    id: "domain-recon",
    label: "Domain Reconnaissance",
    description: "Full domain analysis — SSL certificate history, IP geolocation, subdomain discovery, hosting provider.",
    icon: "Globe",
    inputType: "domain",
    exampleTargets: ["google.com", "cloudflare.com", "wikipedia.org"],
    color: "from-[var(--hack-cyan)]/10 to-[var(--hack-green)]/5",
  },
  {
    id: "ip-threat",
    label: "IP Threat Intelligence",
    description: "IP address investigation — geolocation, network operator, open ports, threat intel, hosting classification.",
    icon: "Network",
    inputType: "ip",
    exampleTargets: ["8.8.8.8", "1.1.1.1", "104.16.132.229"],
    color: "from-[var(--hack-red)]/10 to-[var(--hack-red)]/5",
  },
  {
    id: "crypto-trace",
    label: "Crypto Wallet Tracing",
    description: "Ethereum wallet analysis — balance, transaction history, counterparty clustering, AI risk assessment.",
    icon: "Wallet",
    inputType: "wallet",
    exampleTargets: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"],
    color: "from-[var(--hack-cyan)]/10 to-[var(--hack-cyan)]/5",
  },
  {
    id: "sanctions-check",
    label: "Sanctions Screening",
    description: "OFAC SDN fuzzy matching for names — quick compliance check against 161 curated entries.",
    icon: "ShieldAlert",
    inputType: "person",
    exampleTargets: ["Bashar Al-Assad", "Ebrahim Raisi", "Oleg Deripaska"],
    color: "from-[var(--hack-green)]/10 to-[var(--hack-green)]/5",
  },
];
