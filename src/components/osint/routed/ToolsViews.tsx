"use client";

// Tools views. The tools index is a landing page; each tool page wraps the
// existing specialized panel as a full routed page with breadcrumbs + header.

import {
  Wrench,
  ScanEye,
  Wallet,
  ShieldAlert,
  FileText,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "./PageBits";
import { RouteBreadcrumbs } from "./RouteBreadcrumbs";
import { useNavigate } from "@/lib/router/useRouter";
import { VisualIntelPanel } from "../VisualIntelPanel";
import { CryptoPanel } from "../CryptoPanel";
import { SanctionsPanel } from "../SanctionsPanel";
import { BatchSanctionsPanel } from "../BatchSanctionsPanel";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <RouteBreadcrumbs />
      {children}
    </div>
  );
}

export function ToolsView() {
  const navigate = useNavigate();
  const tools = [
    { route: "tool-visual" as const, icon: ScanEye, title: "Visual Intelligence", desc: "Upload or link an image — VLM extracts geolocation cues, text, objects, manipulation signals.", accent: "cyan" as const },
    { route: "tool-crypto" as const, icon: Wallet, title: "Crypto Tracing", desc: "Ethereum wallet analysis: balance, transactions, counterparty clustering, AI risk score.", accent: "green" as const },
    { route: "tool-sanctions" as const, icon: ShieldAlert, title: "Sanctions Screening", desc: "OFAC SDN fuzzy matching with Levenshtein + token overlap. Top-5 ranked matches.", accent: "amber" as const },
    { route: "tool-batch" as const, icon: FileText, title: "Batch Screening", desc: "Bulk OFAC SDN check for lists of names. CSV export, summary stats, per-name results.", accent: "amber" as const },
    { route: "tools-playbooks" as const, icon: BookOpen, title: "Playbook Library", desc: "Browse the 10 domain-aware investigation playbooks and their collection strategies.", accent: "purple" as const },
  ];
  return (
    <Shell>
      <PageHeader icon={Wrench} title="Investigation Tools" subtitle="// specialized standalone utilities" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((t) => {
          const accent = {
            cyan: "border-[var(--hack-cyan)]/40 hover:bg-[var(--hack-cyan)]/5 text-[var(--hack-cyan)]",
            green: "border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 text-[var(--hack-green)]",
            amber: "border-[var(--hack-amber)]/40 hover:bg-[var(--hack-amber)]/5 text-[var(--hack-amber)]",
            purple: "border-[var(--hack-purple)]/40 hover:bg-[var(--hack-purple)]/5 text-[var(--hack-purple)]",
          }[t.accent];
          return (
            <button
              key={t.route}
              onClick={() => navigate({ name: t.route })}
              className={`group text-left border bg-[var(--hack-surface)] p-5 transition hover:-translate-y-0.5 ${accent}`}
            >
              <div className="flex items-center justify-between mb-3">
                <t.icon className={`h-6 w-6`} />
                <ChevronRight className="h-4 w-4 text-[var(--hack-gray)] group-hover:translate-x-0.5 transition" />
              </div>
              <h3 className="font-mono text-sm font-semibold uppercase tracking-wider mb-1">{t.title}</h3>
              <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{t.desc}</p>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

export function ToolVisualView() {
  return (
    <Shell>
      <PageHeader icon={ScanEye} title="Visual Intelligence" subtitle="// VLM-powered image analysis" accent="cyan" />
      <VisualIntelPanel />
    </Shell>
  );
}

export function ToolCryptoView() {
  return (
    <Shell>
      <PageHeader icon={Wallet} title="Crypto Tracing" subtitle="// ethereum wallet analysis" accent="green" />
      <CryptoPanel />
    </Shell>
  );
}

export function ToolSanctionsView() {
  return (
    <Shell>
      <PageHeader icon={ShieldAlert} title="Sanctions Screening" subtitle="// OFAC SDN fuzzy match" accent="amber" />
      <SanctionsPanel />
    </Shell>
  );
}

export function ToolBatchView() {
  return (
    <Shell>
      <PageHeader icon={FileText} title="Batch Screening" subtitle="// bulk OFAC SDN check" accent="amber" />
      <BatchSanctionsPanel />
    </Shell>
  );
}
