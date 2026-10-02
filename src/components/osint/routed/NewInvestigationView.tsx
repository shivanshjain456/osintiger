"use client";

// New Investigation launcher — a focused, full-page route for starting any of
// the five investigation modes. Mirrors the HomeView form but without the
// landing-page chrome (sources list, capability cards, recents) so the user
// lands directly on the action surface.

import { useState, useRef } from "react";
import {
  Plus,
  Search,
  Loader2,
  Zap,
  Bot,
  Layers,
  Brain,
  Radio,
  Crosshair,
  ArrowLeft,
} from "lucide-react";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate } from "@/lib/router/useRouter";
import {
  initiateInvestigation,
  initiateAgentInvestigation,
  startDiscovery,
  startPlan,
  startMonitor,
} from "@/lib/osint/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlaybookPicker } from "../PlaybookPicker";
import type { PlaybookType } from "@/lib/osint/client";

type Mode = "standard" | "agent" | "discovery" | "plan" | "monitor";

const MODES: { id: Mode; label: string; icon: typeof Zap; desc: string; accent: string }[] = [
  { id: "standard", label: "Standard Pipeline", icon: Zap, desc: "8-step agentic pipeline. Parallel multi-source query, AI synthesis, ACH, OFAC.", accent: "green" },
  { id: "agent", label: "Autonomous Agent", icon: Bot, desc: "Self-directed agent that discovers & expands entities iteratively.", accent: "cyan" },
  { id: "discovery", label: "Recursive Discovery", icon: Layers, desc: "Builds a discovery tree from a root target, expanding related entities.", accent: "amber" },
  { id: "plan", label: "AI Plan", icon: Brain, desc: "AI generates a custom investigation plan from your objective.", accent: "purple" },
  { id: "monitor", label: "Live Monitoring", icon: Radio, desc: "Continuous change detection across 7 source categories.", accent: "red" },
];

const SAMPLE_TARGETS = [
  { label: "Tesla, Inc.", type: "organization" },
  { label: "google.com", type: "domain" },
  { label: "8.8.8.8", type: "ip" },
  { label: "Vladimir Putin", type: "person" },
  { label: "CVE-2021-44228", type: "cve" },
  { label: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", type: "wallet" },
];

export function NewInvestigationView() {
  const navigate = useNavigate();
  const [target, setTarget] = useState("");
  const [type, setType] = useState("auto");
  const [objective, setObjective] = useState("");
  const [mode, setMode] = useState<Mode>("standard");
  const [playbook, setPlaybook] = useState<PlaybookType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  async function launch(t?: string, ty?: string) {
    const q = (t ?? target).trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const resolvedType = ty ?? (type === "auto" ? undefined : type);
      if (mode === "monitor") {
        const res = await startMonitor(q, { input_type: ty ?? (type === "auto" ? "" : type) });
        navigate({ name: "monitor", params: { id: res.monitor_id } });
      } else if (mode === "plan") {
        const res = await startPlan(q, { objective: objective.trim() || `Comprehensive investigation of ${q}`, input_type: ty ?? (type === "auto" ? "" : type) });
        navigate({ name: "plan", params: { id: res.plan_id } });
      } else if (mode === "discovery") {
        const res = await startDiscovery(q, { input_type: ty ?? (type === "auto" ? "" : type) });
        navigate({ name: "discovery", params: { id: res.discovery_id } });
      } else if (mode === "agent") {
        const res = await initiateAgentInvestigation(q, { input_type: resolvedType });
        navigate({ name: "agent", params: { id: res.investigation_id } });
      } else {
        const res = await initiateInvestigation(q, { input_type: resolvedType, playbook: playbook || undefined });
        navigate({ name: "investigation", params: { id: res.investigation_id } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Investigation failed to start");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/5">
          <Plus className="h-5 w-5 text-[var(--hack-green)]" />
        </div>
        <div>
          <h1 className="text-lg md:text-xl font-bold font-mono tracking-tight">New Investigation</h1>
          <p className="text-xs text-[var(--hack-gray)] font-mono mt-0.5">{"// choose a mode · enter a target · execute"}</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          const accentBorder = {
            green: "border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 text-[var(--hack-green)]",
            cyan: "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]",
            amber: "border-[var(--hack-amber)]/40 bg-[var(--hack-amber)]/10 text-[var(--hack-amber)]",
            purple: "border-[var(--hack-purple)]/40 bg-[var(--hack-purple)]/10 text-[var(--hack-purple)]",
            red: "border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10 text-[var(--hack-red)]",
          }[m.accent];
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`text-left border p-3 transition ${active ? accentBorder : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)] hover:border-[var(--hack-green)]/30"}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="h-4 w-4" />
                <span className="font-mono text-xs font-semibold uppercase tracking-wider">{m.label}</span>
              </div>
              <p className="text-[10px] text-[var(--hack-gray)] leading-relaxed">{m.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Target input */}
      <div className="terminal-panel p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--hack-border)]">
          <span className="text-[var(--hack-green)] font-mono text-xs">$</span>
          <span className="text-[var(--hack-gray)] font-mono text-xs">investigate --target</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--hack-green)]/50" />
            <input
              ref={searchRef}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && launch()}
              placeholder="name | company | domain | ip | email | @user | phone | cve | hash | url | 0x... | bc1..."
              className="pl-9 h-10 w-full bg-[var(--hack-surface)] border border-[var(--hack-border)] text-sm font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-green)]/30 focus:outline-none focus:border-[var(--hack-green)]/40"
              autoFocus
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
          <button
            onClick={() => launch()}
            disabled={loading || !target.trim()}
            className="h-10 px-6 font-mono text-xs uppercase tracking-wider shrink-0 border bg-[var(--hack-green)]/10 border-[var(--hack-green)] text-[var(--hack-green)] hover:bg-[var(--hack-green)] hover:text-[var(--hack-bg)] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Execute
          </button>
        </div>

        {mode === "plan" && (
          <div className="mt-2">
            <div className="flex items-center gap-2 border border-[var(--hack-border)] bg-[var(--hack-surface)] px-3 py-1.5">
              <Crosshair className="h-3.5 w-3.5 text-[var(--hack-cyan)] shrink-0" />
              <input
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && launch()}
                placeholder="Investigation objective (e.g., 'Assess this domain for investment due diligence')"
                maxLength={500}
                className="flex-1 bg-transparent text-xs font-mono text-[var(--hack-green)] placeholder:text-[var(--hack-gray)]/40 focus:outline-none"
              />
            </div>
          </div>
        )}

        {mode === "standard" && (
          <div className="mt-3 border-t border-[var(--hack-border)] pt-3">
            <PlaybookPicker inputType={type === "auto" ? "domain" : type} selected={playbook} onSelect={setPlaybook} />
          </div>
        )}

        {error && <p className="mt-2 text-xs text-[var(--hack-red)] font-mono">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[var(--hack-gray)]">{"// try:"}</span>
          {SAMPLE_TARGETS.map((s) => (
            <button
              key={s.label}
              onClick={() => { setTarget(s.label); setType(s.type); }}
              className="border border-[var(--hack-border)] bg-transparent px-2.5 py-1 text-[var(--hack-cyan)] transition hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)] hover:bg-[var(--hack-green)]/5"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => navigate({ name: "home" })}
        className="mt-6 flex items-center gap-1.5 text-xs font-mono text-[var(--hack-gray)] hover:text-[var(--hack-green)] transition"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Command Center
      </button>
    </div>
  );
}
