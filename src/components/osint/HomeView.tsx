"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS } from "@/lib/osint/router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { initiateInvestigation, initiateAgentInvestigation, fetchRecent } from "@/lib/osint/client";
import {
  Search,
  Loader2,
  Zap,
  Globe,
  ShieldAlert,
  ScanEye,
  Wallet,
  Crosshair,
  Network,
  ChevronRight,
  Clock,
  FileText,
  Bot,
  Layers,
  Brain as BrainIcon,
  Radio,
} from "lucide-react";
import { VisualIntelPanel } from "./VisualIntelPanel";
import { CryptoPanel } from "./CryptoPanel";
import { SanctionsPanel } from "./SanctionsPanel";
import { BatchSanctionsPanel } from "./BatchSanctionsPanel";
import { PlaybookPicker } from "./PlaybookPicker";
import type { PlaybookType } from "@/lib/osint/client";

const SAMPLE_TARGETS = [
  { label: "Tesla, Inc.", type: "organization" },
  { label: "google.com", type: "domain" },
  { label: "8.8.8.8", type: "ip" },
  { label: "Vladimir Putin", type: "person" },
  { label: "CVE-2021-44228", type: "cve" },
  { label: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", type: "wallet" },
  { label: "user@example.com", type: "email" },
  { label: "@elonmusk", type: "username" },
  { label: "+1-202-555-0173", type: "phone" },
];

export function HomeView({
  onInvestigate,
  onAgentInvestigate,
  onStartDiscovery,
  onStartPlan,
  onStartMonitor,
  searchInputRef,
  onOpenHistory,
}: {
  onInvestigate: (id: string, target: string) => void;
  onAgentInvestigate?: (id: string, target: string) => void;
  onStartDiscovery?: (target: string, inputType: string) => void;
  onStartPlan?: (target: string, objective: string, inputType: string) => void;
  onStartMonitor?: (target: string, inputType: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onOpenHistory?: () => void;
}) {
  const [target, setTarget] = useState("");
  const [type, setType] = useState("auto");
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"standard" | "agent" | "discovery" | "plan" | "monitor">("standard");
  const [playbook, setPlaybook] = useState<PlaybookType | null>(null); // Feature 24
  const [module, setModule] = useState<"none" | "visual" | "crypto" | "sanctions" | "batch">("none");
  const [recents, setRecents] = useState<
    { id: string; target: string; input_type: string; status: string; created_at: string; confidence: number | null }[]
  >([]);

  useEffect(() => {
    fetchRecent()
      .then((r) => setRecents(r.investigations))
      .catch(() => {});
  }, []);

  async function investigate(t?: string, ty?: string) {
    const q = (t ?? target).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === "monitor" && onStartMonitor) {
        onStartMonitor(q, ty ?? (type === "auto" ? "" : type));
      } else if (mode === "plan" && onStartPlan) {
        onStartPlan(q, objective.trim() || `Comprehensive investigation of ${q}`, ty ?? (type === "auto" ? "" : type));
      } else if (mode === "discovery" && onStartDiscovery) {
        onStartDiscovery(q, ty ?? (type === "auto" ? "" : type));
      } else if (mode === "agent" && onAgentInvestigate) {
        const res = await initiateAgentInvestigation(q, {
          input_type: ty ?? (type === "auto" ? undefined : type),
        });
        onAgentInvestigate(res.investigation_id, q);
      } else {
        const res = await initiateInvestigation(q, {
          input_type: ty ?? (type === "auto" ? undefined : type),
          playbook: playbook || undefined, // Feature 24
        });
        onInvestigate(res.investigation_id, q);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Investigation failed to start");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
      {/* Hero */}
      <section className="max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 border border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5 px-3 py-1 mb-6 font-mono text-[11px] uppercase tracking-wider text-[var(--hack-green)]">
          <span className="h-1.5 w-1.5 bg-[var(--hack-green)] pulse-green" />
          8-STEP AGENTIC PIPELINE // {Object.keys(SOURCE_LABELS).length} SOURCES
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight font-mono">
          <span className="text-[var(--hack-green)]">OSIN</span>
          <span className="text-[var(--hack-cyan)]">Tiger</span>
          <span className="text-[var(--hack-green)] blink-cursor"></span>
        </h1>
        <p className="mt-4 text-base md:text-lg text-[var(--hack-gray)] font-mono">
          {"// Anonymous OSINT investigation platform. Multi-source aggregation, strict"} <span className="text-[var(--hack-cyan)] font-mono">[SOURCE]</span> {"attribution, competing-hypotheses analysis — zero hallucination protocol."}
        </p>

        {/* Search — terminal command line style */}
        <div className="mt-8 w-full">
          <div className="terminal-panel p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--hack-border)]">
              <span className="text-[var(--hack-green)] font-mono text-xs">$</span>
              <span className="text-[var(--hack-gray)] font-mono text-xs">investigate --target</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hack-green)]/50" />
                <Input
                  ref={searchInputRef}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && investigate()}
                  placeholder="name | company | domain | ip | email | @user | phone | cve | hash | url | 0x... | bc1..."
                  className="pl-9 h-10 bg-[var(--hack-surface)] border-[var(--hack-border)] text-sm font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-green)]/30 rounded-none"
                />
              </div>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10 w-full sm:w-36 bg-[var(--hack-surface)] border-[var(--hack-border)] text-xs font-mono rounded-none">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">auto-detect</SelectItem>
                  <SelectItem value="person">person</SelectItem>
                  <SelectItem value="organization">org</SelectItem>
                  <SelectItem value="domain">domain</SelectItem>
                  <SelectItem value="ip">ip</SelectItem>
                  <SelectItem value="email">email</SelectItem>
                  <SelectItem value="username">username</SelectItem>
                  <SelectItem value="phone">phone</SelectItem>
                  <SelectItem value="url">url</SelectItem>
                  <SelectItem value="hash">hash</SelectItem>
                  <SelectItem value="wallet">wallet</SelectItem>
                  <SelectItem value="cve">cve</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => investigate()}
                disabled={loading || !target.trim()}
                className={`h-10 px-6 font-mono text-xs uppercase tracking-wider rounded-none shrink-0 ${
                  mode === "agent"
                    ? "bg-[var(--hack-cyan)]/10 border border-[var(--hack-cyan)] text-[var(--hack-cyan)] hover:bg-[var(--hack-cyan)] hover:text-[var(--hack-bg)]"
                    : mode === "discovery"
                    ? "bg-[var(--hack-amber)]/10 border border-[var(--hack-amber)] text-[var(--hack-amber)] hover:bg-[var(--hack-amber)] hover:text-[var(--hack-bg)]"
                    : mode === "plan"
                    ? "bg-purple-500/10 border border-purple-500 text-[var(--hack-purple)] hover:bg-purple-500 hover:text-[var(--hack-bg)]"
                    : mode === "monitor"
                    ? "bg-[var(--hack-red)]/10 border border-[var(--hack-red)] text-[var(--hack-red)] hover:bg-[var(--hack-red)] hover:text-[var(--hack-bg)]"
                    : "bg-[var(--hack-green)]/10 border border-[var(--hack-green)] text-[var(--hack-green)] hover:bg-[var(--hack-green)] hover:text-[var(--hack-bg)]"
                }`}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "agent" ? <Bot className="h-4 w-4" /> : mode === "discovery" ? <Layers className="h-4 w-4" /> : mode === "plan" ? <BrainIcon className="h-4 w-4" /> : mode === "monitor" ? <Radio className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                {mode === "agent" ? "Agent" : mode === "discovery" ? "Discover" : mode === "plan" ? "Plan" : mode === "monitor" ? "Monitor" : "Execute"}
              </Button>
            </div>

            {/* Objective input — only shown in plan mode */}
            {mode === "plan" && (
              <div className="mt-2">
                <div className="flex items-center gap-2 border border-[var(--hack-border)] bg-[var(--hack-surface)] px-3 py-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-[var(--hack-cyan)] shrink-0" />
                  <input
                    type="text"
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && investigate()}
                    placeholder="Investigation objective (e.g., 'Assess this domain for investment due diligence')"
                    maxLength={500}
                    className="flex-1 bg-transparent text-xs font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none"
                  />
                </div>
                <p className="font-mono text-[9px] text-[var(--hack-gray)]/50 mt-1 ml-1">
                  The AI will generate a custom investigation plan based on this objective. Leave empty for a general investigation.
                </p>
              </div>
            )}

            {/* Mode toggle — 4 modes */}
            <div className="flex items-center gap-2 mt-2 mb-2 flex-wrap">
              <button
                onClick={() => setMode("standard")}
                className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  mode === "standard"
                    ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
                    : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-green)]"
                }`}
              >
                <Zap className="h-3 w-3" />
                Standard Pipeline
              </button>
              <button
                onClick={() => setMode("agent")}
                className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  mode === "agent"
                    ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]"
                    : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-cyan)]"
                }`}
              >
                <Bot className="h-3 w-3" />
                Autonomous Agent
              </button>
              <button
                onClick={() => setMode("discovery")}
                className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  mode === "discovery"
                    ? "border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10 text-[var(--hack-amber)]"
                    : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-amber)]"
                }`}
              >
                <Layers className="h-3 w-3" />
                Recursive Discovery
              </button>
              <button
                onClick={() => setMode("plan")}
                className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  mode === "plan"
                    ? "border-purple-500/40 bg-purple-500/10 text-[var(--hack-purple)]"
                    : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-purple)]"
                }`}
              >
                <BrainIcon className="h-3 w-3" />
                AI Plan
              </button>
              <button
                onClick={() => setMode("monitor")}
                className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  mode === "monitor"
                    ? "border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10 text-[var(--hack-red)]"
                    : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:text-[var(--hack-red)]"
                }`}
              >
                <Radio className="h-3 w-3" />
                Live Monitoring
                <span className="text-[var(--hack-gray)]/60">— change detection</span>
              </button>
              {error && (
                <span className="font-mono text-[10px] text-[var(--hack-red)] ml-auto">{error}</span>
              )}
            </div>

            {/* Playbook picker — Feature 24 (only shown in standard mode) */}
            {mode === "standard" && (
              <div className="mt-3 border-t border-[var(--hack-border)] pt-3">
                <PlaybookPicker
                  inputType={type === "auto" ? "domain" : type}
                  selected={playbook}
                  onSelect={setPlaybook}
                />
              </div>
            )}

            {/* Sample targets */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="text-[var(--hack-gray)]">{"// try:"}</span>
              {SAMPLE_TARGETS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => investigate(s.label, s.type)}
                  className="border border-[var(--hack-border)] bg-transparent px-2.5 py-1 text-[var(--hack-cyan)] transition hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)] hover:bg-[var(--hack-green)]/5"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capability cards */}
      <section className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 stagger">
        <CapCard
          icon={Crosshair}
          title="Full Investigation"
          desc="8-step agentic pipeline. Parallel multi-source query, AI synthesis, ACH, OFAC, geo map."
          accent
          onClick={() => setModule("none")}
        />
        <CapCard
          icon={ScanEye}
          title="Visual Intelligence"
          desc="Upload or link an image — VLM extracts geolocation cues, text, objects, manipulation signals."
          onClick={() => setModule("visual")}
        />
        <CapCard
          icon={Wallet}
          title="Crypto Tracing"
          desc="Ethereum wallet analysis: balance, transactions, counterparty clustering, AI risk score."
          onClick={() => setModule("crypto")}
        />
        <CapCard
          icon={ShieldAlert}
          title="Sanctions Screening"
          desc="OFAC SDN fuzzy matching with Levenshtein + token overlap. Top-5 ranked matches."
          onClick={() => setModule("sanctions")}
        />
        <CapCard
          icon={FileText}
          title="Batch Screening"
          desc="Bulk OFAC SDN check for lists of names. CSV export, summary stats, per-name results."
          onClick={() => setModule("batch")}
        />
      </section>

      {/* Pipeline diagram */}
      <section className="mt-12">
        <PipelineDiagram />
      </section>

      {/* Sources */}
      <section className="mt-12">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header mb-3">
          Integrated Sources // {Object.keys(SOURCE_LABELS).length} APIs // no-key free tier
        </h2>
        <div className="max-h-72 overflow-y-auto custom-scroll border border-[var(--hack-border)] bg-black/20 p-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(SOURCE_LABELS).map(([key, name]) => {
              const Icon = key === "ofac" || key === "opensanctions" || key === "interpol" || key === "cisa_kev"
                ? ShieldAlert
                : key === "etherscan" || key === "blockchair" || key === "blockstream" || key === "mempool" || key === "bitcoinabuse"
                ? Wallet
                : key === "crtsh" || key === "doh" || key === "dns_google" || key === "openrdap" || key === "bgpview" || key === "peeringdb"
                ? Network
                : key === "nvd" || key === "osv" || key === "cveorg" || key === "epss" || key === "shodan_cvedb" || key === "threatfox" || key === "urlhaus" || key === "malwarebazaar" || key === "otx" || key === "urlscan" || key === "virustotal" || key === "abuseipdb" || key === "greynoise"
                ? ShieldAlert
                : Globe;
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-mono hover:border-[var(--hack-green)]/40 transition-colors"
                  title={name}
                >
                  <Icon className="h-3 w-3 text-[var(--hack-green)]/80 shrink-0" />
                  <span className="truncate text-[var(--hack-gray)]">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recents */}
      {recents.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header">
              Recent Investigations
            </h2>
            {onOpenHistory && (
              <button
                onClick={onOpenHistory}
                className="flex items-center gap-1 text-xs text-[var(--hack-green)] hover:text-[var(--hack-cyan)] transition"
              >
                View all history
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {recents.map((r) => (
              <button
                key={r.id}
                onClick={() => onInvestigate(r.id, r.target)}
                className="group flex w-full items-center justify-between  border border-white/10 bg-black/20 px-4 py-2.5 text-left transition hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-[10px] uppercase rounded border border-white/15 px-1.5 py-0.5 text-muted-foreground shrink-0">
                    {r.input_type}
                  </span>
                  <span className="truncate font-medium">{r.target}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  {r.confidence != null && (
                    <span className="font-mono text-[var(--hack-green)]">
                      {Math.round(r.confidence * 100)}%
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 group-hover:text-[var(--hack-green)] transition" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Specialized modules */}
      {module !== "none" && (
        <section className="mt-12 space-y-4">
          <button
            onClick={() => setModule("none")}
            className="text-xs text-muted-foreground hover:text-[var(--hack-green)]"
          >
            ← Back to overview
          </button>
          {module === "visual" && <VisualIntelPanel />}
          {module === "crypto" && <CryptoPanel />}
          {module === "sanctions" && <SanctionsPanel />}
          {module === "batch" && <BatchSanctionsPanel />}
        </section>
      )}
    </div>
  );
}

function CapCard({
  icon: Icon,
  title,
  desc,
  accent,
  onClick,
}: {
  icon: typeof Globe;
  title: string;
  desc: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group text-left border p-4 transition-all hover:-translate-y-0.5 font-mono ${
        accent
          ? "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5 hover:glow-green"
          : "border-[var(--hack-border)] bg-[var(--hack-surface)] hover:border-[var(--hack-green)]/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`flex h-8 w-8 items-center justify-center border ${
            accent ? "border-[var(--hack-green)] bg-[var(--hack-green)]/10" : "border-[var(--hack-border)] bg-[var(--hack-green)]/5"
          }`}
        >
          <Icon className={`h-4 w-4 ${accent ? "text-[var(--hack-green)]" : "text-[var(--hack-green)]/70"}`} />
        </div>
        <ChevronRight className="h-3.5 w-3.5 ml-auto text-[var(--hack-gray)] group-hover:text-[var(--hack-green)] group-hover:translate-x-0.5 transition" />
      </div>
      <h3 className="font-semibold text-sm text-[var(--hack-green)] uppercase tracking-wider">{title}</h3>
      <p className="mt-1 text-[11px] text-[var(--hack-gray)] leading-relaxed">{desc}</p>
    </button>
  );
}

function PipelineDiagram() {
  const steps = [
    "Parse",
    "Route",
    "Query",
    "Normalize",
    "Synthesize",
    "ACH",
    "Attribute",
    "Format",
  ];
  return (
    <div className=" border border-white/10 bg-black/20 p-5 osint-grid">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-[var(--hack-green)] section-header">
          8-Step Research Pipeline
        </h2>
        <span className="text-[11px] font-mono text-[var(--hack-green)]">async · resumable · polled</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className="flex items-center gap-2  border border-white/10 bg-black/40 px-3 py-2">
              <span className="font-mono text-[10px] text-[var(--hack-green)]/70">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-xs font-medium">{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="h-px w-4 bg-gradient-to-r from-var(--hack-green)/50 to-transparent" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
