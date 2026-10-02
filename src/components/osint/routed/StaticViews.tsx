"use client";

// Static & documentation views. These are content-driven pages (docs, legal,
// sitemap, error states) that don't require backend data. Each is a fully
// functional, navigable page with breadcrumbs and consistent styling.

import { useState } from "react";
import {
  BookOpen,
  Info,
  ShieldCheck,
  FileCheck,
  Scale,
  GitCommitHorizontal,
  Code2,
  Map,
  LifeBuoy,
  MessageSquare,
  AlertOctagon,
  FileQuestion,
  Wrench,
  Home,
  ArrowLeft,
  Terminal,
} from "lucide-react";
import { PageHeader } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate, useRoute } from "@/lib/router/useRouter";
import { ROUTE_PATTERNS, ROUTE_GROUPS } from "@/lib/router/registry";
import type { Route } from "@/lib/router/types";
import * as LucideIcons from "lucide-react";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      {children}
    </div>
  );
}

// ─── Documentation index ─────────────────────────────────────────────────────
export function DocsView() {
  const navigate = useNavigate();
  const cards: { route: Route; icon: typeof BookOpen; title: string; desc: string }[] = [
    { route: { name: "docs-about" }, icon: Info, title: "About OSINTiger", desc: "What the platform does, its architecture, and design principles." },
    { route: { name: "docs-playbooks" }, icon: BookOpen, title: "Playbook Guide", desc: "The 10 domain-aware investigation playbooks and when to use each." },
    { route: { name: "docs-api" }, icon: Code2, title: "API Reference", desc: "REST API endpoints, request/response shapes, and auth model." },
    { route: { name: "docs-changelog" }, icon: GitCommitHorizontal, title: "Changelog", desc: "Release history and feature evolution across versions." },
    { route: { name: "docs-privacy" }, icon: ShieldCheck, title: "Privacy Policy", desc: "Data handling, retention, and user privacy commitments." },
    { route: { name: "docs-terms" }, icon: FileCheck, title: "Terms of Service", desc: "Acceptable use, limitations, and user responsibilities." },
    { route: { name: "docs-legal" }, icon: Scale, title: "Legal Disclaimer", desc: "Compliance, attribution, and lawful-use obligations." },
    { route: { name: "sitemap" }, icon: Map, title: "Sitemap", desc: "Complete map of every route in the application." },
  ];
  return (
    <Shell>
      <PageHeader icon={BookOpen} title="Documentation" subtitle="// guides · references · policies" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <button
            key={c.title}
            onClick={() => navigate(c.route)}
            className="group text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-4 transition hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5"
          >
            <c.icon className="h-5 w-5 text-[var(--hack-green)] mb-2" />
            <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase tracking-wider">{c.title}</h3>
            <p className="mt-1 text-xs text-[var(--hack-gray)] leading-relaxed">{c.desc}</p>
          </button>
        ))}
      </div>
    </Shell>
  );
}

// ─── About ───────────────────────────────────────────────────────────────────
export function DocsAboutView() {
  return (
    <Shell>
      <PageHeader icon={Info} title="About OSINTiger" subtitle="// anonymous intelligence platform" accent="cyan" />
      <div className="prose-hack max-w-3xl space-y-4 text-sm text-[var(--hack-gray)] font-mono leading-relaxed">
        <p>
          OSINTiger is an <span className="text-[var(--hack-green)]">anonymous OSINT investigation platform</span> that aggregates
          intelligence from <span className="text-[var(--hack-cyan)]">74+ free public APIs</span>, synthesizes findings with AI,
          and enforces strict <span className="text-[var(--hack-cyan)]">[SOURCE]</span> attribution under a zero-hallucination protocol.
        </p>
        <p>
          The platform supports five investigation modes — Standard Pipeline, Autonomous Agent, Recursive Discovery,
          AI Plan, and Live Monitoring — each addressing a distinct intelligence workflow.
        </p>
        <h2 className="text-[var(--hack-green)] text-base uppercase tracking-wider mt-6 mb-2">Design Principles</h2>
        <ul className="list-disc list-inside space-y-1">
          <li><span className="text-[var(--hack-green)]">Source attribution enforced</span> — every claim links to its origin.</li>
          <li><span className="text-[var(--hack-green)]">Zero hallucination</span> — the AI never invents sources or data.</li>
          <li><span className="text-[var(--hack-green)]">Public data only</span> — no breached or stolen datasets.</li>
          <li><span className="text-[var(--hack-green)]">Competing hypotheses</span> — ACH matrix preserves alternative explanations.</li>
          <li><span className="text-[var(--hack-green)]">Durable provenance</span> — every evidence point is traceable to its collection event.</li>
        </ul>
        <h2 className="text-[var(--hack-green)] text-base uppercase tracking-wider mt-6 mb-2">Architecture</h2>
        <p>
          8-step agentic pipeline (Parse → Route → Query → Normalize → Synthesize → ACH → Attribute → Format),
          backed by Prisma/SQLite, 12 Prisma models, 60+ UI components, and a client-side hash router for
          deep-linkable, bookmarkable URLs across 60+ routes.
        </p>
        <p className="text-[var(--hack-gray)]/60 text-xs mt-6">
          {"// For research & educational use. Users are responsible for compliance with applicable laws and source Terms of Service."}
        </p>
      </div>
    </Shell>
  );
}

// ─── Changelog ───────────────────────────────────────────────────────────────
export function DocsChangelogView() {
  const releases = [
    { v: "2.0.0", date: "2025", title: "Production Routing Architecture", items: ["Comprehensive hash-based SPA router with 60+ routes", "Full lifecycle coverage: discovery → execution → completion → archival", "Sidebar navigation, breadcrumbs, command palette, sitemap", "Audit log, notifications, collections, background jobs, system metrics", "Settings center: LLM provider, API keys, preferences, export/import"] },
    { v: "1.9.0", date: "2025", title: "Bring Your Own AI Agent", items: ["Multi-provider LLM support (OpenAI, Anthropic)", "AES-256-GCM encrypted credential storage", "Runtime routing with fallback to default", "Validation & health-checks"] },
    { v: "1.8.0", date: "2025", title: "Social Media Intelligence Engine", items: ["12 platform adapters in parallel", "Cross-platform entity resolution & sentiment", "Conversation graph, topic extraction, influencer discovery"] },
    { v: "1.7.0", date: "2025", title: "Visual Intelligence Dashboard", items: ["9 visualization types (force graph, timeline, geo map, Sankey, …)", "Interactive, filterable, SVG-based"] },
    { v: "1.6.0", date: "2025", title: "Provenance & Evidence Chain", items: ["Immutable 10-attribute event log", "43 JSON.parse calls hardened", "Tamper-evident integrity hashes"] },
    { v: "1.5.0", date: "2025", title: "Multi-Agent Debate", items: ["7 specialized agents + coordinator synthesis", "Sequential execution, conflict identification"] },
    { v: "1.4.0", date: "2025", title: "Knowledge Base", items: ["6 Prisma models for durable intelligence", "Auto-ingest, version history, conflict preservation"] },
  ];
  return (
    <Shell>
      <PageHeader icon={GitCommitHorizontal} title="Changelog" subtitle="// release history" accent="cyan" />
      <div className="space-y-6 max-w-3xl">
        {releases.map((r) => (
          <div key={r.v} className="border border-[var(--hack-border)] bg-black/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-[var(--hack-green)]">v{r.v}</span>
                <span className="font-mono text-xs text-[var(--hack-gray)]">— {r.title}</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--hack-gray)]/60">{r.date}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-xs text-[var(--hack-gray)] font-mono">
              {r.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Privacy / Terms / Legal ────────────────────────────────────────────────
export function DocsPrivacyView() {
  return (
    <Shell>
      <PageHeader icon={ShieldCheck} title="Privacy Policy" subtitle="// data handling & retention" accent="cyan" />
      <LegalBody
        sections={[
          { h: "Data Collection", p: "OSINTiger stores investigation targets, collected findings, AI-synthesized reports, knowledge-base entities, provenance events, audit logs, and user-configured preferences. All data resides in a local SQLite database on the host running the platform." },
          { h: "Credentials", p: "User-supplied LLM provider API keys (OpenAI, Anthropic) and source API keys are encrypted at rest using AES-256-GCM. Keys are never returned in full via any API; only masked representations are exposed." },
          { h: "Third-Party APIs", p: "Investigations query 74+ external public APIs. Each source has its own privacy policy and terms. OSINTiger sends the investigation target to these sources but does not transmit user identity." },
          { h: "Retention", p: "Investigation records are retained until manually deleted or until their cache expiry elapses. Knowledge-base entities persist indefinitely unless deprecated. Audit logs are immutable and retained for compliance." },
          { h: "User Control", p: "Users may delete any investigation, clear the knowledge base, export all data, and remove stored credentials at any time via the Settings and respective management routes." },
        ]}
      />
    </Shell>
  );
}

export function DocsTermsView() {
  return (
    <Shell>
      <PageHeader icon={FileCheck} title="Terms of Service" subtitle="// acceptable use" accent="cyan" />
      <LegalBody
        sections={[
          { h: "Acceptable Use", p: "OSINTiger is provided for research, educational, and lawful investigative purposes. Users must comply with all applicable local, national, and international laws when conducting investigations." },
          { h: "Source Compliance", p: "Each integrated source has its own Terms of Service. Users are responsible for adhering to source-specific rate limits, attribution requirements, and usage restrictions. OSINTiger enforces attribution but cannot enforce all source ToS provisions." },
          { h: "No Warranty", p: "The platform is provided 'as is' without warranty of any kind. Intelligence outputs are advisory and must be independently verified before any consequential action." },
          { h: "Limitation of Liability", p: "The operators of OSINTiger are not liable for damages arising from the use or misuse of the platform, including decisions made based on its outputs." },
          { h: "Sanctions Screening", p: "OFAC/Interpol screening is a tool only. Definitive sanctions status requires manual verification against official government sources. A 'no match' result does not constitute legal clearance." },
        ]}
      />
    </Shell>
  );
}

export function DocsLegalView() {
  return (
    <Shell>
      <PageHeader icon={Scale} title="Legal Disclaimer" subtitle="// compliance & lawful use" accent="amber" />
      <LegalBody
        sections={[
          { h: "Research & Educational Use", p: "OSINTiger is designed for research, journalism, due diligence, security research, and educational purposes. The platform aggregates publicly available information only." },
          { h: "No Stolen Data", p: "The platform does not ingest, display, or process breached or stolen datasets. All sources are publicly accessible APIs and registries." },
          { h: "Attribution", p: "Every finding is attributed to its source. Users must preserve this attribution when sharing or acting on intelligence outputs." },
          { h: "AI Synthesis", p: "AI-generated summaries are clearly labeled and source-grounded. The zero-hallucination protocol requires the AI to cite evidence or refuse. Users should still verify critical claims against primary sources." },
          { h: "Jurisdiction", p: "Users are solely responsible for ensuring their use of OSINTiger complies with the laws of their jurisdiction, including data protection (GDPR, CCPA), surveillance, and cybercrime statutes." },
        ]}
      />
    </Shell>
  );
}

export function DocsApiView() {
  const navigate = useNavigate();
  return (
    <Shell>
      <PageHeader icon={Code2} title="API Reference" subtitle="// REST endpoints" accent="cyan" />
      <div className="max-w-3xl space-y-3 text-sm font-mono">
        <p className="text-[var(--hack-gray)]">
          {"// All endpoints are relative to the application root. Responses are JSON."}
        </p>
        {[
          { m: "POST", p: "/api/investigate", d: "Start a standard pipeline investigation" },
          { m: "GET", p: "/api/investigate/:id", d: "Poll investigation status & partial results" },
          { m: "DELETE", p: "/api/investigate/:id", d: "Delete an investigation" },
          { m: "PATCH", p: "/api/investigate/:id/metadata", d: "Star, tag, annotate, bookmark findings" },
          { m: "POST", p: "/api/agent/investigate", d: "Start an autonomous agent investigation" },
          { m: "POST", p: "/api/discover", d: "Start a recursive discovery session" },
          { m: "POST", p: "/api/plan", d: "Start an AI-planned investigation" },
          { m: "POST", p: "/api/monitor", d: "Start a live monitoring session" },
          { m: "GET", p: "/api/recent", d: "List recent investigations (filterable)" },
          { m: "GET", p: "/api/sanctions/:name", d: "OFAC SDN fuzzy match for a name" },
          { m: "POST", p: "/api/sanctions/batch", d: "Bulk sanctions screening" },
          { m: "GET", p: "/api/crypto/:wallet", d: "Ethereum wallet analysis" },
          { m: "POST", p: "/api/analyze-image", d: "VLM image analysis (file or URL)" },
          { m: "GET", p: "/api/kb/stats", d: "Knowledge base statistics" },
          { m: "GET", p: "/api/kb/search?q=", d: "Search KB entities" },
          { m: "GET", p: "/api/kb/entity/:id", d: "KB entity detail with evidence" },
          { m: "GET", p: "/api/provenance/:investigationId", d: "Provenance events for an investigation" },
          { m: "GET", p: "/api/export/:id", d: "Export investigation as JSON/Markdown" },
          { m: "GET", p: "/api/audit", d: "Audit log (filterable)" },
          { m: "GET", p: "/api/system/status", d: "System health & status" },
          { m: "GET/POST/DELETE", p: "/api/llm-config", d: "BYO-LLM provider configuration" },
          { m: "GET/POST/DELETE", p: "/api/source-keys", d: "Source API key management" },
        ].map((e, i) => (
          <div key={`${e.m}-${e.p}-${i}`} className="flex items-start gap-3 border border-[var(--hack-border)] bg-black/20 p-2.5">
            <span className="text-[10px] font-bold text-[var(--hack-cyan)] uppercase mt-0.5 shrink-0 w-28">{e.m}</span>
            <code className="text-xs text-[var(--hack-green)] break-all">{e.p}</code>
            <span className="text-xs text-[var(--hack-gray)] ml-auto text-right">{e.d}</span>
          </div>
        ))}
        <button
          onClick={() => navigate({ name: "system-health" })}
          className="mt-4 text-xs text-[var(--hack-cyan)] hover:text-[var(--hack-green)] underline"
        >
          View live system health →
        </button>
      </div>
    </Shell>
  );
}

export function DocsPlaybooksView() {
  return (
    <Shell>
      <PageHeader icon={BookOpen} title="Playbook Guide" subtitle="// 10 domain-aware investigation playbooks" accent="cyan" />
      <div className="max-w-3xl space-y-3">
        {[
          { name: "Corporate Due Diligence", when: "Pre-investment / partnership evaluation", focus: "Financials, leadership, litigation, regulatory history" },
          { name: "Executive Background", when: "Hiring / partnership vetting", focus: "Career history, affiliations, public records, reputation" },
          { name: "Threat Actor Profiling", when: "Incident response / threat intelligence", focus: "TTPs, attribution, infrastructure, campaign links" },
          { name: "Infrastructure Reconnaissance", when: "Attack surface mapping", focus: "DNS, certificates, subdomains, exposed services" },
          { name: "Brand Protection", when: "Brand abuse / impersonation detection", focus: "Typosquats, fake accounts, counterfeit listings" },
          { name: "Vendor Risk Assessment", when: "Third-party / supply chain risk", focus: "Security posture, certifications, breach history" },
          { name: "Supply Chain Mapping", when: "Dependency & concentration risk", focus: "Tier mapping, geographic concentration, single points of failure" },
          { name: "Incident Response Support", when: "Active incident triage", focus: "Indicator enrichment, scope expansion, attribution leads" },
          { name: "M&A Intelligence", when: "Merger & acquisition due diligence", focus: "Synergies, hidden liabilities, cultural fit, regulatory" },
          { name: "Fraud Investigation", when: "Fraud detection & investigation", focus: "Entity networks, financial flows, anomalies, sanctions" },
        ].map((pb) => (
          <div key={pb.name} className="border border-[var(--hack-border)] bg-black/20 p-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)]">{pb.name}</h3>
            </div>
            <p className="text-xs text-[var(--hack-cyan)] font-mono mb-1">When: {pb.when}</p>
            <p className="text-xs text-[var(--hack-gray)] font-mono">Focus: {pb.focus}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function LegalBody({ sections }: { sections: { h: string; p: string }[] }) {
  return (
    <div className="max-w-3xl space-y-4">
      {sections.map((s) => (
        <div key={s.h}>
          <h2 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase tracking-wider mb-1">{s.h}</h2>
          <p className="text-xs text-[var(--hack-gray)] font-mono leading-relaxed">{s.p}</p>
        </div>
      ))}
      <p className="text-[10px] text-[var(--hack-gray)]/50 font-mono mt-6">
        {"// This document is for informational purposes and does not constitute legal advice."}
      </p>
    </div>
  );
}

// ─── Sitemap ─────────────────────────────────────────────────────────────────
export function SitemapView() {
  const navigate = useNavigate();
  return (
    <Shell>
      <PageHeader icon={Map} title="Sitemap" subtitle="// complete route map" accent="cyan" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROUTE_GROUPS.filter((g) => g.group !== "error").map((g) => {
          const routes = ROUTE_PATTERNS.filter((r) => r.group === g.group && r.name !== "not-found" && r.name !== "error" && r.name !== "maintenance");
          return (
            <div key={g.group} className="border border-[var(--hack-border)] bg-black/20 p-3">
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--hack-border)]">
                <DynIcon name={g.icon} className="h-3.5 w-3.5 text-[var(--hack-green)]" />
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--hack-green)]">{g.label}</h3>
              </div>
              <ul className="space-y-1">
                {routes.map((r) => (
                  <li key={r.name}>
                    <button
                      onClick={() => navigate({ name: r.name } as Route)}
                      className="flex items-center gap-2 w-full text-left text-xs font-mono text-[var(--hack-gray)] hover:text-[var(--hack-green)] transition py-0.5"
                    >
                      <DynIcon name={r.icon} className="h-3 w-3 text-[var(--hack-gray)]/60 shrink-0" />
                      <span className="truncate">{r.title}</span>
                      <code className="ml-auto text-[9px] text-[var(--hack-cyan)]/50 truncate max-w-[80px]">{r.path}</code>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function DynIcon({ name, className }: { name: string; className?: string }) {
  const Cmp = (LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>)[name] || LucideIcons.Circle;
  return <Cmp className={className} />;
}

// ─── Support & Feedback ─────────────────────────────────────────────────────
export function SupportView() {
  const navigate = useNavigate();
  return (
    <Shell>
      <PageHeader icon={LifeBuoy} title="Support" subtitle="// help & resources" accent="cyan" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <button onClick={() => navigate({ name: "docs" })} className="text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-4 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition">
          <BookOpen className="h-5 w-5 text-[var(--hack-green)] mb-2" />
          <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase">Documentation</h3>
          <p className="text-xs text-[var(--hack-gray)] mt-1">Guides, API reference, and policies.</p>
        </button>
        <button onClick={() => navigate({ name: "feedback" })} className="text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-4 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition">
          <MessageSquare className="h-5 w-5 text-[var(--hack-green)] mb-2" />
          <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase">Send Feedback</h3>
          <p className="text-xs text-[var(--hack-gray)] mt-1">Report bugs, request features, or ask questions.</p>
        </button>
        <button onClick={() => navigate({ name: "system-status" })} className="text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-4 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition">
          <Terminal className="h-5 w-5 text-[var(--hack-green)] mb-2" />
          <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase">System Status</h3>
          <p className="text-xs text-[var(--hack-gray)] mt-1">Check platform health and ongoing operations.</p>
        </button>
        <button onClick={() => navigate({ name: "sitemap" })} className="text-left border border-[var(--hack-border)] bg-[var(--hack-surface)] p-4 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition">
          <Map className="h-5 w-5 text-[var(--hack-green)] mb-2" />
          <h3 className="font-mono text-sm font-semibold text-[var(--hack-green)] uppercase">Sitemap</h3>
          <p className="text-xs text-[var(--hack-gray)] mt-1">Browse every available route.</p>
        </button>
      </div>
    </Shell>
  );
}

export function FeedbackView() {
  const route = useRoute();
  return (
    <Shell>
      <PageHeader icon={MessageSquare} title="Feedback" subtitle="// report bugs · request features · ask questions" accent="cyan" />
      <FeedbackForm routeName={route.name} />
    </Shell>
  );
}

function FeedbackForm({ routeName }: { routeName: string }) {
  const [kind, setKind] = useState("feedback");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState("");
  const [severity, setSeverity] = useState("normal");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function submit() {
    if (!subject.trim() || !body.trim()) return;
    setStatus("submitting");
    setErrorMsg("");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject, body, contact, severity, routeName }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `Request failed (${r.status})`);
      }
      setStatus("done");
      setSubject("");
      setBody("");
      setContact("");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Submission failed");
    }
  }

  if (status === "done") {
    return (
      <div className="max-w-xl border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 p-6 text-center">
        <p className="font-mono text-sm text-[var(--hack-green)] mb-3">{"// FEEDBACK RECEIVED — thank you"}</p>
        <button onClick={() => setStatus("idle")} className="text-xs text-[var(--hack-cyan)] hover:underline font-mono">
          Submit another →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-3">
      <div className="flex flex-wrap gap-2">
        {["feedback", "bug", "feature", "question"].map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`border px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition ${kind === k ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]" : "border-[var(--hack-border)] text-[var(--hack-gray)] hover:text-[var(--hack-green)]"}`}>
            {k}
          </button>
        ))}
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={200} className="w-full bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-sm font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-green)]/40" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Describe your feedback in detail…" rows={6} maxLength={5000} className="w-full bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-sm font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-green)]/40 resize-y" />
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contact (optional, for reply)" maxLength={200} className="flex-1 bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-xs font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none focus:border-[var(--hack-green)]/40" />
        <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="bg-[var(--hack-surface)] border border-[var(--hack-border)] px-3 py-2 text-xs font-mono text-[var(--hack-green)] focus:outline-none">
          <option value="low">low</option>
          <option value="normal">normal</option>
          <option value="high">high</option>
          <option value="critical">critical</option>
        </select>
      </div>
      {errorMsg && <p className="text-xs text-[var(--hack-red)] font-mono">{errorMsg}</p>}
      <button onClick={submit} disabled={status === "submitting" || !subject.trim() || !body.trim()} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-5 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/20 disabled:opacity-40 disabled:cursor-not-allowed transition">
        {status === "submitting" ? "Submitting…" : "Submit Feedback"}
      </button>
    </div>
  );
}

// ─── Error states ────────────────────────────────────────────────────────────
export function NotFoundView() {
  const navigate = useNavigate();
  const route = useRoute();
  return (
    <Shell>
      <div className="mx-auto max-w-2xl text-center py-16">
        <FileQuestion className="h-16 w-16 text-[var(--hack-red)]/60 mx-auto mb-4" />
        <h1 className="text-3xl font-bold font-mono text-[var(--hack-red)] mb-2">404</h1>
        <p className="text-sm text-[var(--hack-gray)] font-mono mb-1">{"// route not found"}</p>
        <code className="text-xs text-[var(--hack-cyan)] font-mono block mb-6">
          {typeof window !== "undefined" ? window.location.hash : "#/"}
        </code>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button onClick={() => navigate({ name: "home" })} className="flex items-center gap-1.5 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/15">
            <Home className="h-3.5 w-3.5" /> Command Center
          </button>
          <button onClick={() => navigate({ name: "sitemap" })} className="flex items-center gap-1.5 border border-[var(--hack-border)] px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-gray)] hover:text-[var(--hack-green)] hover:border-[var(--hack-green)]/40">
            <Map className="h-3.5 w-3.5" /> Sitemap
          </button>
        </div>
        <p className="mt-8 text-[10px] text-[var(--hack-gray)]/50 font-mono">
          route: <code className="text-[var(--hack-cyan)]/70">{route.name}</code>
        </p>
      </div>
    </Shell>
  );
}

export function ErrorView() {
  const route = useRoute();
  const navigate = useNavigate();
  const code = route.name === "error" ? route.query?.code : undefined;
  const message = route.name === "error" ? route.query?.message : undefined;
  return (
    <Shell>
      <div className="mx-auto max-w-2xl text-center py-16">
        <AlertOctagon className="h-16 w-16 text-[var(--hack-red)] mx-auto mb-4" />
        <h1 className="text-2xl font-bold font-mono text-[var(--hack-red)] mb-2">
          {code ? `Error ${code}` : "Something went wrong"}
        </h1>
        {message && <p className="text-sm text-[var(--hack-gray)] font-mono mb-6">{message}</p>}
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => navigate({ name: "home" })} className="flex items-center gap-1.5 border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/15">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to safety
          </button>
          <button onClick={() => navigate({ name: "support" })} className="border border-[var(--hack-border)] px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-gray)] hover:text-[var(--hack-green)] hover:border-[var(--hack-green)]/40">
            Get help
          </button>
        </div>
      </div>
    </Shell>
  );
}

export function MaintenanceView() {
  const navigate = useNavigate();
  return (
    <Shell>
      <div className="mx-auto max-w-2xl text-center py-16">
        <Wrench className="h-16 w-16 text-[var(--hack-amber)] mx-auto mb-4 animate-pulse" />
        <h1 className="text-2xl font-bold font-mono text-[var(--hack-amber)] mb-2">Under Maintenance</h1>
        <p className="text-sm text-[var(--hack-gray)] font-mono mb-6">
          {"// OSINTiger is temporarily offline for scheduled maintenance."}
        </p>
        <button onClick={() => navigate({ name: "system-status" })} className="border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 px-4 py-2 text-xs font-mono uppercase tracking-wider text-[var(--hack-green)] hover:bg-[var(--hack-green)]/15">
          Check system status
        </button>
      </div>
    </Shell>
  );
}
