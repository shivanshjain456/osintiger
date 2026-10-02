"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfidenceRing, ConfidenceMeter } from "./ConfidenceMeter";
import { ClaimText, AttributionTag } from "./AttributionTag";
import { ACHMatrix } from "./ACHMatrix";
import { IntelMap } from "./IntelMap";
import { SourceBadge } from "./SourceBadge";
import { AnimatedStat } from "./AnimatedStat";
import { Sparkline } from "./Sparkline";
import { VersionHistory } from "./VersionHistory";
import { CryptoPanel } from "./CryptoPanel";
import { SanctionsPanel } from "./SanctionsPanel";
import { VisualIntelPanel } from "./VisualIntelPanel";
import { LinkGraphPanel } from "./LinkGraphPanel";
import { KnowledgeGraphPanel } from "./KnowledgeGraphPanel";
import { AskAIPanel } from "./AskAIPanel";
import { IntelligenceSections } from "./IntelligenceSections";
import { ConfidenceEnginePanel } from "./ConfidenceEnginePanel";
import { CredibilityRankingPanel } from "./CredibilityRankingPanel";
import { ContradictionPanel } from "./ContradictionPanel";
import { TemporalPanel } from "./TemporalPanel";
import { InfrastructureEvolutionPanel } from "./InfrastructureEvolutionPanel";
import { DigitalFootprintPanel } from "./DigitalFootprintPanel";
import { AttackSurfacePanel } from "./AttackSurfacePanel";
import { TechFingerprintPanel } from "./TechFingerprintPanel";
import { CertificatePanel } from "./CertificatePanel";
import { OrgHierarchyPanel } from "./OrgHierarchyPanel";
import { ExecProfilePanel } from "./ExecProfilePanel";
import { ThreatAssessmentPanel } from "./ThreatAssessmentPanel";
import { EntityResolutionPanel } from "./EntityResolutionPanel";
import { KnowledgeBasePanel } from "./KnowledgeBasePanel";
import { MultiAgentDebatePanel } from "./MultiAgentDebatePanel";
import { IntelligenceGapPanel } from "./IntelligenceGapPanel";
import { PlaybookPanel } from "./PlaybookPanel";
import { ProvenancePanel } from "./ProvenancePanel";
import { VisualDashboard } from "./VisualDashboard";
import { SocialIntelligencePanel } from "./SocialIntelligencePanel";
import type { PollResponse } from "@/lib/osint/client";
import { fetchRecentWithFilters, initiateInvestigation, patchInvestigationMetadata } from "@/lib/osint/client";
import { NotesEditorDialog } from "./NotesEditorDialog";
import {
  ArrowLeft,
  Download,
  AlertTriangle,
  ShieldCheck,
  FileText,
  ListChecks,
  ScrollText,
  Database,
  GitBranch,
  Map as MapIcon,
  Wallet,
  ShieldAlert,
  ScanEye,
  Clock,
  Copy,
  Check,
  FileDown,
  Sheet,
  Braces,
  Star,
  Tag,
  Pencil,
  Share2,
  RefreshCw,
  Bookmark,
  MessageSquare,
  Search,
  X,
  Target,
  Network,
  Sparkles,
  Loader2,
  Award,
  Server,
  Crosshair,
  Cpu,
  Lock,
  Building2,
  User,
  Users,
  Library,
  Brain,
  BookOpen,
  LayoutDashboard,
} from "lucide-react";

export function ReportView({
  poll,
  onHome,
  onNewInvestigation,
}: {
  poll: PollResponse;
  onHome: () => void;
  onNewInvestigation: (id: string, target: string) => void;
}) {
  const report = poll.report;
  const [copied, setCopied] = useState(false);
  const [showCrypto, setShowCrypto] = useState(false);
  const [showSanctions, setShowSanctions] = useState(false);
  const [showVisual, setShowVisual] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [findingFilter, setFindingFilter] = useState("");
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [reRunning, setReRunning] = useState(false);
  const [annotatingIndex, setAnnotatingIndex] = useState<number | null>(null);
  const [meta, setMeta] = useState<{
    starred: boolean;
    tags: string[];
    notes: string;
    bookmarked_findings: number[];
    finding_annotations: Record<number, string>;
  }>({
    starred: false,
    tags: [],
    notes: "",
    bookmarked_findings: [],
    finding_annotations: {},
  });

  // Fetch metadata (starred/tags/notes/bookmarks) for this investigation
  useEffect(() => {
    let cancelled = false;
    fetchRecentWithFilters("", "all", 200)
      .then((d) => {
        if (cancelled) return;
        const item = d.investigations.find((i) => i.id === poll.investigation_id);
        if (item) {
          setMeta({
            starred: item.starred,
            tags: item.tags,
            notes: item.notes,
            bookmarked_findings: item.bookmarked_findings || [],
            finding_annotations: item.finding_annotations || {},
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [poll.investigation_id]);

  const markdown = useMemo(() => (report ? reportToMarkdown(poll) : ""), [poll, report]);

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-[var(--hack-green)] mx-auto mb-4" />
        <h1 className="text-xl font-semibold">No report available</h1>
        <p className="mt-2 text-muted-foreground">
          This investigation did not produce a report. It may have failed or is still running.
        </p>
        <Button onClick={onHome} className="mt-6 bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]">
          Start new investigation
        </Button>
      </div>
    );
  }

  function downloadMarkdown() {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `osintiger-report-${poll.target.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  function exportPdf() {
    // Use browser print dialog (user can "Save as PDF"). A print-specific stylesheet
    // is injected via the report-print-area class.
    const printable = document.getElementById("report-print-area");
    if (!printable) {
      window.print();
      return;
    }
    const win = window.open("", "_blank");
    if (!win) {
      window.print();
      return;
    }
    const safeTarget = poll.target.replace(/[<>&"']/g, "");
    win.document.write(`<!doctype html><html><head><title>OSINTiger Report — ${safeTarget}</title>
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; background: #fff; color: #1a1a1a; padding: 40px; line-height: 1.6; }
      h1 { color: #00ff41; border-bottom: 3px solid #00ff41; padding-bottom: 8px; }
      h2 { color: #92400e; margin-top: 24px; }
      h3 { color: #00ff41; }
      .meta { color: #666; font-size: 12px; margin: 4px 0 16px; }
      .finding { border-left: 3px solid #00ff41; padding: 8px 12px; margin: 8px 0; background: #0a1a0a; }
      .source { color: #00ff41; font-family: monospace; font-size: 11px; }
      .confidence { color: #047857; font-weight: bold; }
      .hypothesis { border: 1px solid #ffb000; padding: 10px; margin: 8px 0; border-radius: 6px; }
      table { border-collapse: collapse; width: 100%; margin: 12px 0; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 12px; }
      th { background: #fef3c7; }
      .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 11px; color: #666; }
    </style>
    </head><body>${printable.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  }

  function downloadExport(format: "csv" | "json" | "txt" | "md") {
    // Trigger browser download of raw source findings + report
    const url = `/api/export/${poll.investigation_id}?format=${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `osintiger-${poll.target.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadBookmarks(format: "csv" | "json") {
    const url = `/api/export/${poll.investigation_id}/bookmarks?format=${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `osintiger-bookmarks-${poll.target.replace(/[^a-z0-9]+/gi, "-").slice(0, 30)}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function shareReport() {
    // Copy a shareable URL hash link to clipboard
    const url = `${window.location.origin}/#investigation=${poll.investigation_id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback: select text
      window.prompt("Copy this link:", url);
    }
  }

  async function reRun() {
    setReRunning(true);
    try {
      const res = await initiateInvestigation(poll.target, {
        input_type: poll.input_type,
      });
      onNewInvestigation(res.investigation_id, poll.target);
    } catch {
      // ignore
    } finally {
      setReRunning(false);
    }
  }

  async function toggleBookmark(findingIndex: number) {
    const current = meta.bookmarked_findings;
    const next = current.includes(findingIndex)
      ? current.filter((i) => i !== findingIndex)
      : [...current, findingIndex];
    setMeta((m) => ({ ...m, bookmarked_findings: next }));
    try {
      await patchInvestigationMetadata(poll.investigation_id, {
        bookmarked_findings: next,
      });
    } catch {
      // revert on failure
      setMeta((m) => ({ ...m, bookmarked_findings: current }));
    }
  }

  async function saveAnnotation(findingIndex: number, text: string) {
    const current = meta.finding_annotations;
    const next = { ...current };
    if (text.trim()) {
      next[findingIndex] = text.trim().slice(0, 500);
    } else {
      delete next[findingIndex];
    }
    setMeta((m) => ({ ...m, finding_annotations: next }));
    setAnnotatingIndex(null);
    try {
      await patchInvestigationMetadata(poll.investigation_id, {
        finding_annotations: next,
      });
    } catch {
      setMeta((m) => ({ ...m, finding_annotations: current }));
    }
  }

  const created = new Date(poll.created_at).toLocaleString();
  const completed = poll.completed_at ? new Date(poll.completed_at).toLocaleString() : null;

  // Filter findings by keyword + bookmark filter
  const filteredFindings = report
    ? report.key_findings
        .map((finding, originalIndex) => ({ finding, originalIndex }))
        .filter(({ finding, originalIndex }) => {
          if (bookmarkedOnly && !meta.bookmarked_findings.includes(originalIndex)) return false;
          if (findingFilter) {
            const q = findingFilter.toLowerCase();
            const inClaim = finding.claim.toLowerCase().includes(q);
            const inSource = finding.source.toLowerCase().includes(q);
            const inAnnotation = (meta.finding_annotations[originalIndex] || "").toLowerCase().includes(q);
            return inClaim || inSource || inAnnotation;
          }
          return true;
        })
    : [];

  const duration =
    poll.completed_at &&
    Math.round(
      (new Date(poll.completed_at).getTime() - new Date(poll.created_at).getTime()) / 1000
    );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onHome} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> New investigation
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNotesOpen(true)}
            className={meta.starred ? "border-[var(--hack-green)]/40 text-[var(--hack-green)]" : ""}
            title="Star, tag, and add notes"
          >
            {meta.starred ? <Star className="h-4 w-4 fill-var(--hack-green) text-[var(--hack-green)]" /> : <Pencil className="h-4 w-4" />}
            <span className="hidden sm:inline">Edit</span>
            {meta.tags.length > 0 && (
              <Badge variant="outline" className="ml-1 text-[9px] h-4 px-1 border-[var(--hack-green)]/30 text-[var(--hack-cyan)]">
                {meta.tags.length}
              </Badge>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={reRun}
            disabled={reRunning}
            title={`Re-investigate ${poll.target}`}
          >
            <RefreshCw className={`h-4 w-4 ${reRunning ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Re-run</span>
          </Button>
          <Button variant="outline" size="sm" onClick={shareReport} title="Copy shareable link">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button variant="outline" size="sm" onClick={copyLink}>
            {copied ? <Check className="h-4 w-4 text-[var(--hack-green)]" /> : <Copy className="h-4 w-4" />}
            <span className="hidden sm:inline">Copy MD</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadExport("md")}>
            <FileText className="h-4 w-4" /> <span className="hidden sm:inline">MD</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadExport("txt")}>
            <Copy className="h-4 w-4" /> <span className="hidden sm:inline">TXT</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadExport("csv")}>
            <Sheet className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadExport("json")}>
            <Braces className="h-4 w-4" /> <span className="hidden sm:inline">JSON</span>
          </Button>
          {meta.bookmarked_findings.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadBookmarks("json")}
              title={`Export ${meta.bookmarked_findings.length} bookmarked findings`}
              className="border-[var(--hack-green)]/30 text-[var(--hack-green)]"
            >
              <Bookmark className="h-4 w-4" />
              <span className="hidden sm:inline">Bookmarks</span>
              <Badge variant="outline" className="ml-1 text-[9px] h-4 px-1 border-[var(--hack-green)]/30 text-[var(--hack-cyan)]">
                {meta.bookmarked_findings.length}
              </Badge>
            </Button>
          )}
          <Button size="sm" onClick={downloadMarkdown} className="bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">MD</span>
          </Button>
        </div>
      </div>

      <div id="report-print-area">
      {/* Header card */}
      <Card className="glass-panel mb-6 overflow-hidden fade-in-up">
        <div className="osint-grid">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  Intelligence Report · {report.input_type}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold break-all">{poll.target}</h1>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="flex items-center gap-1.5 rounded border border-white/10 bg-black/30 px-2 py-1 font-mono">
                    <Clock className="h-3 w-3" /> {created}
                  </span>
                  {duration != null && (
                    <span className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono">
                      {duration}s
                    </span>
                  )}
                  <span className="rounded border border-white/10 bg-black/30 px-2 py-1 font-mono">
                    lang: {report.language_guess} · {report.script}
                  </span>
                  {report.attribution_valid ? (
                    <span className="flex items-center gap-1.5 rounded border border-[var(--hack-green)]/40 bg-[var(--hack-green)]/10 px-2 py-1 font-mono text-[var(--hack-green)]">
                      <ShieldCheck className="h-3 w-3" /> All claims sourced
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded border border-[var(--hack-red)]/40 bg-[var(--hack-red)]/10 px-2 py-1 font-mono text-[var(--hack-red)]">
                      <AlertTriangle className="h-3 w-3" /> Needs manual review
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                {report.key_findings.length > 1 && (
                  <div className="hidden sm:flex flex-col items-center gap-1">
                    <Sparkline
                      values={report.key_findings.map((f) => f.confidence)}
                      width={80}
                      height={28}
                    />
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      finding confidence
                    </span>
                  </div>
                )}
                <ConfidenceRing value={report.confidence_score} size={104} label="overall" />
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <AnimatedStat value={report.sources_consulted.length} label="Sources consulted" />
              <AnimatedStat value={report.key_findings.length} label="Key findings" />
              <AnimatedStat value={report.ach_analysis.hypotheses.length} label="Hypotheses" />
              <AnimatedStat value={report.geopoints.length} label="Geo signals" />
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Version history (only shows if target investigated multiple times) */}
      <div className="mb-6">
        <VersionHistory
          target={poll.target}
          currentId={poll.investigation_id}
          onSelect={(id, target) => onNewInvestigation(id, target)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="bg-black/30 border border-white/10 flex flex-wrap h-auto">
          <TabsTrigger value="dashboard" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Summary
          </TabsTrigger>
          <TabsTrigger value="findings" className="gap-1.5">
            <ListChecks className="h-3.5 w-3.5" /> Findings
            {meta.bookmarked_findings.length > 0 && (
              <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] border-[var(--hack-green)]/40 text-[var(--hack-green)] bg-[var(--hack-green)]/10">
                <Bookmark className="h-2 w-2 fill-var(--hack-green) mr-0.5" />{meta.bookmarked_findings.length}
              </Badge>
            )}
            {Object.keys(meta.finding_annotations).length > 0 && (
              <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] border-[var(--hack-green)]/40 text-[var(--hack-green)] bg-[var(--hack-green)]/10">
                <MessageSquare className="h-2 w-2 fill-var(--hack-green)/30 mr-0.5" />{Object.keys(meta.finding_annotations).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1.5">
            <ScrollText className="h-3.5 w-3.5" /> Analysis
          </TabsTrigger>
          <TabsTrigger value="ach" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> ACH
          </TabsTrigger>
          <TabsTrigger value="intel" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Intel
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-1.5">
            <Network className="h-3.5 w-3.5" /> Links
            {report.link_graph && report.link_graph.nodes.length > 0 && (
              <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] border-[var(--hack-green)]/40 text-[var(--hack-green)] bg-[var(--hack-green)]/10">
                {report.link_graph.nodes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="kgraph" className="gap-1.5">
            <Network className="h-3.5 w-3.5" /> KGraph
          </TabsTrigger>
          <TabsTrigger value="confidence" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Confidence
          </TabsTrigger>
          <TabsTrigger value="credibility" className="gap-1.5">
            <Award className="h-3.5 w-3.5" /> Credibility
          </TabsTrigger>
          <TabsTrigger value="contradictions" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Conflicts
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="infrastructure" className="gap-1.5">
            <Server className="h-3.5 w-3.5" /> Infra
          </TabsTrigger>
          <TabsTrigger value="footprint" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Footprint
          </TabsTrigger>
          <TabsTrigger value="attack-surface" className="gap-1.5">
            <Crosshair className="h-3.5 w-3.5" /> Surface
          </TabsTrigger>
          <TabsTrigger value="tech-fingerprint" className="gap-1.5">
            <Cpu className="h-3.5 w-3.5" /> TechFP
          </TabsTrigger>
          <TabsTrigger value="certificates" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Certs
          </TabsTrigger>
          <TabsTrigger value="hierarchy" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" /> Hierarchy
          </TabsTrigger>
          <TabsTrigger value="exec-profile" className="gap-1.5">
            <User className="h-3.5 w-3.5" /> Exec
          </TabsTrigger>
          <TabsTrigger value="threat" className="gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Threat
          </TabsTrigger>
          <TabsTrigger value="resolution" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Resolution
          </TabsTrigger>
          <TabsTrigger value="kb" className="gap-1.5">
            <Library className="h-3.5 w-3.5" /> Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="debate" className="gap-1.5">
            <Brain className="h-3.5 w-3.5" /> Debate
          </TabsTrigger>
          <TabsTrigger value="gaps" className="gap-1.5">
            <Target className="h-3.5 w-3.5" /> Gaps
          </TabsTrigger>
          <TabsTrigger value="playbook" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Playbook
          </TabsTrigger>
          <TabsTrigger value="provenance" className="gap-1.5">
            <GitBranch className="h-3.5 w-3.5" /> Provenance
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Social
          </TabsTrigger>
          <TabsTrigger value="sources" className="gap-1.5">
            <Database className="h-3.5 w-3.5" /> Sources
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-1.5">
            <MapIcon className="h-3.5 w-3.5" /> Map
          </TabsTrigger>
          <TabsTrigger value="ask" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Ask AI
          </TabsTrigger>
          <TabsTrigger value="modules" className="gap-1.5">
            <ScanEye className="h-3.5 w-3.5" /> Modules
          </TabsTrigger>
        </TabsList>

        {/* Visual Intelligence Dashboard — 9 visualization types (Feature 28) */}
        <TabsContent value="dashboard">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-[var(--hack-cyan)]" />
                Visual Intelligence Dashboard — Interactive Analysis Workspace
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VisualDashboard investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary */}
        <TabsContent value="summary">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base">Executive Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{report.executive_summary}</p>

              {report.key_findings.length > 0 && (
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    Top findings
                  </h4>
                  <div className="space-y-2">
                    {report.key_findings.slice(0, 5).map((f, i) => (
                      <div
                        key={i}
                        className=" border border-white/10 bg-black/20 p-3"
                      >
                        <p className="text-sm">
                          <ClaimText
                            text={f.claim}
                            fallbackSource={f.source}
                            fallbackUrl={f.source_url}
                          />
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="w-24">
                            <ConfidenceMeter value={f.confidence} size="sm" showLabel={false} />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {Math.round(f.confidence * 100)}% confidence
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Findings */}
        <TabsContent value="findings">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Key Findings
                <span className="text-xs font-mono text-muted-foreground">
                  {report.key_findings.length} items
                  {findingFilter || bookmarkedOnly ? ` · ${filteredFindings.length} shown` : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Finding filter bar */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={findingFilter}
                    onChange={(e) => setFindingFilter(e.target.value)}
                    placeholder="Filter findings by keyword…"
                    className="pl-8 h-8 text-sm bg-black/40"
                  />
                  {findingFilter && (
                    <button
                      onClick={() => setFindingFilter("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setBookmarkedOnly((v) => !v)}
                  className={`flex items-center gap-1.5  border px-2.5 h-8 text-xs transition shrink-0 ${
                    bookmarkedOnly
                      ? "border-[var(--hack-green)]/50 bg-[var(--hack-green)]/15 text-[var(--hack-green)]"
                      : "border-white/10 bg-black/40 text-muted-foreground hover:border-[var(--hack-green)]/30"
                  }`}
                  title="Show bookmarked only"
                >
                  <Bookmark className={`h-3.5 w-3.5 ${bookmarkedOnly ? "fill-var(--hack-green) text-[var(--hack-green)]" : ""}`} />
                  <span className="hidden sm:inline">Bookmarked</span>
                  {meta.bookmarked_findings.length > 0 && (
                    <span className="font-mono text-[10px]">({meta.bookmarked_findings.length})</span>
                  )}
                </button>
              </div>
              {filteredFindings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Search className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No findings match your filter.</p>
                  <button
                    onClick={() => { setFindingFilter(""); setBookmarkedOnly(false); }}
                    className="mt-2 text-xs text-[var(--hack-green)] hover:underline"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
              <div className="space-y-2">
                {filteredFindings.map(({ finding, originalIndex }) => {
                  const isBookmarked = meta.bookmarked_findings.includes(originalIndex);
                  return (
                  <div
                    key={originalIndex}
                    className={`group  border p-3 transition ${
                      isBookmarked
                        ? "border-[var(--hack-green)]/50 bg-[var(--hack-green)]/5"
                        : "border-white/10 bg-black/20 hover:border-[var(--hack-green)]/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-xs text-[var(--hack-green)]/70 mt-0.5 shrink-0">
                        {String(originalIndex + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <ClaimText
                            text={finding.claim}
                            fallbackSource={finding.source}
                            fallbackUrl={finding.source_url}
                            highlight={findingFilter}
                          />
                        </p>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="w-32">
                            <ConfidenceMeter value={finding.confidence} size="sm" showLabel={false} />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {Math.round(finding.confidence * 100)}%
                          </span>
                          {finding.source_url && (
                            <a
                              href={finding.source_url}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-auto text-[11px] text-[var(--hack-green)] hover:underline truncate max-w-[200px]"
                            >
                              {finding.source} ↗
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleBookmark(originalIndex)}
                        className={`shrink-0  p-1.5 transition ${
                          isBookmarked
                            ? "text-[var(--hack-green)] bg-[var(--hack-green)]/10"
                            : "text-muted-foreground opacity-0 hover:opacity-100 hover:text-[var(--hack-green)] hover:bg-[var(--hack-green)]/10"
                        } group-hover:opacity-100`}
                        style={{ opacity: isBookmarked ? 1 : undefined }}
                        title={isBookmarked ? "Remove bookmark" : "Bookmark this finding"}
                      >
                        <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? "fill-var(--hack-green)" : ""}`} />
                      </button>
                      <button
                        onClick={() => setAnnotatingIndex(annotatingIndex === originalIndex ? null : originalIndex)}
                        className={`shrink-0  p-1.5 transition ${
                          meta.finding_annotations[originalIndex]
                            ? "text-[var(--hack-green)] bg-[var(--hack-green)]/10"
                            : "text-muted-foreground opacity-0 hover:opacity-100 hover:text-[var(--hack-green)] hover:bg-[var(--hack-green)]/10"
                        } group-hover:opacity-100`}
                        style={{ opacity: meta.finding_annotations[originalIndex] ? 1 : undefined }}
                        title={meta.finding_annotations[originalIndex] ? "Edit annotation" : "Add annotation"}
                      >
                        <MessageSquare className={`h-3.5 w-3.5 ${meta.finding_annotations[originalIndex] ? "fill-var(--hack-green)/30" : ""}`} />
                      </button>
                    </div>
                    {/* Annotation display */}
                    {meta.finding_annotations[originalIndex] && annotatingIndex !== originalIndex && (
                      <div className="mt-2  border border-[var(--hack-green)]/20 bg-[var(--hack-green)]/5 p-2 text-xs text-[var(--hack-cyan)]/90 italic">
                        <span className="text-[var(--hack-green)]/60 not-italic font-mono text-[10px] mr-1">NOTE:</span>
                        {meta.finding_annotations[originalIndex]}
                      </div>
                    )}
                    {/* Annotation editor */}
                    {annotatingIndex === originalIndex && (
                      <AnnotationEditor
                        initial={meta.finding_annotations[originalIndex] || ""}
                        onSave={(text) => saveAnnotation(originalIndex, text)}
                        onCancel={() => setAnnotatingIndex(null)}
                      />
                    )}
                  </div>
                  );
                })}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analysis */}
        <TabsContent value="analysis">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base">Detailed Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert max-w-none">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  <ClaimText text={report.detailed_analysis} />
                </div>
              </div>
              {!report.attribution_valid && (
                <div className="mt-4 flex items-start gap-2  border border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5 p-3 text-xs text-[var(--hack-red)]">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Some sentences in this analysis may lack explicit [SOURCE] tags. This report
                    has been flagged for manual review per OSINTiger&apos;s zero-hallucination policy.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACH */}
        <TabsContent value="ach">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-[var(--hack-green)]" />
                Analysis of Competing Hypotheses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ACHMatrix analysis={report.ach_analysis} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intelligence Sections — BLUF, 5W1H, Timeline, Risk Matrix, Contradictions, Gaps, Monitoring */}
        <TabsContent value="intel">
          <IntelligenceSections report={report} />
        </TabsContent>

        {/* Link Analysis Graph */}
        <TabsContent value="links">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4 text-[var(--hack-green)]" />
                Link Analysis — Entity Relationships
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.link_graph && report.link_graph.nodes.length > 0 ? (
                <LinkGraphPanel graph={report.link_graph} target={poll.target} />
              ) : (
                <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">
                  {"» No entity relationship graph generated — insufficient cross-source correlation data."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Knowledge Graph — dynamic force-directed graph from collected evidence */}
        <TabsContent value="kgraph">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4 text-[var(--hack-cyan)]" />
                Evidence Knowledge Graph — Force-Directed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EvidenceKnowledgeGraph investigationId={poll.investigation_id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Confidence Engine — multi-dimensional confidence scoring */}
        <TabsContent value="confidence">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--hack-green)]" />
                Confidence Engine — Multi-Dimensional Scoring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ConfidenceEnginePanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Source Credibility Ranking — tier classification + configurable weighting */}
        <TabsContent value="credibility">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-[var(--hack-cyan)]" />
                Source Credibility Ranking — Tier Classification & Weighting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CredibilityRankingPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contradiction Detection — conflict identification + resolution */}
        <TabsContent value="contradictions">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--hack-red)]" />
                Contradiction Detection — Conflict Identification & Resolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ContradictionPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Temporal Intelligence — timeline + evolution phases */}
        <TabsContent value="timeline">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--hack-cyan)]" />
                Temporal Intelligence — Timeline & Evolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TemporalPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Infrastructure Evolution — DNS, IP, ASN, SSL, CDN, tech, security */}
        <TabsContent value="infrastructure">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-[var(--hack-cyan)]" />
                Infrastructure Evolution — DNS, IP, SSL, CDN & Technology
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InfrastructureEvolutionPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Digital Footprint Score — exposure assessment */}
        <TabsContent value="footprint">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--hack-green)]" />
                Digital Footprint Score — Exposure Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DigitalFootprintPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Attack Surface Mapping — asset discovery + categorization */}
        <TabsContent value="attack-surface">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-[var(--hack-red)]" />
                Attack Surface Mapping — Asset Discovery & Inventory
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AttackSurfacePanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Technology Fingerprinting — full stack identification */}
        <TabsContent value="tech-fingerprint">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cpu className="h-4 w-4 text-[var(--hack-cyan)]" />
                Technology Fingerprinting — Stack Identification & Correlation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TechFingerprintPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certificate Intelligence — issuer/SAN/history/reuse/wildcard/graph */}
        <TabsContent value="certificates">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-[var(--hack-cyan)]" />
                Certificate Intelligence — Issuers, SANs, Reuse & Graph
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CertificatePanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organization Hierarchy — parent/subsidiary/founder/exec/investor/partner */}
        <TabsContent value="hierarchy">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[var(--hack-cyan)]" />
                Organization Hierarchy — Structure, Control & Relationships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrgHierarchyPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Executive Intelligence — career/boards/education/patents/publications/social/media/donations */}
        <TabsContent value="exec-profile">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-[var(--hack-cyan)]" />
                Executive Intelligence — Career, Boards, Education & Public Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ExecProfilePanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Threat Assessment — risk drivers, scenarios, mitigations, unknowns */}
        <TabsContent value="threat">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-[var(--hack-red)]" />
                AI Threat Assessment — Risk Drivers, Scenarios & Mitigations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ThreatAssessmentPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Entity Resolution — probabilistic identity resolution */}
        <TabsContent value="resolution">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--hack-cyan)]" />
                Entity Resolution — Probabilistic Identity Matching
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EntityResolutionPanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Knowledge Base — durable intelligence repository (Feature 19) */}
        <TabsContent value="kb">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Library className="h-4 w-4 text-[var(--hack-cyan)]" />
                Knowledge Base — Persistent Intelligence Repository
              </CardTitle>
            </CardHeader>
            <CardContent>
              <KnowledgeBasePanel
                investigationId={poll.investigation_id}
                investigationKind="standard"
                showIngestBanner
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Multi-Agent Debate — 7 specialized agents + coordinator synthesis (Feature 22) */}
        <TabsContent value="debate">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4 text-[var(--hack-cyan)]" />
                Multi-Agent Debate — Coordinated Reasoning Framework
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MultiAgentDebatePanel
                investigationId={poll.investigation_id}
                apiPath="standard"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intelligence Gap Analysis — missing intelligence detection + next action recommendations (Feature 23) */}
        <TabsContent value="gaps">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-[var(--hack-cyan)]" />
                Intelligence Gap Analysis — Strategic Decision Engine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IntelligenceGapPanel
                investigationId={poll.investigation_id}
                apiPath="standard"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Investigation Playbook — domain-aware operating mode (Feature 24) */}
        <TabsContent value="playbook">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[var(--hack-cyan)]" />
                Investigation Playbook — Domain-Aware Operating Mode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PlaybookPanel investigationId={poll.investigation_id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Chain & Provenance — immutable audit trail (Feature 25) */}
        <TabsContent value="provenance">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-[var(--hack-cyan)]" />
                Evidence Chain & Provenance — Immutable Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProvenancePanel investigationId={poll.investigation_id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media Intelligence Engine — parallel social media analysis */}
        <TabsContent value="social">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--hack-cyan)]" />
                Social Media Intelligence Engine — Cross-Platform Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SocialIntelligencePanel investigationId={poll.investigation_id} apiPath="standard" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sources */}
        <TabsContent value="sources">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Sources Consulted
                <span className="text-xs font-mono text-muted-foreground">
                  {report.sources_consulted.filter((s) => s.status === "success").length}/
                  {report.sources_consulted.length} successful
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {report.sources_consulted.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3  border border-white/10 bg-black/20 p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SourceBadge
                        label={s.source_label}
                        status={s.status}
                        url={s.url}
                        error={s.error}
                        findingCount={s.finding_count}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <span className="font-mono">{s.finding_count} findings</span>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--hack-green)] hover:underline"
                        >
                          visit ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Raw source findings drill-down */}
              {poll.source_results.length > 0 && (
                <details className="mt-5 group">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-[var(--hack-green)]">
                    Show raw source findings ({poll.source_results.reduce((n, s) => n + s.findings.length, 0)} items)
                  </summary>
                  <div className="mt-3 space-y-3 max-h-96 overflow-y-auto pr-2">
                    {poll.source_results.map((sr) =>
                      sr.findings.map((f, i) => (
                        <div key={`${sr.source}-${i}`} className="rounded border border-white/5 bg-black/30 p-2 text-xs">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-mono text-[10px] text-[var(--hack-green)]">{sr.source_label}</span>
                            <AttributionTag source={sr.source_label} url={f.source_url} />
                          </div>
                          <p className="text-muted-foreground">{f.data}</p>
                        </div>
                      ))
                    )}
                  </div>
                </details>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Map */}
        <TabsContent value="map">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapIcon className="h-4 w-4 text-[var(--hack-green)]" />
                Quantum Intel Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <IntelMap points={report.geopoints} />
              {report.geopoints.length > 0 && (
                <div className="mt-4 grid sm:grid-cols-2 gap-2">
                  {report.geopoints.map((g, i) => (
                    <div key={i} className="rounded border border-white/10 bg-black/20 p-2 text-xs">
                      <div className="font-medium">{g.label}</div>
                      <div className="text-muted-foreground">{g.note}</div>
                      <div className="mt-1 font-mono text-[10px] text-[var(--hack-green)]/70">src: {g.source}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ask AI — Follow-up Q&A */}
        <TabsContent value="ask">
          <Card className="bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--hack-cyan)]" />
                Ask AI About This Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AskAIPanel poll={poll} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modules */}
        <TabsContent value="modules">
          <div className="space-y-4">
            <Card className="bg-card/60 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-base">Specialized Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Run deeper analysis on this target using the specialized modules. Each operates
                  independently with its own AI assessment and source attribution.
                </p>
                <div className="grid sm:grid-cols-3 gap-2">
                  <ModuleToggle
                    icon={ScanEye}
                    label="Visual Intelligence"
                    active={showVisual}
                    onClick={() => setShowVisual((v) => !v)}
                  />
                  <ModuleToggle
                    icon={Wallet}
                    label="Crypto Tracing"
                    active={showCrypto}
                    onClick={() => setShowCrypto((v) => !v)}
                  />
                  <ModuleToggle
                    icon={ShieldAlert}
                    label="Sanctions Screening"
                    active={showSanctions}
                    onClick={() => setShowSanctions((v) => !v)}
                  />
                </div>
              </CardContent>
            </Card>

            {showVisual && <VisualIntelPanel />}
            {showCrypto && (
              <CryptoPanel initialWallet={report.input_type === "wallet" ? poll.target : undefined} />
            )}
            {showSanctions && (
              <SanctionsPanel
                initialName={
                  report.input_type === "person" || report.input_type === "organization"
                    ? poll.target
                    : undefined
                }
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
      </div>

      {/* Notes/Tags editor */}
      <NotesEditorDialog
        open={notesOpen}
        onOpenChange={setNotesOpen}
        investigationId={poll.investigation_id}
        initialStarred={meta.starred}
        initialTags={meta.tags}
        initialNotes={meta.notes}
        onSaved={(data) => setMeta((m) => ({ ...m, ...data }))}
      />
    </div>
  );
}

function AnnotationEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <div className="mt-2  border border-[var(--hack-green)]/30 bg-black/30 p-2">
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 500))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSave(text);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="Add an annotation for this finding… (Cmd+Enter to save, Esc to cancel)"
        className="w-full min-h-[60px] bg-transparent text-xs resize-y focus:outline-none placeholder:text-muted-foreground/50"
      />
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground font-mono">{text.length}/500</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-6 text-[11px] bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]"
            onClick={() => onSave(text)}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModuleToggle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof ScanEye;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2  border px-3 py-2.5 text-sm transition ${
        active
          ? "border-[var(--hack-green)]/50 bg-[var(--hack-green)]/10 text-[var(--hack-green)]"
          : "border-white/10 bg-black/20 hover:border-[var(--hack-green)]/30"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      <Badge variant="outline" className="ml-auto text-[10px]">
        {active ? "open" : "open"}
      </Badge>
    </button>
  );
}

function reportToMarkdown(poll: PollResponse): string {
  const r = poll.report!;
  const lines: string[] = [];
  lines.push(`# OSINTiger Intelligence Report`);
  lines.push("");
  lines.push(`**Target:** ${poll.target}`);
  lines.push(`**Input type:** ${r.input_type} · **Language:** ${r.language_guess} (${r.script})`);
  lines.push(`**Investigation ID:** ${poll.investigation_id}`);
  lines.push(`**Created:** ${poll.created_at}`);
  if (poll.completed_at) lines.push(`**Completed:** ${poll.completed_at}`);
  lines.push(`**Overall confidence:** ${Math.round(r.confidence_score * 100)}%`);
  lines.push(`**Attribution valid:** ${r.attribution_valid ? "YES" : "NO — needs manual review"}`);
  lines.push("");
  lines.push(`## Executive Summary`);
  lines.push(r.executive_summary);
  lines.push("");
  lines.push(`## Key Findings`);
  r.key_findings.forEach((f, i) => {
    lines.push(`${i + 1}. ${f.claim} _(confidence: ${Math.round(f.confidence * 100)}%)_`);
  });
  lines.push("");
  lines.push(`## Detailed Analysis`);
  lines.push(r.detailed_analysis);
  lines.push("");
  lines.push(`## Analysis of Competing Hypotheses`);
  r.ach_analysis.hypotheses.forEach((h, i) => {
    lines.push(`${i + 1}. **${h.statement}** — ${Math.round(h.confidence * 100)}% confidence`);
    lines.push(`   ${h.rationale}`);
  });
  lines.push("");
  if (r.ach_analysis.evidence.length) {
    lines.push(`### Evidence Matrix`);
    lines.push("| # | Evidence | Source |");
    lines.push("|---|----------|--------|");
    r.ach_analysis.evidence.forEach((e, i) => {
      lines.push(`| ${i + 1} | ${e.text.replace(/\|/g, "\\|")} | ${e.source} |`);
    });
  }
  lines.push("");
  lines.push(`## Sources Consulted`);
  r.sources_consulted.forEach((s) => {
    lines.push(`- **${s.source_label}** — ${s.status} (${s.finding_count} findings)${s.url ? " — " + s.url : ""}`);
  });
  lines.push("");
  if (r.geopoints.length) {
    lines.push(`## Geographic Signals`);
    r.geopoints.forEach((g) => {
      lines.push(`- ${g.label}${g.country ? " (" + g.country + ")" : ""} — ${g.note || ""} [src: ${g.source}]`);
    });
  }
  lines.push("");
  lines.push(`---`);
  lines.push(`_Generated by OSINTiger. Every claim carries [SOURCE] attribution. No hallucinated content._`);
  return lines.join("\n");
}

// Evidence Knowledge Graph — fetches the force-directed graph from the investigation's evidence.
// This is a separate component because it needs to fetch data on mount.
function EvidenceKnowledgeGraph({ investigationId }: { investigationId: string }) {
  const [graph, setGraph] = useState<import("@/lib/osint/agent/graph-types").KnowledgeGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/investigate/${investigationId}/graph`, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled && data.graph) {
          setGraph(data.graph);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load graph");
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [investigationId]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
        <p className="font-mono text-xs text-[var(--hack-gray)]">
          {"» building knowledge graph from evidence..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">
        {`» Error: ${error}`}
      </p>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">
        {"» No graph data — insufficient evidence to build knowledge graph."}
      </p>
    );
  }

  return <KnowledgeGraphPanel graph={graph} />;
}
