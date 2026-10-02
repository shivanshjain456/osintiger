// Investigation Playbooks — domain-aware operating modes (Feature 24)
//
// Each playbook encodes investigative priorities, domain-specific heuristics,
// expected evidence types, risk considerations, and reporting expectations.
// The platform dynamically selects the most relevant evidence sources, reasoning
// paths, and output formats based on the selected playbook.
//
// 10 Specialized Playbooks:
//   1. Corporate Due Diligence
//   2. Executive Background Investigation
//   3. Threat Actor Profiling
//   4. Infrastructure Reconnaissance
//   5. Brand Protection
//   6. Vendor Risk
//   7. Supply Chain Analysis
//   8. Incident Response
//   9. M&A Due Diligence
//  10. Fraud Investigation
//
// Each playbook configures 5 dimensions:
//   - Collection strategy (source prioritization, entity types, discovery paths)
//   - Prioritization (action ranking, branch exploration, pivot rules)
//   - Scoring (confidence, risk, credibility, exposure weighting)
//   - Reporting (template, executive summary style, risk lens)
//   - Workflows (step sequence, escalation, stopping conditions)

import type { SourceKey } from "./router";

// ============================================================================
// DOMAIN TYPES
// ============================================================================

export type PlaybookType =
  | "corporate_due_diligence"
  | "executive_background"
  | "threat_actor_profiling"
  | "infrastructure_recon"
  | "brand_protection"
  | "vendor_risk"
  | "supply_chain"
  | "incident_response"
  | "ma_due_diligence"
  | "fraud_investigation";

export type RiskLens =
  | "financial"
  | "operational"
  | "reputational"
  | "legal"
  | "technical"
  | "security"
  | "regulatory"
  | "strategic";

export type InvestigationStyle =
  | "broad_exploratory"    // wide net, explore many branches
  | "narrow_high_confidence" // focused, high-certainty
  | "time_sensitive"       // speed-optimized
  | "continuous_monitoring" // ongoing
  | "hypothesis_driven";   // test specific hypotheses

export interface CollectionStrategy {
  /** Sources to prioritize first (in order) */
  prioritizedSources: SourceKey[];
  /** Sources to defer until later */
  deferredSources: SourceKey[];
  /** Sources to skip entirely for this playbook */
  skippedSources: SourceKey[];
  /** Entity types to focus discovery on */
  focusEntityTypes: string[];
  /** Discovery paths to explore (e.g., "subdomains", "historical", "relationships") */
  discoveryPaths: string[];
  /** Rationale for this collection strategy */
  rationale: string;
}

export interface PrioritizationConfig {
  /** Weight for expected utility in action ranking (0-1) */
  utilityWeight: number;
  /** Weight for confidence gain */
  confidenceWeight: number;
  /** Weight for risk relevance */
  riskRelevanceWeight: number;
  /** Weight for likelihood of revealing downstream evidence */
  downstreamWeight: number;
  /** When to pivot to alternative lines of inquiry */
  pivotThreshold: number;
  /** Whether to favor breadth over depth */
  favorBreadth: boolean;
  /** Rationale */
  rationale: string;
}

export interface ScoringConfig {
  /** Weight for source recency (0-1) */
  recencyWeight: number;
  /** Weight for source credibility */
  credibilityWeight: number;
  /** Weight for cross-source corroboration */
  corroborationWeight: number;
  /** Weight for technical relevance */
  technicalRelevanceWeight: number;
  /** Weight for reputational impact */
  reputationalImpactWeight: number;
  /** Weight for anomaly detection */
  anomalyWeight: number;
  /** Confidence threshold for "confirmed" findings */
  confirmedThreshold: number;
  /** Confidence threshold for "probable" findings */
  probableThreshold: number;
  /** Risk lenses to apply */
  riskLenses: RiskLens[];
  /** Rationale */
  rationale: string;
}

export interface ReportingConfig {
  /** Report template type */
  templateType: string;
  /** Executive summary style */
  summaryStyle: "risk_oriented" | "attribution_focused" | "timeline_reconstruction" | "compliance" | "operational";
  /** Key sections to include */
  keySections: string[];
  /** Risk flags to highlight */
  riskFlags: string[];
  /** Whether to include ownership structure */
  includeOwnershipStructure: boolean;
  /** Whether to include timeline */
  includeTimeline: boolean;
  /** Whether to include attribution hypotheses */
  includeAttribution: boolean;
  /** Whether to include confidence explanations */
  includeConfidenceExplanations: boolean;
  /** Rationale */
  rationale: string;
}

export interface WorkflowConfig {
  /** Investigation style */
  style: InvestigationStyle;
  /** Step sequence (ordered) */
  stepSequence: string[];
  /** Escalation rules */
  escalationRules: string[];
  /** Review checkpoints */
  reviewCheckpoints: string[];
  /** Stopping conditions */
  stoppingConditions: string[];
  /** Maximum investigation depth */
  maxDepth: number;
  /** Whether to enable continuous monitoring */
  continuousMonitoring: boolean;
  /** Rationale */
  rationale: string;
}

export interface PlaybookDefinition {
  type: PlaybookType;
  name: string;
  shortName: string;
  description: string;
  icon: string;             // lucide icon name
  color: string;            // tailwind color
  category: string;         // grouping for UI
  applicableInputTypes: string[]; // which input types this playbook is best for
  collection: CollectionStrategy;
  prioritization: PrioritizationConfig;
  scoring: ScoringConfig;
  reporting: ReportingConfig;
  workflow: WorkflowConfig;
  /** Common questions users ask for this playbook */
  typicalQuestions: string[];
  /** Common failure modes to watch for */
  failureModes: string[];
  /** Expected level of certainty */
  expectedCertainty: "high" | "moderate" | "low" | "variable";
}

// ============================================================================
// 10 PLAYBOOK DEFINITIONS
// ============================================================================

export const PLAYBOOKS: Record<PlaybookType, PlaybookDefinition> = {
  // ==========================================================================
  corporate_due_diligence: {
    type: "corporate_due_diligence",
    name: "Corporate Due Diligence",
    shortName: "Corporate DD",
    description: "Comprehensive assessment of a company's ownership, leadership, financial exposure, litigation, reputation, and infrastructure footprint.",
    icon: "Building2",
    color: "cyan",
    category: "Corporate",
    applicableInputTypes: ["organization", "domain"],
    collection: {
      prioritizedSources: ["edgar", "opencorporates", "gleif", "wikipedia", "openrdap", "dns_google", "crtsh", "web_search", "gdelt", "googlenews"],
      deferredSources: ["genderize", "agify", "nationalize", "openmeteo"],
      skippedSources: [],
      focusEntityTypes: ["organization", "domain", "person"],
      discoveryPaths: ["ownership", "subsidiaries", "leadership", "litigation", "infrastructure"],
      rationale: "Corporate registries and authoritative sources (EDGAR, OpenCorporates, GLEIF) provide legal entity confirmation. DNS/certificates reveal infrastructure. News sources surface litigation and reputation.",
    },
    prioritization: {
      utilityWeight: 0.35,
      confidenceWeight: 0.30,
      riskRelevanceWeight: 0.25,
      downstreamWeight: 0.10,
      pivotThreshold: 0.4,
      favorBreadth: true,
      rationale: "Due diligence requires broad coverage — prioritize corroborated evidence from authoritative sources over deep single-source dives.",
    },
    scoring: {
      recencyWeight: 0.20,
      credibilityWeight: 0.35,
      corroborationWeight: 0.25,
      technicalRelevanceWeight: 0.10,
      reputationalImpactWeight: 0.10,
      anomalyWeight: 0.05,
      confirmedThreshold: 0.75,
      probableThreshold: 0.50,
      riskLenses: ["financial", "legal", "regulatory", "reputational"],
      rationale: "Authoritative source credibility and cross-corroboration are paramount for defensible due diligence.",
    },
    reporting: {
      templateType: "due_diligence",
      summaryStyle: "risk_oriented",
      keySections: ["executive_summary", "ownership_structure", "leadership", "financial_exposure", "litigation", "reputation", "infrastructure", "risk_flags", "recommendations"],
      riskFlags: ["hidden_ownership", "litigation_history", "regulatory_actions", "financial_distress", "reputation_issues", "infrastructure_exposure"],
      includeOwnershipStructure: true,
      includeTimeline: true,
      includeAttribution: false,
      includeConfidenceExplanations: true,
      rationale: "Structured risk-oriented report with clear ownership structure and risk flags for stakeholder decision-making.",
    },
    workflow: {
      style: "broad_exploratory",
      stepSequence: ["entity_confirmation", "ownership_mapping", "leadership_profiling", "financial_assessment", "litigation_search", "reputation_analysis", "infrastructure_review", "risk_synthesis"],
      escalationRules: ["Escalate if hidden ownership detected", "Escalate if litigation history is material", "Escalate if financial distress indicators present"],
      reviewCheckpoints: ["After ownership mapping", "After financial assessment", "Before final report"],
      stoppingConditions: ["All key sections have evidence", "Authoritative sources exhausted", "Risk flags catalogued"],
      maxDepth: 3,
      continuousMonitoring: false,
      rationale: "Broad exploration ensures comprehensive coverage; review checkpoints prevent premature conclusions.",
    },
    typicalQuestions: [
      "Who owns this company?",
      "What is the corporate structure?",
      "Are there hidden subsidiaries?",
      "Is there litigation history?",
      "What is the financial health?",
    ],
    failureModes: ["Missing offshore entities", "Outdated registry data", "Hidden beneficial ownership", "Missed litigation references"],
    expectedCertainty: "moderate",
  },

  // ==========================================================================
  executive_background: {
    type: "executive_background",
    name: "Executive Background Investigation",
    shortName: "Executive BG",
    description: "Career history, affiliations, public statements, board memberships, publications, media coverage, and identity resolution for an individual.",
    icon: "User",
    color: "green",
    category: "Person",
    applicableInputTypes: ["person", "email", "username"],
    collection: {
      prioritizedSources: ["wikipedia", "github", "gitlab", "reddit", "hackernews", "whatsmyname", "usernamesearch", "gravatar", "web_search", "gdelt", "googlenews", "archiveorg"],
      deferredSources: ["openmeteo", "binlist", "blockstream"],
      skippedSources: ["cisa_kev", "nvd", "osv", "cveorg", "epss"],
      focusEntityTypes: ["person", "email", "username", "organization"],
      discoveryPaths: ["career_history", "board_memberships", "publications", "media_coverage", "social_presence", "affiliations"],
      rationale: "Social/professional sources and news archives are most probative for executive backgrounds. Technical/security sources are less relevant.",
    },
    prioritization: {
      utilityWeight: 0.30,
      confidenceWeight: 0.35,
      riskRelevanceWeight: 0.15,
      downstreamWeight: 0.20,
      pivotThreshold: 0.35,
      favorBreadth: true,
      rationale: "Identity resolution requires broad source coverage to find all aliases and affiliations. Contradictions between sources are especially valuable.",
    },
    scoring: {
      recencyWeight: 0.15,
      credibilityWeight: 0.25,
      corroborationWeight: 0.30,
      technicalRelevanceWeight: 0.05,
      reputationalImpactWeight: 0.15,
      anomalyWeight: 0.10,
      confirmedThreshold: 0.70,
      probableThreshold: 0.45,
      riskLenses: ["reputational", "legal", "operational"],
      rationale: "Cross-source corroboration is critical for identity resolution. Anomalies and contradictions flag potential concealment.",
    },
    reporting: {
      templateType: "executive_profile",
      summaryStyle: "attribution_focused",
      keySections: ["identity_summary", "career_history", "board_memberships", "publications", "media_coverage", "social_presence", "contradictions", "gaps", "recommendations"],
      riskFlags: ["identity_contradictions", "hidden_affiliations", "reputation_issues", "credential_gaps", "media_controversies"],
      includeOwnershipStructure: false,
      includeTimeline: true,
      includeAttribution: true,
      includeConfidenceExplanations: true,
      rationale: "Attribution-focused report with clear provenance trail and contradiction highlighting for identity verification.",
    },
    workflow: {
      style: "broad_exploratory",
      stepSequence: ["identity_resolution", "career_mapping", "affiliation_discovery", "media_analysis", "contradiction_check", "gap_identification", "profile_synthesis"],
      escalationRules: ["Escalate if identity contradictions detected", "Escalate if hidden affiliations found", "Escalate if criminal references appear"],
      reviewCheckpoints: ["After identity resolution", "After affiliation discovery", "Before final profile"],
      stoppingConditions: ["Identity resolved across sources", "Major affiliations mapped", "Contradictions catalogued"],
      maxDepth: 3,
      continuousMonitoring: false,
      rationale: "Broad exploration ensures all aliases and affiliations are discovered; contradiction detection is continuous.",
    },
    typicalQuestions: [
      "What is this person's career history?",
      "What boards do they sit on?",
      "Are there contradictions in their public profile?",
      "What is their media coverage?",
      "Do they have hidden affiliations?",
    ],
    failureModes: ["Missed aliases", "Outdated career info", "Missed contradictions", "Incomplete social presence"],
    expectedCertainty: "moderate",
  },

  // ==========================================================================
  threat_actor_profiling: {
    type: "threat_actor_profiling",
    name: "Threat Actor Profiling",
    shortName: "Threat Actor",
    description: "Infrastructure patterns, technical artifacts, aliases, operational habits, linked accounts, and historical activity for threat attribution.",
    icon: "ShieldAlert",
    color: "red",
    category: "Security",
    applicableInputTypes: ["domain", "ip", "email", "username", "hash"],
    collection: {
      prioritizedSources: ["otx", "abuseipdb", "virustotal", "greynoise", "threatfox", "urlhaus", "malwarebazaar", "shodan_internetdb", "urlscan", "hashrep", "crtsh", "dns_google", "doh"],
      deferredSources: ["genderize", "agify", "nationalize", "openmeteo", "binlist"],
      skippedSources: ["edgar", "fec", "usaspending"],
      focusEntityTypes: ["domain", "ip", "hash", "email", "username"],
      discoveryPaths: ["infrastructure_patterns", "malware_samples", "aliases", "ttp_patterns", "historical_activity", "linked_accounts"],
      rationale: "Threat intelligence sources (OTX, AbuseIPDB, VirusTotal, GreyNoise, ThreatFox) are primary. Infrastructure sources reveal hosting patterns and TTPs.",
    },
    prioritization: {
      utilityWeight: 0.25,
      confidenceWeight: 0.20,
      riskRelevanceWeight: 0.35,
      downstreamWeight: 0.20,
      pivotThreshold: 0.30,
      favorBreadth: false,
      rationale: "Hypothesis-driven: test specific attribution hypotheses. Prioritize evidence that confirms or denies threat actor identity.",
    },
    scoring: {
      recencyWeight: 0.30,
      credibilityWeight: 0.25,
      corroborationWeight: 0.20,
      technicalRelevanceWeight: 0.15,
      reputationalImpactWeight: 0.05,
      anomalyWeight: 0.15,
      confirmedThreshold: 0.80,
      probableThreshold: 0.55,
      riskLenses: ["security", "technical", "operational"],
      rationale: "Recency is critical — threat infrastructure changes fast. Anomaly detection flags TTPs. High confirmation threshold for attribution claims.",
    },
    reporting: {
      templateType: "threat_profile",
      summaryStyle: "attribution_focused",
      keySections: ["attribution_hypotheses", "infrastructure_patterns", "ttp_analysis", "aliases", "historical_activity", "confidence_assessment", "caveats"],
      riskFlags: ["malicious_infrastructure", "known_ttps", "alias_links", "campaign_associations", "infrastructure_overlap"],
      includeOwnershipStructure: false,
      includeTimeline: true,
      includeAttribution: true,
      includeConfidenceExplanations: true,
      rationale: "Attribution-focused report with explicit confidence levels and caveats — attribution claims must be defensible.",
    },
    workflow: {
      style: "hypothesis_driven",
      stepSequence: ["infrastructure_analysis", "ttp_identification", "alias_correlation", "historical_reconstruction", "attribution_hypothesis", "confidence_assessment"],
      escalationRules: ["Escalate if attribution confidence exceeds 0.8", "Escalate if campaign links detected", "Escalate if nation-state TTPs present"],
      reviewCheckpoints: ["After infrastructure analysis", "After attribution hypothesis", "Before final assessment"],
      stoppingConditions: ["Attribution hypothesis tested", "Infrastructure patterns mapped", "Confidence level determined"],
      maxDepth: 4,
      continuousMonitoring: true,
      rationale: "Hypothesis-driven investigation with continuous monitoring — threat infrastructure evolves and attribution may change.",
    },
    typicalQuestions: [
      "Who is behind this infrastructure?",
      "What TTPs does this actor use?",
      "Are there aliases or linked accounts?",
      "What campaigns is this actor associated with?",
      "How confident is the attribution?",
    ],
    failureModes: ["False attribution", "Stale infrastructure data", "Missed alias connections", "Overconfidence in attribution"],
    expectedCertainty: "low",
  },

  // ==========================================================================
  infrastructure_recon: {
    type: "infrastructure_recon",
    name: "Infrastructure Reconnaissance",
    shortName: "Infra Recon",
    description: "Domains, subdomains, certificates, DNS history, hosting changes, exposed services, technologies, and attack surface expansion.",
    icon: "Server",
    color: "amber",
    category: "Technical",
    applicableInputTypes: ["domain", "ip", "url"],
    collection: {
      prioritizedSources: ["dns_google", "doh", "crtsh", "openrdap", "shodan_internetdb", "bgpview", "peeringdb", "ipinfo", "ipquery", "httpheaders", "urlscan", "robotssitemap", "wayback"],
      deferredSources: ["edgar", "fec", "usaspending", "genderize", "agify"],
      skippedSources: ["openmeteo"],
      focusEntityTypes: ["domain", "ip", "url"],
      discoveryPaths: ["subdomain_enumeration", "dns_history", "certificate_transparency", "hosting_changes", "exposed_services", "tech_stack", "attack_surface"],
      rationale: "DNS, certificate, and infrastructure sources are primary. Certificate transparency reveals subdomains. Shodan/BGP reveal hosting and exposure.",
    },
    prioritization: {
      utilityWeight: 0.30,
      confidenceWeight: 0.20,
      riskRelevanceWeight: 0.25,
      downstreamWeight: 0.25,
      pivotThreshold: 0.35,
      favorBreadth: true,
      rationale: "Broad enumeration is key — surface all assets quickly. Prioritize newly discovered assets for immediate tracking.",
    },
    scoring: {
      recencyWeight: 0.35,
      credibilityWeight: 0.20,
      corroborationWeight: 0.15,
      technicalRelevanceWeight: 0.20,
      reputationalImpactWeight: 0.05,
      anomalyWeight: 0.05,
      confirmedThreshold: 0.70,
      probableThreshold: 0.45,
      riskLenses: ["technical", "security"],
      rationale: "Recency is critical — infrastructure changes rapidly. Technical relevance matters more than source reputation.",
    },
    reporting: {
      templateType: "infrastructure_report",
      summaryStyle: "operational",
      keySections: ["asset_inventory", "dns_records", "subdomain_enumeration", "certificate_analysis", "hosting_infrastructure", "exposed_services", "tech_stack", "attack_surface", "changes_detected"],
      riskFlags: ["exposed_services", "misconfigured_dns", "expired_certificates", "unknown_subdomains", "infrastructure_changes"],
      includeOwnershipStructure: false,
      includeTimeline: true,
      includeAttribution: false,
      includeConfidenceExplanations: false,
      rationale: "Operational report focused on asset inventory and exposure — actionable for security teams.",
    },
    workflow: {
      style: "broad_exploratory",
      stepSequence: ["dns_recon", "subdomain_enumeration", "certificate_analysis", "hosting_identification", "service_detection", "tech_fingerprinting", "attack_surface_mapping"],
      escalationRules: ["Escalate if new subdomains discovered", "Escalate if exposed services detected", "Escalate if infrastructure changes found"],
      reviewCheckpoints: ["After subdomain enumeration", "After service detection"],
      stoppingConditions: ["DNS fully mapped", "Subdomains enumerated", "Services identified"],
      maxDepth: 3,
      continuousMonitoring: true,
      rationale: "Broad enumeration with continuous monitoring — infrastructure changes should be tracked over time.",
    },
    typicalQuestions: [
      "What subdomains exist?",
      "What services are exposed?",
      "What is the tech stack?",
      "How has the infrastructure changed?",
      "What is the attack surface?",
    ],
    failureModes: ["Missed subdomains", "Stale DNS data", "Incomplete service detection", "Missed infrastructure changes"],
    expectedCertainty: "high",
  },

  // ==========================================================================
  brand_protection: {
    type: "brand_protection",
    name: "Brand Protection",
    shortName: "Brand",
    description: "Detect impersonation, phishing infrastructure, counterfeit domains, social abuse, unauthorized trademark use, and suspicious lookalike assets.",
    icon: "ShieldCheck",
    color: "green",
    category: "Brand",
    applicableInputTypes: ["organization", "domain", "username"],
    collection: {
      prioritizedSources: ["domainsdb", "crtsh", "dns_google", "urlscan", "urlhaus", "web_search", "googlenews", "reddit", "whatsmyname", "usernamesearch"],
      deferredSources: ["edgar", "fec", "openmeteo", "blockstream"],
      skippedSources: ["cisa_kev", "nvd", "osv", "cveorg"],
      focusEntityTypes: ["domain", "organization", "username"],
      discoveryPaths: ["lookalike_domains", "phishing_infrastructure", "counterfeit_detection", "social_impersonation", "trademark_abuse", "certificate_monitoring"],
      rationale: "Domain registration databases reveal lookalikes. Certificate transparency shows phishing infrastructure. Social sources detect impersonation.",
    },
    prioritization: {
      utilityWeight: 0.35,
      confidenceWeight: 0.15,
      riskRelevanceWeight: 0.30,
      downstreamWeight: 0.20,
      pivotThreshold: 0.25,
      favorBreadth: true,
      rationale: "Rapid detection is critical — prioritize speed and coverage over deep analysis. Surface threats quickly for immediate action.",
    },
    scoring: {
      recencyWeight: 0.40,
      credibilityWeight: 0.15,
      corroborationWeight: 0.15,
      technicalRelevanceWeight: 0.15,
      reputationalImpactWeight: 0.15,
      anomalyWeight: 0.10,
      confirmedThreshold: 0.65,
      probableThreshold: 0.40,
      riskLenses: ["reputational", "legal", "financial"],
      rationale: "Recency is paramount — new threats are most dangerous. Reputational impact weighted heavily. Lower confirmation threshold for rapid alerting.",
    },
    reporting: {
      templateType: "brand_protection",
      summaryStyle: "risk_oriented",
      keySections: ["threat_summary", "lookalike_domains", "phishing_infrastructure", "social_impersonation", "trademark_abuse", "evidence_preservation", "takedown_recommendations"],
      riskFlags: ["lookalike_domains", "phishing_sites", "social_impersonation", "counterfeit_goods", "trademark_infringement", "typosquatting"],
      includeOwnershipStructure: false,
      includeTimeline: true,
      includeAttribution: true,
      includeConfidenceExplanations: false,
      rationale: "Risk-oriented report with clear takedown recommendations and evidence preservation for legal action.",
    },
    workflow: {
      style: "time_sensitive",
      stepSequence: ["lookalike_detection", "phishing_scan", "social_monitoring", "trademark_check", "evidence_preservation", "takedown_prioritization"],
      escalationRules: ["Escalate immediately if active phishing detected", "Escalate if trademark infringement confirmed", "Escalate if social impersonation verified"],
      reviewCheckpoints: ["After lookalike detection", "After phishing scan"],
      stoppingConditions: ["All lookalikes catalogued", "Phishing sites identified", "Social impersonation checked"],
      maxDepth: 2,
      continuousMonitoring: true,
      rationale: "Time-sensitive — threats escalate quickly. Continuous monitoring ensures new threats are caught early.",
    },
    typicalQuestions: [
      "Are there lookalike domains?",
      "Is there phishing infrastructure?",
      "Are there social media impersonators?",
      "Is our trademark being abused?",
      "What needs immediate takedown?",
    ],
    failureModes: ["Missed lookalike domains", "Late phishing detection", "Missed social impersonation", "Insufficient evidence for takedown"],
    expectedCertainty: "high",
  },

  // ==========================================================================
  vendor_risk: {
    type: "vendor_risk",
    name: "Vendor Risk Assessment",
    shortName: "Vendor Risk",
    description: "Public exposure, security posture, infrastructure hygiene, trust signals, ownership structure, and operational dependencies for third-party vendors.",
    icon: "FileText",
    color: "amber",
    category: "Corporate",
    applicableInputTypes: ["organization", "domain"],
    collection: {
      prioritizedSources: ["edgar", "opencorporates", "gleif", "dns_google", "crtsh", "shodan_internetdb", "httpheaders", "urlscan", "otx", "abuseipdb", "greynoise", "wikipedia", "web_search"],
      deferredSources: ["genderize", "agify", "nationalize", "openmeteo"],
      skippedSources: [],
      focusEntityTypes: ["organization", "domain", "ip"],
      discoveryPaths: ["security_posture", "infrastructure_hygiene", "ownership", "operational_dependencies", "trust_signals", "breach_history"],
      rationale: "Corporate registries confirm vendor legitimacy. Security sources (Shodan, OTX, AbuseIPDB) assess posture. Infrastructure sources reveal hygiene.",
    },
    prioritization: {
      utilityWeight: 0.30,
      confidenceWeight: 0.25,
      riskRelevanceWeight: 0.30,
      downstreamWeight: 0.15,
      pivotThreshold: 0.35,
      favorBreadth: true,
      rationale: "Balance security posture with business viability — both matter for vendor risk decisions.",
    },
    scoring: {
      recencyWeight: 0.25,
      credibilityWeight: 0.25,
      corroborationWeight: 0.20,
      technicalRelevanceWeight: 0.15,
      reputationalImpactWeight: 0.10,
      anomalyWeight: 0.05,
      confirmedThreshold: 0.70,
      probableThreshold: 0.45,
      riskLenses: ["security", "operational", "financial", "regulatory"],
      rationale: "Security and operational risk are primary. Recency matters for breach history. Corroboration ensures defensible assessments.",
    },
    reporting: {
      templateType: "vendor_risk",
      summaryStyle: "risk_oriented",
      keySections: ["vendor_overview", "security_posture", "infrastructure_hygiene", "ownership_structure", "operational_dependencies", "breach_history", "risk_score", "recommendations"],
      riskFlags: ["poor_security_posture", "breach_history", "infrastructure_misconfiguration", "hidden_ownership", "operational_instability", "regulatory_issues"],
      includeOwnershipStructure: true,
      includeTimeline: true,
      includeAttribution: false,
      includeConfidenceExplanations: true,
      rationale: "Risk-oriented report with clear risk score and actionable recommendations for procurement decisions.",
    },
    workflow: {
      style: "broad_exploratory",
      stepSequence: ["vendor_confirmation", "security_assessment", "infrastructure_audit", "ownership_verification", "dependency_mapping", "risk_scoring"],
      escalationRules: ["Escalate if security posture is poor", "Escalate if breach history detected", "Escalate if ownership is hidden"],
      reviewCheckpoints: ["After security assessment", "After ownership verification"],
      stoppingConditions: ["Security posture assessed", "Ownership confirmed", "Dependencies mapped"],
      maxDepth: 3,
      continuousMonitoring: true,
      rationale: "Broad assessment with continuous monitoring — vendor risk changes over time.",
    },
    typicalQuestions: [
      "What is the vendor's security posture?",
      "Have they had breaches?",
      "Who owns this vendor?",
      "What are their operational dependencies?",
      "What is the risk score?",
    ],
    failureModes: ["Missed breach history", "Incomplete security assessment", "Missed ownership changes", "Outdated risk score"],
    expectedCertainty: "moderate",
  },

  // ==========================================================================
  supply_chain: {
    type: "supply_chain",
    name: "Supply Chain Analysis",
    shortName: "Supply Chain",
    description: "Map upstream and downstream dependencies, shared infrastructure, third-party services, integrations, and hidden relationships. Identify concentration risk and transitive exposure.",
    icon: "GitBranch",
    color: "cyan",
    category: "Corporate",
    applicableInputTypes: ["organization", "domain"],
    collection: {
      prioritizedSources: ["edgar", "opencorporates", "gleif", "icij", "dns_google", "crtsh", "openrdap", "bgpview", "peeringdb", "web_search", "wikipedia"],
      deferredSources: ["genderize", "agify", "openmeteo", "binlist"],
      skippedSources: ["cisa_kev", "nvd", "osv"],
      focusEntityTypes: ["organization", "domain", "ip"],
      discoveryPaths: ["upstream_dependencies", "downstream_customers", "shared_infrastructure", "third_party_integrations", "concentration_risk", "transitive_exposure"],
      rationale: "Corporate registries reveal ownership chains. ICIJ exposes offshore connections. Infrastructure sources reveal shared hosting and dependencies.",
    },
    prioritization: {
      utilityWeight: 0.25,
      confidenceWeight: 0.25,
      riskRelevanceWeight: 0.25,
      downstreamWeight: 0.25,
      pivotThreshold: 0.30,
      favorBreadth: true,
      rationale: "Relationship mapping is the core — prioritize evidence that reveals connections between entities. Transitive exposure is key.",
    },
    scoring: {
      recencyWeight: 0.15,
      credibilityWeight: 0.30,
      corroborationWeight: 0.25,
      technicalRelevanceWeight: 0.15,
      reputationalImpactWeight: 0.10,
      anomalyWeight: 0.05,
      confirmedThreshold: 0.75,
      probableThreshold: 0.50,
      riskLenses: ["operational", "strategic", "financial", "regulatory"],
      rationale: "Relationship claims need strong corroboration. Concentration risk requires credible evidence of dependency.",
    },
    reporting: {
      templateType: "supply_chain",
      summaryStyle: "risk_oriented",
      keySections: ["dependency_map", "upstream_suppliers", "downstream_customers", "shared_infrastructure", "concentration_risk", "transitive_exposure", "points_of_failure", "recommendations"],
      riskFlags: ["single_point_of_failure", "concentration_risk", "hidden_dependencies", "shared_infrastructure", "offshore_connections", "transitive_exposure"],
      includeOwnershipStructure: true,
      includeTimeline: true,
      includeAttribution: false,
      includeConfidenceExplanations: true,
      rationale: "Map-based report with clear concentration risk identification and points of failure for resilience planning.",
    },
    workflow: {
      style: "broad_exploratory",
      stepSequence: ["dependency_mapping", "infrastructure_correlation", "ownership_chain", "concentration_analysis", "transitive_exposure_mapping", "resilience_assessment"],
      escalationRules: ["Escalate if single point of failure detected", "Escalate if concentration risk identified", "Escalate if hidden offshore connections found"],
      reviewCheckpoints: ["After dependency mapping", "After concentration analysis"],
      stoppingConditions: ["Dependencies mapped", "Concentration risk assessed", "Transitive exposure identified"],
      maxDepth: 4,
      continuousMonitoring: false,
      rationale: "Deep exploration needed to map full supply chain. Transitive exposure requires multi-level depth.",
    },
    typicalQuestions: [
      "Who are the upstream suppliers?",
      "What are the downstream dependencies?",
      "Is there concentration risk?",
      "Are there single points of failure?",
      "What is the transitive exposure?",
    ],
    failureModes: ["Missed hidden dependencies", "Incomplete transitive mapping", "Missed offshore connections", "Shallow depth"],
    expectedCertainty: "moderate",
  },

  // ==========================================================================
  incident_response: {
    type: "incident_response",
    name: "Incident Response",
    shortName: "IR",
    description: "Recent changes, suspicious infrastructure, leaked credentials, malicious indicators, affected assets, and timeline reconstruction. Optimized for speed and actionable containment.",
    icon: "AlertTriangle",
    color: "red",
    category: "Security",
    applicableInputTypes: ["domain", "ip", "hash", "email", "url"],
    collection: {
      prioritizedSources: ["otx", "abuseipdb", "virustotal", "greynoise", "threatfox", "urlhaus", "malwarebazaar", "hashrep", "shodan_internetdb", "urlscan", "crtsh", "dns_google", "wayback", "httpheaders"],
      deferredSources: ["edgar", "fec", "usaspending", "genderize", "agify", "openmeteo"],
      skippedSources: [],
      focusEntityTypes: ["ip", "domain", "hash", "url"],
      discoveryPaths: ["recent_changes", "malicious_indicators", "leaked_credentials", "affected_assets", "timeline_reconstruction", "infrastructure_changes"],
      rationale: "Threat intel sources are primary — speed is critical. Wayback provides historical comparison. Certificate/DNS changes reveal recent infrastructure shifts.",
    },
    prioritization: {
      utilityWeight: 0.40,
      confidenceWeight: 0.15,
      riskRelevanceWeight: 0.30,
      downstreamWeight: 0.15,
      pivotThreshold: 0.20,
      favorBreadth: false,
      rationale: "Speed over breadth — focus on actionable indicators for immediate containment. Prioritize fresh evidence.",
    },
    scoring: {
      recencyWeight: 0.45,
      credibilityWeight: 0.20,
      corroborationWeight: 0.15,
      technicalRelevanceWeight: 0.15,
      reputationalImpactWeight: 0.05,
      anomalyWeight: 0.10,
      confirmedThreshold: 0.65,
      probableThreshold: 0.40,
      riskLenses: ["security", "operational", "technical"],
      rationale: "Recency is paramount — recent changes are most relevant. Lower thresholds for rapid response. Technical relevance matters for containment.",
    },
    reporting: {
      templateType: "incident_report",
      summaryStyle: "timeline_reconstruction",
      keySections: ["incident_summary", "indicators_of_compromise", "timeline", "affected_assets", "infrastructure_changes", "containment_recommendations", "evidence_preservation"],
      riskFlags: ["malicious_indicators", "recent_infrastructure_changes", "leaked_credentials", "compromised_assets", "lateral_movement", "data_exfiltration"],
      includeOwnershipStructure: false,
      includeTimeline: true,
      includeAttribution: true,
      includeConfidenceExplanations: false,
      rationale: "Timeline-focused report with clear IOCs and containment recommendations for rapid operational response.",
    },
    workflow: {
      style: "time_sensitive",
      stepSequence: ["ioc_collection", "timeline_reconstruction", "asset_identification", "infrastructure_analysis", "containment_assessment", "evidence_preservation"],
      escalationRules: ["Escalate immediately if active compromise detected", "Escalate if lateral movement indicators found", "Escalate if data exfiltration suspected"],
      reviewCheckpoints: ["After IOC collection", "After timeline reconstruction"],
      stoppingConditions: ["IOCs catalogued", "Timeline reconstructed", "Affected assets identified"],
      maxDepth: 2,
      continuousMonitoring: true,
      rationale: "Time-sensitive — minimize depth in favor of speed. Continuous monitoring tracks incident evolution.",
    },
    typicalQuestions: [
      "What are the IOCs?",
      "When did the incident start?",
      "What assets are affected?",
      "What has changed recently?",
      "What containment is needed?",
    ],
    failureModes: ["Missed recent changes", "Slow response", "Incomplete IOC collection", "Missed lateral movement"],
    expectedCertainty: "high",
  },

  // ==========================================================================
  ma_due_diligence: {
    type: "ma_due_diligence",
    name: "M&A Due Diligence",
    shortName: "M&A DD",
    description: "Corporate structure, hidden liabilities, executive history, litigation, regulatory exposure, technology stack, and operational risk for acquisition decisions.",
    icon: "Building2",
    color: "purple",
    category: "Corporate",
    applicableInputTypes: ["organization", "domain"],
    collection: {
      prioritizedSources: ["edgar", "opencorporates", "gleif", "icij", "usaspending", "fec", "wikipedia", "openrdap", "dns_google", "crtsh", "httpheaders", "urlscan", "web_search", "gdelt", "googlenews", "archiveorg"],
      deferredSources: ["genderize", "agify", "openmeteo", "binlist"],
      skippedSources: ["cisa_kev", "nvd", "osv"],
      focusEntityTypes: ["organization", "domain", "person", "ip"],
      discoveryPaths: ["corporate_structure", "hidden_liabilities", "executive_history", "litigation", "regulatory_exposure", "tech_stack", "operational_risk"],
      rationale: "Comprehensive coverage needed — financial, legal, technical, and reputational. ICIJ reveals offshore entities. SEC filings show financials. News reveals litigation.",
    },
    prioritization: {
      utilityWeight: 0.30,
      confidenceWeight: 0.30,
      riskRelevanceWeight: 0.25,
      downstreamWeight: 0.15,
      pivotThreshold: 0.35,
      favorBreadth: true,
      rationale: "Comprehensive coverage is essential for M&A — hidden liabilities in any dimension can be deal-breakers. Prioritize authoritative sources.",
    },
    scoring: {
      recencyWeight: 0.20,
      credibilityWeight: 0.35,
      corroborationWeight: 0.25,
      technicalRelevanceWeight: 0.10,
      reputationalImpactWeight: 0.10,
      anomalyWeight: 0.05,
      confirmedThreshold: 0.80,
      probableThreshold: 0.55,
      riskLenses: ["financial", "legal", "regulatory", "operational", "strategic", "reputational"],
      rationale: "High confirmation thresholds — M&A decisions need defensible evidence. All risk lenses apply. Authoritative sources weighted heavily.",
    },
    reporting: {
      templateType: "ma_diligence",
      summaryStyle: "risk_oriented",
      keySections: ["executive_summary", "corporate_structure", "financial_assessment", "litigation_analysis", "regulatory_exposure", "executive_background", "technology_assessment", "operational_risk", "hidden_liabilities", "acquisition_risk_score", "recommendations"],
      riskFlags: ["hidden_liabilities", "pending_litigation", "regulatory_actions", "financial_distress", "executive_issues", "technology_debt", "offshore_entities", "concentration_risk"],
      includeOwnershipStructure: true,
      includeTimeline: true,
      includeAttribution: false,
      includeConfidenceExplanations: true,
      rationale: "Comprehensive risk-oriented report with acquisition risk score and clear evidence support for deal decisions.",
    },
    workflow: {
      style: "broad_exploratory",
      stepSequence: ["corporate_structure_mapping", "financial_analysis", "litigation_review", "regulatory_check", "executive_vetting", "technology_audit", "operational_assessment", "risk_synthesis"],
      escalationRules: ["Escalate if hidden liabilities detected", "Escalate if material litigation found", "Escalate if regulatory actions present", "Escalate if offshore entities discovered"],
      reviewCheckpoints: ["After corporate structure mapping", "After financial analysis", "After litigation review", "Before final report"],
      stoppingConditions: ["All risk dimensions assessed", "Authoritative sources exhausted", "Risk score calculated"],
      maxDepth: 4,
      continuousMonitoring: false,
      rationale: "Deep, comprehensive investigation with multiple review checkpoints — M&A decisions require thorough due diligence.",
    },
    typicalQuestions: [
      "Are there hidden liabilities?",
      "What is the corporate structure?",
      "Is there pending litigation?",
      "Are there regulatory issues?",
      "What is the acquisition risk?",
    ],
    failureModes: ["Missed hidden liabilities", "Incomplete corporate structure", "Missed offshore entities", "Insufficient depth"],
    expectedCertainty: "moderate",
  },

  // ==========================================================================
  fraud_investigation: {
    type: "fraud_investigation",
    name: "Fraud Investigation",
    shortName: "Fraud",
    description: "Identity resolution, relationship mapping, financial traces, suspicious patterns, inconsistencies, and corroborating records. Highlight anomalies and concealment behavior.",
    icon: "AlertCircle",
    color: "red",
    category: "Investigative",
    applicableInputTypes: ["person", "organization", "email", "wallet", "domain", "phone"],
    collection: {
      prioritizedSources: ["edgar", "opencorporates", "gleif", "icij", "ofac", "opensanctions", "interpol", "etherscan", "blockchair", "blockstream", "bitcoinabuse", "web_search", "gdelt", "googlenews", "wikipedia"],
      deferredSources: ["openmeteo", "genderize", "agify", "nationalize"],
      skippedSources: ["cisa_kev", "nvd", "osv", "cveorg", "epss"],
      focusEntityTypes: ["person", "organization", "wallet", "email", "domain"],
      discoveryPaths: ["identity_resolution", "relationship_mapping", "financial_traces", "suspicious_patterns", "inconsistency_detection", "concealment_behavior", "sanctions_screening"],
      rationale: "Sanctions/watchlists are primary. Blockchain sources trace financial flows. ICIJ reveals offshore connections. Corporate registries confirm identities.",
    },
    prioritization: {
      utilityWeight: 0.25,
      confidenceWeight: 0.30,
      riskRelevanceWeight: 0.25,
      downstreamWeight: 0.20,
      pivotThreshold: 0.25,
      favorBreadth: true,
      rationale: "Fraud detection requires broad pattern recognition — anomalies and contradictions across sources are key indicators.",
    },
    scoring: {
      recencyWeight: 0.20,
      credibilityWeight: 0.30,
      corroborationWeight: 0.20,
      technicalRelevanceWeight: 0.10,
      reputationalImpactWeight: 0.05,
      anomalyWeight: 0.15,
      confirmedThreshold: 0.75,
      probableThreshold: 0.50,
      riskLenses: ["financial", "legal", "regulatory", "reputational"],
      rationale: "Anomaly detection is critical for fraud. Authoritative sources for sanctions. High thresholds for fraud accusations.",
    },
    reporting: {
      templateType: "fraud_report",
      summaryStyle: "attribution_focused",
      keySections: ["fraud_summary", "identity_analysis", "relationship_map", "financial_traces", "anomalies_detected", "contradictions", "concealment_indicators", "sanctions_screening", "evidence_chain", "recommendations"],
      riskFlags: ["identity_anomalies", "financial_anomalies", "concealment_behavior", "sanctions_match", "offshore_connections", "relationship_inconsistencies", "transaction_patterns"],
      includeOwnershipStructure: true,
      includeTimeline: true,
      includeAttribution: true,
      includeConfidenceExplanations: true,
      rationale: "Attribution-focused report with clear evidence chain and anomaly highlighting for legal/regulatory action.",
    },
    workflow: {
      style: "hypothesis_driven",
      stepSequence: ["identity_resolution", "sanctions_screening", "financial_tracing", "relationship_mapping", "anomaly_detection", "contradiction_analysis", "evidence_synthesis"],
      escalationRules: ["Escalate if sanctions match found", "Escalate if concealment behavior detected", "Escalate if financial anomalies confirmed", "Escalate if identity contradictions material"],
      reviewCheckpoints: ["After identity resolution", "After sanctions screening", "After anomaly detection", "Before final report"],
      stoppingConditions: ["Identity resolved", "Financial traces mapped", "Anomalies catalogued", "Evidence chain complete"],
      maxDepth: 4,
      continuousMonitoring: false,
      rationale: "Hypothesis-driven with deep investigation — fraud requires thorough evidence chains for legal action.",
    },
    typicalQuestions: [
      "Is this entity sanctioned?",
      "Are there financial anomalies?",
      "Is there concealment behavior?",
      "Are there identity contradictions?",
      "What is the evidence chain?",
    ],
    failureModes: ["Missed sanctions match", "Incomplete financial tracing", "Missed concealment patterns", "Insufficient evidence chain"],
    expectedCertainty: "low",
  },
};

// ============================================================================
// PLAYBOOK HELPERS
// ============================================================================

export function getPlaybook(type: PlaybookType): PlaybookDefinition {
  return PLAYBOOKS[type];
}

export function getAllPlaybooks(): PlaybookDefinition[] {
  return Object.values(PLAYBOOKS);
}

export function getPlaybooksByCategory(): Record<string, PlaybookDefinition[]> {
  const cats: Record<string, PlaybookDefinition[]> = {};
  for (const pb of Object.values(PLAYBOOKS)) {
    if (!cats[pb.category]) cats[pb.category] = [];
    cats[pb.category].push(pb);
  }
  return cats;
}

export function getRecommendedPlaybook(inputType: string): PlaybookType {
  // Recommend a playbook based on input type
  if (inputType === "organization" || inputType === "domain") return "corporate_due_diligence";
  if (inputType === "person" || inputType === "email" || inputType === "username") return "executive_background";
  if (inputType === "ip" || inputType === "hash") return "threat_actor_profiling";
  if (inputType === "wallet") return "fraud_investigation";
  if (inputType === "cve") return "infrastructure_recon";
  return "corporate_due_diligence";
}

/**
 * Apply a playbook's collection strategy to the source routing.
 * Returns the list of sources to query, ordered by playbook priority.
 */
export function applyPlaybookToSources(
  baseSources: SourceKey[],
  playbook: PlaybookDefinition
): SourceKey[] {
  const { prioritizedSources, deferredSources, skippedSources } = playbook.collection;

  // Filter out skipped sources
  const filtered = baseSources.filter((s) => !skippedSources.includes(s));

  // Sort: prioritized sources first (in playbook order), then remaining, then deferred
  const result: SourceKey[] = [];
  const seen = new Set<SourceKey>();

  // Add prioritized sources that are in the base set
  for (const s of prioritizedSources) {
    if (filtered.includes(s) && !seen.has(s)) {
      result.push(s);
      seen.add(s);
    }
  }

  // Add remaining (non-deferred) sources in original order
  for (const s of filtered) {
    if (!seen.has(s) && !deferredSources.includes(s)) {
      result.push(s);
      seen.add(s);
    }
  }

  // Add deferred sources last
  for (const s of filtered) {
    if (!seen.has(s) && deferredSources.includes(s)) {
      result.push(s);
      seen.add(s);
    }
  }

  return result;
}

/**
 * Get playbook-specific confidence weighting for a finding.
 */
export function getPlaybookConfidenceWeight(
  playbook: PlaybookDefinition,
  finding: { source: string; confidence: number; timestamp: string }
): number {
  const { scoring } = playbook;
  const tier = getTierFromSource(finding.source);
  const age = Date.now() - new Date(finding.timestamp).getTime();
  const ageDays = age / (1000 * 60 * 60 * 24);

  // Recency score (0-1)
  const recencyScore = Math.max(0, 1 - ageDays / 365);

  // Credibility score (tier 1-5 → 0.2-1.0)
  const credibilityScore = tier / 5;

  // Weighted combination
  return (
    recencyScore * scoring.recencyWeight +
    credibilityScore * scoring.credibilityWeight +
    finding.confidence * scoring.corroborationWeight
  );
}

function getTierFromSource(source: string): number {
  // Inline tier lookup (avoids circular import with confidence-engine)
  const TIERS: Record<string, number> = {
    nvd: 5, cisa_kev: 5, edgar: 5, fec: 5, ofac: 5, interpol: 5, opensanctions: 5, cveorg: 5, osv: 5, usaspending: 5,
    shodan_internetdb: 4, threat_intel: 4, otx: 4, abuseipdb: 4, virustotal: 4, greynoise: 4, threatfox: 4, urlhaus: 4, malwarebazaar: 4, hashrep: 4, shodan_cvedb: 4, epss: 4,
    crtsh: 3, doh: 3, dns_google: 3, openrdap: 3, bgpview: 3, peeringdb: 3, ipinfo: 3, ipquery: 3, ipwhois: 3, ipapico: 3, freeipapi: 3, gleif: 3, opencorporates: 3, icij: 3, wikipedia: 3, wikinews: 3, nominatim: 3, openmeteo: 3, emailmx: 3, mailcheck: 3, blockstream: 3, mempool: 3, blockchair: 3, etherscan: 3, httpheaders: 3, robotssitemap: 3, domainsdb: 3, gdelt: 3, googlenews: 3, binlist: 3, npm: 3, pypi: 3,
    hackernews: 2, duckduckgo: 2, reddit: 2, stackexchange: 2, wayback: 2, archiveorg: 2, cloudflare_trace: 2, github: 2, gitlab: 2, whatsmyname: 2, usernamesearch: 2, genderize: 2, agify: 2, nationalize: 2, bitcoinabuse: 2, urlscan: 2, phoneinfo: 2, gravatar: 2,
    web_search: 1,
  };
  return TIERS[source] || 2;
}

/**
 * Get the playbook-specific report prompt suffix for LLM synthesis.
 */
export function getPlaybookReportPromptSuffix(playbook: PlaybookDefinition): string {
  const sections = playbook.reporting.keySections.map((s) => `- ${s.replace(/_/g, " ")}`).join("\n");
  const riskFlags = playbook.reporting.riskFlags.map((r) => `- ${r.replace(/_/g, " ")}`).join("\n");
  const riskLenses = playbook.scoring.riskLenses.join(", ");

  return `

PLAYBOOK CONTEXT: ${playbook.name}
Investigation Style: ${playbook.workflow.style.replace(/_/g, " ")}
Risk Lenses: ${riskLenses}
Expected Certainty: ${playbook.expectedCertainty}

REPORT STRUCTURE — include these sections:
${sections}

RISK FLAGS to watch for and highlight:
${riskFlags}

SUMMARY STYLE: ${playbook.reporting.summaryStyle.replace(/_/g, " ")}

ADDITIONAL INSTRUCTIONS:
- ${playbook.collection.rationale}
- ${playbook.scoring.rationale}
- ${playbook.reporting.rationale}
- ${playbook.workflow.rationale}
- Common failure modes to avoid: ${playbook.failureModes.join("; ")}
- Typical questions this report should answer: ${playbook.typicalQuestions.join("; ")}
`;
}
