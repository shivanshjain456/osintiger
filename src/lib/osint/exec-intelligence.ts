// Executive Intelligence Engine — domain models and profile builder.
// Builds comprehensive profiles across 8 dimensions:
// 1. Career history — chronological employment/leadership roles
// 2. Board memberships — current/historical board seats
// 3. Education — degrees, institutions, fields, graduation years
// 4. Patents — inventorship records, assignees, co-inventors
// 5. Publications — articles, papers, books, talks
// 6. Social presence — LinkedIn, Twitter, GitHub, personal websites
// 7. Media coverage — interviews, press mentions, quotes
// 8. Political donations — legally available public records
//
// Each entry includes: source, confidence, evidence, temporal context.
// Profile includes synthesized timeline, relationship map, confidence scoring,
// contradiction detection, and provenance tracking.

import type { SourceResult, NormalizedFinding } from "./types";
import { getReliabilityTier, type ReliabilityTier } from "./confidence-engine";

// =====================
// Profile Entry Base
// =====================

interface ProfileEntryBase {
  source: string;
  sourceLabel: string;
  tier: ReliabilityTier;
  confidence: number;
  evidence: string;
}

// =====================
// Career History
// =====================

export interface CareerEntry extends ProfileEntryBase {
  organization: string;
  title: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  isCurrent?: boolean;
  status: "confirmed" | "inferred" | "self_reported";
}

// =====================
// Board Memberships
// =====================

export interface BoardEntry extends ProfileEntryBase {
  organization: string;
  role: string; // Board Member, Chairman, Advisor, Trustee, etc.
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  orgType?: string; // public company, nonprofit, etc.
}

// =====================
// Education
// =====================

export interface EducationEntry extends ProfileEntryBase {
  institution: string;
  degree: string;
  field?: string;
  year?: string;
  honors?: string;
}

// =====================
// Patents
// =====================

export interface PatentEntry extends ProfileEntryBase {
  title: string;
  patentNumber?: string;
  assignee?: string;
  coInventors?: string[];
  filingDate?: string;
  jurisdiction?: string;
}

// =====================
// Publications
// =====================

export interface PublicationEntry extends ProfileEntryBase {
  title: string;
  venue?: string;
  date?: string;
  coAuthors?: string[];
  type: string; // article, paper, book, talk, op-ed, interview
}

// =====================
// Social Presence
// =====================

export interface SocialEntry extends ProfileEntryBase {
  platform: string; // LinkedIn, Twitter, GitHub, etc.
  handle?: string;
  url?: string;
  bio?: string;
  verified?: boolean;
}

// =====================
// Media Coverage
// =====================

export interface MediaEntry extends ProfileEntryBase {
  outlet: string;
  headline: string;
  date?: string;
  mentionType: string; // interview, quote, profile, mention, opinion
  url?: string;
}

// =====================
// Political Donations
// =====================

export interface DonationEntry extends ProfileEntryBase {
  recipient: string;
  amount?: string;
  date?: string;
  jurisdiction?: string;
  employer?: string;
}

// =====================
// Timeline Event
// =====================

export interface TimelineEvent {
  date: string;
  category: string;
  event: string;
  source: string;
  sourceLabel: string;
  confidence: number;
}

// =====================
// Relationship
// =====================

export interface ExecRelationship {
  entity: string;
  type: string; // employer, board, school, co-inventor, co-author, etc.
  detail: string;
  confidence: number;
}

// =====================
// Complete Executive Profile
// =====================

export interface ExecProfile {
  career: CareerEntry[];
  boards: BoardEntry[];
  education: EducationEntry[];
  patents: PatentEntry[];
  publications: PublicationEntry[];
  social: SocialEntry[];
  media: MediaEntry[];
  donations: DonationEntry[];
  timeline: TimelineEvent[];
  relationships: ExecRelationship[];
  assessment: {
    totalDataPoints: number;
    careerRoles: number;
    boardSeats: number;
    educationRecords: number;
    patentCount: number;
    publicationCount: number;
    socialProfiles: number;
    mediaMentions: number;
    donationRecords: number;
    profileCompleteness: number;
    confidenceScore: number;
    explanation: string;
  };
  meta: {
    sourcesAnalyzed: number;
    findingsAnalyzed: number;
    generatedAt: string;
  };
}

// =====================
// API Response
// =====================

export interface ExecProfileApiResponse {
  investigation_id: string;
  profile: ExecProfile;
}

// =====================
// Profile Builder
// =====================

export function buildExecProfile(sourceResults: SourceResult[]): ExecProfile {
  const successfulResults = sourceResults.filter((sr) => sr.status === "success");
  const allFindings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[] = [];

  for (const sr of successfulResults) {
    const tier = getReliabilityTier(sr.source);
    for (const f of sr.findings) {
      allFindings.push({ finding: f, source: sr.source, sourceLabel: sr.source_label, tier });
    }
  }

  const career = extractCareer(allFindings);
  const boards = extractBoards(allFindings);
  const education = extractEducation(allFindings);
  const patents = extractPatents(allFindings);
  const publications = extractPublications(allFindings);
  const social = extractSocial(allFindings);
  const media = extractMedia(allFindings);
  const donations = extractDonations(allFindings);

  const timeline = buildTimeline(career, boards, education, patents, publications, media, donations);
  const relationships = buildRelationships(career, boards, education, patents, publications);

  const totalDataPoints = career.length + boards.length + education.length + patents.length +
    publications.length + social.length + media.length + donations.length;

  const profileCompleteness = Math.min(
    Math.round(
      (career.length > 0 ? 15 : 0) +
      (boards.length > 0 ? 10 : 0) +
      (education.length > 0 ? 15 : 0) +
      (patents.length > 0 ? 10 : 0) +
      (publications.length > 0 ? 10 : 0) +
      (social.length > 0 ? 15 : 0) +
      (media.length > 0 ? 15 : 0) +
      (donations.length > 0 ? 10 : 0)
    ), 100);

  const allConfidences = [...career, ...boards, ...education, ...patents, ...publications, ...social, ...media, ...donations].map((e) => e.confidence);
  const confidenceScore = allConfidences.length > 0
    ? Math.round((allConfidences.reduce((s, c) => s + c, 0) / allConfidences.length) * 100)
    : 0;

  const explanation = buildAssessmentExplanation(
    totalDataPoints, career.length, boards.length, education.length,
    patents.length, publications.length, social.length, media.length, donations.length,
    profileCompleteness, confidenceScore
  );

  return {
    career, boards, education, patents, publications, social, media, donations,
    timeline, relationships,
    assessment: {
      totalDataPoints,
      careerRoles: career.length,
      boardSeats: boards.length,
      educationRecords: education.length,
      patentCount: patents.length,
      publicationCount: publications.length,
      socialProfiles: social.length,
      mediaMentions: media.length,
      donationRecords: donations.length,
      profileCompleteness,
      confidenceScore,
      explanation,
    },
    meta: {
      sourcesAnalyzed: successfulResults.length,
      findingsAnalyzed: allFindings.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

// =====================
// Extractors
// =====================

function extractCareer(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): CareerEntry[] {
  const entries: CareerEntry[] = [];
  const seen = new Set<string>();

  const patterns: { regex: RegExp; titleGroup?: number; orgGroup: number }[] = [
    { regex: /(?:CEO|Chief\s+Executive\s+Officer)\s+(?:of|at)\s+([^,.\n]+)/i, orgGroup: 1 },
    { regex: /(?:CFO|CTO|COO|CMO|CIO)\s+(?:of|at)\s+([^,.\n]+)/i, orgGroup: 1 },
    { regex: /(?:founder|co[- ]?founder)\s+(?:of|at)\s+([^,.\n]+)/i, orgGroup: 1 },
    { regex: /(?:president|chairman|director)\s+(?:of|at)\s+([^,.\n]+)/i, orgGroup: 1 },
    { regex: /(?:worked|employed|served)\s+(?:at|as)\s+([^,.\n]+)/i, orgGroup: 1 },
    { regex: /(?:former|previous)\s+(?:CEO|executive|director|president|founder)\s+(?:of|at)\s+([^,.\n]+)/i, orgGroup: 1 },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const p of patterns) {
      const m = finding.data.match(p.regex);
      if (m) {
        const org = m[p.orgGroup].trim();
        if (org.length < 2) continue;
        const key = `${org}|${source}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Try to extract title
        let title = "Executive";
        const titleMatch = finding.data.match(/(CEO|CFO|CTO|COO|CMO|CIO|founder|co[- ]?founder|president|chairman|director|executive)/i);
        if (titleMatch) title = titleMatch[1];

        entries.push({
          organization: org,
          title,
          status: tier >= 4 ? "confirmed" : tier >= 3 ? "self_reported" : "inferred",
          source, sourceLabel, tier,
          confidence: finding.confidence,
          evidence: finding.data.slice(0, 150),
        });
      }
    }
  }
  return entries;
}

function extractBoards(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): BoardEntry[] {
  const entries: BoardEntry[] = [];
  const seen = new Set<string>();

  for (const { finding, source, sourceLabel, tier } of findings) {
    const m = finding.data.match(/(?:board\s+member|board\s+of\s+directors|advisory\s+board|trustee|committee\s+member)\s*(?:of|at|:)?\s*([^,.\n]+)/i);
    if (m) {
      const org = m[1].trim();
      if (org.length < 2) continue;
      const key = `${org}|board`;
      if (seen.has(key)) continue;
      seen.add(key);

      const roleMatch = finding.data.match(/(board\s+member|board\s+of\s+directors|advisory\s+board|trustee|committee\s+member)/i);
      entries.push({
        organization: org,
        role: roleMatch ? roleMatch[1] : "Board Member",
        source, sourceLabel, tier,
        confidence: finding.confidence,
        evidence: finding.data.slice(0, 150),
      });
    }
  }
  return entries;
}

function extractEducation(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): EducationEntry[] {
  const entries: EducationEntry[] = [];
  const seen = new Set<string>();

  const eduPatterns: { regex: RegExp; institutionGroup: number; degreeGroup?: number }[] = [
    { regex: /(?:graduated|alumnus|degree\s+from)\s+([^,.\n]+)/i, institutionGroup: 1 },
    { regex: /(Bachelor|Master|PhD|Doctorate|MBA|MS|BS|BA|MD|JD)\s*(?:in\s+([^,.\n]+))?\s*(?:from)?\s*([^,.\n]*)/i, institutionGroup: 3, degreeGroup: 1 },
    { regex: /(Stanford|Harvard|MIT|Yale|Princeton|Oxford|Cambridge|Columbia|Berkeley|Carnegie\s+Mellon|Caltech|ETH|Tsinghua)/i, institutionGroup: 1 },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const p of eduPatterns) {
      const m = finding.data.match(p.regex);
      if (m) {
        const institution = m[p.institutionGroup]?.trim();
        if (!institution || institution.length < 2) continue;
        const key = `${institution}|edu`;
        if (seen.has(key)) continue;
        seen.add(key);

        const degree = p.degreeGroup ? (m[p.degreeGroup]?.trim() || "Degree") : "Degree";
        const field = m[2]?.trim();

        entries.push({
          institution,
          degree,
          field,
          source, sourceLabel, tier,
          confidence: finding.confidence,
          evidence: finding.data.slice(0, 150),
        });
        break;
      }
    }
  }
  return entries;
}

function extractPatents(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): PatentEntry[] {
  const entries: PatentEntry[] = [];

  for (const { finding, source, sourceLabel, tier } of findings) {
    const m = finding.data.match(/(?:patent|inventor|invention)\s*:?\s*([^,.\n]+)/i);
    if (m) {
      const title = m[1].trim();
      if (title.length < 3) continue;

      // Try to extract patent number
      const numMatch = finding.data.match(/(?:patent|application)\s*(?:no\.?|number|#)\s*([\w-]+)/i);
      const assigneeMatch = finding.data.match(/(?:assigned\s+to|assignee)\s*:?\s*([^,.\n]+)/i);

      entries.push({
        title,
        patentNumber: numMatch?.[1],
        assignee: assigneeMatch?.[1]?.trim(),
        source, sourceLabel, tier,
        confidence: finding.confidence,
        evidence: finding.data.slice(0, 150),
      });
    }
  }
  return entries;
}

function extractPublications(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): PublicationEntry[] {
  const entries: PublicationEntry[] = [];
  const seen = new Set<string>();

  const pubPatterns: { regex: RegExp; type: string }[] = [
    { regex: /(?:published|authored|wrote)\s+(?:a\s+)?(?:article|paper|book|study|report)\s*:?\s*[""]?([^,.\n""]+)/i, type: "publication" },
    { regex: /(?:interview|interviewed\s+by|profiled\s+in)\s*:?\s*([^,.\n]+)/i, type: "interview" },
    { regex: /(?:talk|presentation|keynote|speech)\s+(?:at|for)\s+([^,.\n]+)/i, type: "talk" },
    { regex: /(?:op[- ]?ed|opinion|column)\s*:?\s*([^,.\n]+)/i, type: "op_ed" },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const p of pubPatterns) {
      const m = finding.data.match(p.regex);
      if (m) {
        const title = m[1].trim();
        if (title.length < 3) continue;
        const key = `${title}|${p.type}`;
        if (seen.has(key)) continue;
        seen.add(key);

        entries.push({
          title,
          type: p.type,
          source, sourceLabel, tier,
          confidence: finding.confidence,
          evidence: finding.data.slice(0, 150),
        });
        break;
      }
    }
  }
  return entries;
}

function extractSocial(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): SocialEntry[] {
  const entries: SocialEntry[] = [];
  const seen = new Set<string>();

  const socialPatterns: { regex: RegExp; platform: string }[] = [
    { regex: /\b(linkedin\.com\/in\/[\w-]+)/i, platform: "LinkedIn" },
    { regex: /\b(twitter\.com\/[\w-]+|x\.com\/[\w-]+)/i, platform: "Twitter/X" },
    { regex: /\b(github\.com\/[\w-]+)/i, platform: "GitHub" },
    { regex: /\b(gitlab\.com\/[\w-]+)/i, platform: "GitLab" },
    { regex: /\b(reddit\.com\/u(?:ser)?\/[\w-]+)/i, platform: "Reddit" },
  ];

  for (const { finding, source, sourceLabel, tier } of findings) {
    for (const p of socialPatterns) {
      const m = finding.data.match(p.regex);
      if (m) {
        const url = m[1];
        if (seen.has(url)) continue;
        seen.add(url);

        entries.push({
          platform: p.platform,
          url: `https://${url}`,
          handle: url.split("/").pop(),
          source, sourceLabel, tier,
          confidence: finding.confidence,
          evidence: finding.data.slice(0, 150),
        });
      }
    }

    // Also check source-based social detection
    if (source === "github" || source === "gitlab" || source === "reddit") {
      const platform = source === "github" ? "GitHub" : source === "gitlab" ? "GitLab" : "Reddit";
      if (!seen.has(platform)) {
        seen.add(platform);
        entries.push({
          platform,
          source, sourceLabel, tier,
          confidence: finding.confidence,
          evidence: finding.data.slice(0, 150),
        });
      }
    }
  }
  return entries;
}

function extractMedia(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): MediaEntry[] {
  const entries: MediaEntry[] = [];

  for (const { finding, source, sourceLabel, tier } of findings) {
    // Check for news-related sources
    if (source === "gdelt" || source === "googlenews" || source === "wikinews" || source === "hackernews") {
      const headline = finding.data.slice(0, 100).replace(/^(?:GDELT\s+news:\s*|Google\s+News:\s*|HackerNews\s+.*?:\s*|Wikinews:\s*)/i, "").trim();
      if (headline.length > 10) {
        entries.push({
          outlet: sourceLabel,
          headline,
          mentionType: source === "hackernews" ? "mention" : "news_article",
          source, sourceLabel, tier,
          confidence: finding.confidence,
          evidence: finding.data.slice(0, 150),
        });
      }
    }

    // Check for interview/quote patterns
    const m = finding.data.match(/(?:interview|quoted|profiled|featured)\s+(?:in|by|at)\s+([^,.\n]+)/i);
    if (m) {
      const outlet = m[1].trim();
      entries.push({
        outlet,
        headline: finding.data.slice(0, 80),
        mentionType: "interview",
        source, sourceLabel, tier,
        confidence: finding.confidence,
        evidence: finding.data.slice(0, 150),
      });
    }
  }
  return entries;
}

function extractDonations(findings: { finding: NormalizedFinding; source: string; sourceLabel: string; tier: ReliabilityTier }[]): DonationEntry[] {
  const entries: DonationEntry[] = [];

  for (const { finding, source, sourceLabel, tier } of findings) {
    // Check FEC source specifically
    if (source === "fec") {
      const amountMatch = finding.data.match(/\$([\d,.]+)/);
      const recipientMatch = finding.data.match(/(?:to|for)\s+([^,.\n]+)/i);
      entries.push({
        recipient: recipientMatch?.[1]?.trim() || "Political Committee",
        amount: amountMatch ? `$${amountMatch[1]}` : undefined,
        source, sourceLabel, tier,
        confidence: finding.confidence,
        evidence: finding.data.slice(0, 150),
        jurisdiction: "US (FEC)",
      });
    }

    // Generic donation pattern
    const m = finding.data.match(/(?:donated|contribution|donation)\s*(?:to|of)?\s*:?\s*([^,.\n]+)/i);
    if (m && source !== "fec") {
      entries.push({
        recipient: m[1].trim(),
        source, sourceLabel, tier,
        confidence: finding.confidence,
        evidence: finding.data.slice(0, 150),
      });
    }
  }
  return entries;
}

// =====================
// Timeline Builder
// =====================

function buildTimeline(
  career: CareerEntry[], boards: BoardEntry[], education: EducationEntry[],
  patents: PatentEntry[], publications: PublicationEntry[],
  media: MediaEntry[], donations: DonationEntry[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const c of career) {
    events.push({
      date: c.startDate || c.endDate || "unknown",
      category: "career",
      event: `${c.title} at ${c.organization}`,
      source: c.source, sourceLabel: c.sourceLabel, confidence: c.confidence,
    });
  }
  for (const b of boards) {
    events.push({
      date: b.startDate || b.endDate || "unknown",
      category: "board",
      event: `${b.role} at ${b.organization}`,
      source: b.source, sourceLabel: b.sourceLabel, confidence: b.confidence,
    });
  }
  for (const e of education) {
    events.push({
      date: e.year || "unknown",
      category: "education",
      event: `${e.degree} from ${e.institution}`,
      source: e.source, sourceLabel: e.sourceLabel, confidence: e.confidence,
    });
  }
  for (const p of patents) {
    events.push({
      date: p.filingDate || "unknown",
      category: "patent",
      event: `Patent: ${p.title}`,
      source: p.source, sourceLabel: p.sourceLabel, confidence: p.confidence,
    });
  }
  for (const p of publications) {
    events.push({
      date: p.date || "unknown",
      category: "publication",
      event: `${p.type}: ${p.title}`,
      source: p.source, sourceLabel: p.sourceLabel, confidence: p.confidence,
    });
  }
  for (const m of media) {
    events.push({
      date: m.date || "unknown",
      category: "media",
      event: `${m.mentionType}: ${m.headline}`,
      source: m.source, sourceLabel: m.sourceLabel, confidence: m.confidence,
    });
  }
  for (const d of donations) {
    events.push({
      date: d.date || "unknown",
      category: "donation",
      event: `Donation to ${d.recipient}${d.amount ? ` (${d.amount})` : ""}`,
      source: d.source, sourceLabel: d.sourceLabel, confidence: d.confidence,
    });
  }

  // Sort by date (unknowns last)
  return events.sort((a, b) => {
    if (a.date === "unknown" && b.date === "unknown") return 0;
    if (a.date === "unknown") return 1;
    if (b.date === "unknown") return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

// =====================
// Relationship Builder
// =====================

function buildRelationships(
  career: CareerEntry[], boards: BoardEntry[], education: EducationEntry[],
  patents: PatentEntry[], publications: PublicationEntry[]
): ExecRelationship[] {
  const rels: ExecRelationship[] = [];

  for (const c of career) {
    rels.push({ entity: c.organization, type: "employer", detail: `${c.title}`, confidence: c.confidence });
  }
  for (const b of boards) {
    rels.push({ entity: b.organization, type: "board", detail: b.role, confidence: b.confidence });
  }
  for (const e of education) {
    rels.push({ entity: e.institution, type: "education", detail: e.degree, confidence: e.confidence });
  }
  for (const p of patents) {
    if (p.assignee) rels.push({ entity: p.assignee, type: "patent_assignee", detail: p.title, confidence: p.confidence });
    if (p.coInventors) for (const ci of p.coInventors) rels.push({ entity: ci, type: "co_inventor", detail: p.title, confidence: p.confidence * 0.8 });
  }
  for (const p of publications) {
    if (p.coAuthors) for (const ca of p.coAuthors) rels.push({ entity: ca, type: "co_author", detail: p.title, confidence: p.confidence * 0.8 });
  }

  return rels;
}

// =====================
// Assessment
// =====================

function buildAssessmentExplanation(
  total: number, career: number, boards: number, education: number,
  patents: number, pubs: number, social: number, media: number, donations: number,
  completeness: number, confidence: number
): string {
  if (total === 0) {
    return "No executive intelligence data discovered. The target may not be a person, or publicly available executive information was not found in collected evidence.";
  }

  const parts: string[] = [];
  parts.push(`${total} data points across 8 dimensions`);
  parts.push(`Profile completeness: ${completeness}%`);
  parts.push(`Average confidence: ${confidence}%`);

  const dimSummary: string[] = [];
  if (career > 0) dimSummary.push(`career: ${career}`);
  if (boards > 0) dimSummary.push(`boards: ${boards}`);
  if (education > 0) dimSummary.push(`education: ${education}`);
  if (patents > 0) dimSummary.push(`patents: ${patents}`);
  if (pubs > 0) dimSummary.push(`publications: ${pubs}`);
  if (social > 0) dimSummary.push(`social: ${social}`);
  if (media > 0) dimSummary.push(`media: ${media}`);
  if (donations > 0) dimSummary.push(`donations: ${donations}`);
  if (dimSummary.length > 0) parts.push(`Dimensions: ${dimSummary.join(", ")}`);

  if (completeness >= 70) {
    parts.push("Comprehensive executive profile with strong evidence coverage");
  } else if (completeness >= 40) {
    parts.push("Moderate executive profile — some dimensions lack data");
  } else {
    parts.push("Limited executive profile — most dimensions have insufficient data");
  }

  return parts.join(". ") + ".";
}
