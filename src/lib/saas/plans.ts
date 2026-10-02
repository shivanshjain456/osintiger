// SaaS Plan Catalog — the commercial pricing & feature configuration.
// This is the single source of truth for plan tiers, prices, limits, and
// feature flags. Seeded into the SubscriptionPlan table on startup.
//
// Design rationale:
// - Free tier: enough to onboard and run 3 real investigations, but AI credits
//   are scarce (10/mo) so synthesis-heavy work hits the wall fast.
// - Investigator ($49): a solo professional's daily driver — full source set,
//   all 5 modes, generous AI credits, markdown/JSON export.
// - Professional ($149): adds API access, PDF/STIX exports, automation, 1yr
//   retention — for consultants who bill clients for reports.
// - Team ($499): 10 seats, shared KB/collections, white-label, Slack support.
// - Enterprise: custom everything, SSO, dedicated CSM.

export type PlanTier = "free" | "investigator" | "professional" | "team" | "enterprise";

export interface PlanLimits {
  investigationsPerMonth: number;   // -1 = unlimited
  aiCreditsPerMonth: number;
  maxTargetsPerInvestigation: number;
  maxConcurrency: number;
  retentionDays: number;
  sources: "basic" | "all" | "all_priority";
  modes: string[];                  // which investigation modes
  exports: string[];                // which export formats
  apiAccess: boolean;
  apiRequestsPerMonth: number;
  maxSeats: number;
  maxCollections: number;
  maxBookmarks: number;
  automationEnabled: boolean;
  whiteLabelReports: boolean;
  customSources: boolean;
  ssoEnabled: boolean;
  prioritySupport: boolean;
  dedicatedCsm: boolean;
  monitoringTargets: number;
  maxAgentIterations: number;
  maxDiscoveryDepth: number;
  multiAgentDebate: boolean;
  visualIntelligence: boolean;
  cryptoTracing: boolean;
  batchSanctions: boolean;
}

export interface PlanMarketing {
  features: string[];   // human-readable feature bullets for the pricing page
  highlight: string[];  // key differentiators
}

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  tagline: string;
  description: string;
  priceMonthly: number;   // USD cents
  priceAnnual: number;    // USD cents (billed annually)
  isFeatured: boolean;
  sortOrder: number;
  cta: string;
  limits: PlanLimits;
  marketing: PlanMarketing;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    tier: "free",
    name: "Free",
    tagline: "For learning & light investigation",
    description: "Get started with OSINTiger. Run real investigations with 20 basic sources and standard AI synthesis.",
    priceMonthly: 0,
    priceAnnual: 0,
    isFeatured: false,
    sortOrder: 1,
    cta: "Start Free",
    limits: {
      investigationsPerMonth: 3,
      aiCreditsPerMonth: 10,
      maxTargetsPerInvestigation: 1,
      maxConcurrency: 1,
      retentionDays: 7,
      sources: "basic",
      modes: ["standard"],
      exports: [],
      apiAccess: false,
      apiRequestsPerMonth: 0,
      maxSeats: 1,
      maxCollections: 3,
      maxBookmarks: 25,
      automationEnabled: false,
      whiteLabelReports: false,
      customSources: false,
      ssoEnabled: false,
      prioritySupport: false,
      dedicatedCsm: false,
      monitoringTargets: 0,
      maxAgentIterations: 0,
      maxDiscoveryDepth: 0,
      multiAgentDebate: false,
      visualIntelligence: false,
      cryptoTracing: false,
      batchSanctions: true,
    },
    marketing: {
      features: [
        "3 investigations / month",
        "10 AI synthesis credits",
        "20 basic OSINT sources",
        "Standard 8-step pipeline",
        "7-day history retention",
        "Batch sanctions screening",
        "Community support",
      ],
      highlight: ["Real investigations, not a demo"],
    },
  },
  {
    tier: "investigator",
    name: "Investigator",
    tagline: "For independent OSINT professionals",
    description: "Full source access, all investigation modes, AI synthesis, and exports for solo practitioners.",
    priceMonthly: 4900,
    priceAnnual: 49000,
    isFeatured: true,
    sortOrder: 2,
    cta: "Start 14-Day Trial",
    limits: {
      investigationsPerMonth: 50,
      aiCreditsPerMonth: 200,
      maxTargetsPerInvestigation: 5,
      maxConcurrency: 3,
      retentionDays: 90,
      sources: "all",
      modes: ["standard", "agent", "discovery", "plan", "monitor"],
      exports: ["markdown", "json"],
      apiAccess: false,
      apiRequestsPerMonth: 0,
      maxSeats: 1,
      maxCollections: 25,
      maxBookmarks: 250,
      automationEnabled: false,
      whiteLabelReports: false,
      customSources: false,
      ssoEnabled: false,
      prioritySupport: false,
      dedicatedCsm: false,
      monitoringTargets: 5,
      maxAgentIterations: 15,
      maxDiscoveryDepth: 3,
      multiAgentDebate: true,
      visualIntelligence: true,
      cryptoTracing: true,
      batchSanctions: true,
    },
    marketing: {
      features: [
        "50 investigations / month",
        "200 AI credits / month",
        "All 74+ OSINT sources",
        "All 5 investigation modes",
        "Autonomous agent (15 iterations)",
        "Multi-agent debate analysis",
        "Visual intelligence (VLM)",
        "Crypto wallet tracing",
        "Markdown & JSON export",
        "90-day history retention",
        "5 live monitoring targets",
        "Email support",
      ],
      highlight: ["Everything an OSINT pro needs", "Most popular"],
    },
  },
  {
    tier: "professional",
    name: "Professional",
    tagline: "For consultants & security researchers",
    description: "API access, advanced exports, automation, and 1-year retention for billing clients and producing deliverables.",
    priceMonthly: 14900,
    priceAnnual: 149000,
    isFeatured: false,
    sortOrder: 3,
    cta: "Start 14-Day Trial",
    limits: {
      investigationsPerMonth: 200,
      aiCreditsPerMonth: 1000,
      maxTargetsPerInvestigation: 20,
      maxConcurrency: 10,
      retentionDays: 365,
      sources: "all_priority",
      modes: ["standard", "agent", "discovery", "plan", "monitor"],
      exports: ["markdown", "json", "pdf", "csv", "stix"],
      apiAccess: true,
      apiRequestsPerMonth: 10000,
      maxSeats: 3,
      maxCollections: 100,
      maxBookmarks: 1000,
      automationEnabled: true,
      whiteLabelReports: false,
      customSources: false,
      ssoEnabled: false,
      prioritySupport: true,
      dedicatedCsm: false,
      monitoringTargets: 25,
      maxAgentIterations: 30,
      maxDiscoveryDepth: 5,
      multiAgentDebate: true,
      visualIntelligence: true,
      cryptoTracing: true,
      batchSanctions: true,
    },
    marketing: {
      features: [
        "200 investigations / month",
        "1,000 AI credits / month",
        "Priority source access",
        "API access (10k requests/mo)",
        "All export formats (PDF, STIX, CSV)",
        "Automation & scheduled investigations",
        "1-year history retention",
        "3 seats included",
        "25 monitoring targets",
        "Deep discovery (5 levels)",
        "Priority email support",
      ],
      highlight: ["For billing clients", "API + automation"],
    },
  },
  {
    tier: "team",
    name: "Team",
    tagline: "For security teams & consultancies",
    description: "Shared workspaces, collaboration, white-label reports, and higher limits for teams that investigate together.",
    priceMonthly: 49900,
    priceAnnual: 499000,
    isFeatured: false,
    sortOrder: 4,
    cta: "Start 14-Day Trial",
    limits: {
      investigationsPerMonth: 1000,
      aiCreditsPerMonth: 5000,
      maxTargetsPerInvestigation: 100,
      maxConcurrency: 50,
      retentionDays: 730,
      sources: "all_priority",
      modes: ["standard", "agent", "discovery", "plan", "monitor"],
      exports: ["markdown", "json", "pdf", "csv", "stix"],
      apiAccess: true,
      apiRequestsPerMonth: 100000,
      maxSeats: 10,
      maxCollections: 500,
      maxBookmarks: 5000,
      automationEnabled: true,
      whiteLabelReports: true,
      customSources: false,
      ssoEnabled: false,
      prioritySupport: true,
      dedicatedCsm: false,
      monitoringTargets: 100,
      maxAgentIterations: 50,
      maxDiscoveryDepth: 7,
      multiAgentDebate: true,
      visualIntelligence: true,
      cryptoTracing: true,
      batchSanctions: true,
    },
    marketing: {
      features: [
        "1,000 investigations / month",
        "5,000 AI credits / month",
        "10 seats included",
        "Shared workspace & KB",
        "Collaborative collections",
        "White-label reports",
        "API access (100k requests/mo)",
        "2-year history retention",
        "100 monitoring targets",
        "Slack channel support",
      ],
      highlight: ["For teams of 5-10", "Shared intelligence"],
    },
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    tagline: "For organizations & government",
    description: "Unlimited scale, SSO, custom sources, dedicated infrastructure, and a named CSM for mission-critical intelligence operations.",
    priceMonthly: 0, // custom pricing
    priceAnnual: 0,
    isFeatured: false,
    sortOrder: 5,
    cta: "Contact Sales",
    limits: {
      investigationsPerMonth: -1, // unlimited
      aiCreditsPerMonth: 50000,
      maxTargetsPerInvestigation: -1,
      maxConcurrency: -1,
      retentionDays: -1, // unlimited
      sources: "all_priority",
      modes: ["standard", "agent", "discovery", "plan", "monitor"],
      exports: ["markdown", "json", "pdf", "csv", "stix"],
      apiAccess: true,
      apiRequestsPerMonth: -1,
      maxSeats: -1,
      maxCollections: -1,
      maxBookmarks: -1,
      automationEnabled: true,
      whiteLabelReports: true,
      customSources: true,
      ssoEnabled: true,
      prioritySupport: true,
      dedicatedCsm: true,
      monitoringTargets: -1,
      maxAgentIterations: 100,
      maxDiscoveryDepth: 10,
      multiAgentDebate: true,
      visualIntelligence: true,
      cryptoTracing: true,
      batchSanctions: true,
    },
    marketing: {
      features: [
        "Unlimited investigations",
        "50,000+ AI credits / month",
        "Unlimited seats",
        "SSO / SAML integration",
        "Custom OSINT sources",
        "Dedicated infrastructure",
        "White-label & on-prem options",
        "Unlimited history retention",
        "Custom data residency",
        "Dedicated CSM & SLA",
        "Audit & compliance exports",
      ],
      highlight: ["For mission-critical ops", "Custom everything"],
    },
  },
];

// ─── AI Credit Costs — per-operation consumption rates ──────────────────────
// Credits are the internal metering currency for AI-powered operations.
// Monthly grants reset each billing period; purchased packs don't expire.

export const AI_CREDIT_COSTS = {
  synthesis: 5,          // standard report synthesis
  ach_analysis: 3,       // competing hypotheses matrix
  vlm_analysis: 10,      // vision-language model image analysis
  multi_agent_debate: 25, // 7-agent debate + coordinator
  ai_plan_generation: 15, // AI investigation plan
  gap_analysis: 8,       // intelligence gap analysis
  ai_qa: 2,              // follow-up Q&A per question
  crypto_risk: 5,        // crypto wallet AI risk assessment
  social_intelligence: 12, // social media intelligence synthesis
  threat_assessment: 6,  // AI threat assessment
} as const;

export type AIOperation = keyof typeof AI_CREDIT_COSTS;

// ─── Add-on credit packs available for purchase ─────────────────────────────

export interface CreditPack {
  id: string;
  credits: number;
  priceCents: number;
  name: string;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_100", credits: 100, priceCents: 1500, name: "100 Credits" },
  { id: "pack_500", credits: 500, priceCents: 6000, name: "500 Credits", popular: true },
  { id: "pack_2000", credits: 2000, priceCents: 20000, name: "2,000 Credits" },
  { id: "pack_10000", credits: 10000, priceCents: 90000, name: "10,000 Credits" },
];

// ─── Helper: format price in cents to display string ────────────────────────

export function formatPrice(cents: number, cycle?: "monthly" | "annual"): string {
  if (cents === 0) return "Custom";
  const dollars = (cents / 100).toFixed(2).replace(/\.00$/, "");
  const suffix = cycle === "annual" ? "/yr" : "/mo";
  return `$${dollars}${suffix}`;
}

export function getPlanDefinition(tier: PlanTier): PlanDefinition | undefined {
  return PLAN_DEFINITIONS.find((p) => p.tier === tier);
}

export function isUnlimited(value: number): boolean {
  return value === -1;
}
