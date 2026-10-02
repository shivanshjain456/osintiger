"use client";

import { useState, useEffect } from "react";
import { Loader2, User, Briefcase, GraduationCap, Lightbulb, FileText, Globe, Newspaper, DollarSign, ChevronDown, ChevronRight, Clock, GitBranch } from "lucide-react";

// =====================
// Types
// =====================

interface CareerEntry { organization: string; title: string; startDate?: string; endDate?: string; isCurrent?: boolean; status: string; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; }
interface BoardEntry { organization: string; role: string; startDate?: string; endDate?: string; isCurrent?: boolean; orgType?: string; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; }
interface EducationEntry { institution: string; degree: string; field?: string; year?: string; honors?: string; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; }
interface PatentEntry { title: string; patentNumber?: string; assignee?: string; coInventors?: string[]; filingDate?: string; jurisdiction?: string; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; }
interface PublicationEntry { title: string; venue?: string; date?: string; coAuthors?: string[]; type: string; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; }
interface SocialEntry { platform: string; handle?: string; url?: string; bio?: string; verified?: boolean; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; }
interface MediaEntry { outlet: string; headline: string; date?: string; mentionType: string; url?: string; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; }
interface DonationEntry { recipient: string; amount?: string; date?: string; jurisdiction?: string; employer?: string; source: string; sourceLabel: string; tier: number; confidence: number; evidence: string; }
interface TimelineEvent { date: string; category: string; event: string; source: string; sourceLabel: string; confidence: number; }
interface ExecRelationship { entity: string; type: string; detail: string; confidence: number; }

interface ExecProfile {
  career: CareerEntry[]; boards: BoardEntry[]; education: EducationEntry[];
  patents: PatentEntry[]; publications: PublicationEntry[]; social: SocialEntry[];
  media: MediaEntry[]; donations: DonationEntry[];
  timeline: TimelineEvent[]; relationships: ExecRelationship[];
  assessment: {
    totalDataPoints: number; careerRoles: number; boardSeats: number; educationRecords: number;
    patentCount: number; publicationCount: number; socialProfiles: number; mediaMentions: number;
    donationRecords: number; profileCompleteness: number; confidenceScore: number; explanation: string;
  };
  meta: { sourcesAnalyzed: number; findingsAnalyzed: number; generatedAt: string };
}

interface Props { investigationId: string; apiPath: "standard" | "agent"; }

const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-[var(--hack-green)]", self_reported: "text-[var(--hack-cyan)]", inferred: "text-[var(--hack-amber)]",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  career: Briefcase, board: Briefcase, education: GraduationCap, patent: Lightbulb,
  publication: FileText, media: Newspaper, donation: DollarSign, social: Globe,
};

export function ExecProfilePanel({ investigationId, apiPath }: Props) {
  const [profile, setProfile] = useState<ExecProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSecs, setExpandedSecs] = useState<Set<string>>(new Set(["timeline"]));
  const [viewMode, setViewMode] = useState<"timeline" | "sections">("timeline");

  useEffect(() => {
    let cancelled = false;
    const basePath = apiPath === "agent" ? "/api/agent/investigate" : "/api/investigate";
    fetch(`${basePath}/${investigationId}/exec-profile`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled && data.profile) { setProfile(data.profile); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof Error ? e.message : "Failed"); setLoading(false); } });
    return () => { cancelled = true; };
  }, [investigationId, apiPath]);

  if (loading) return (
    <div className="py-8 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[var(--hack-cyan)] mx-auto mb-2" />
      <p className="font-mono text-xs text-[var(--hack-gray)]">{"» building executive intelligence profile..."}</p>
    </div>
  );
  if (error) return <p className="font-mono text-xs text-[var(--hack-red)] py-6 text-center">{`» Error: ${error}`}</p>;
  if (!profile) return <p className="font-mono text-xs text-[var(--hack-gray)] py-6 text-center">{"» No data."}</p>;

  const { assessment, career, boards, education, patents, publications, social, media, donations, timeline, relationships } = profile;

  const toggleSec = (s: string) => setExpandedSecs((prev) => {
    const next = new Set(prev);
    if (next.has(s)) next.delete(s); else next.add(s);
    return next;
  });

  return (
    <div className="space-y-4">
      {/* Assessment */}
      <div className="border border-[var(--hack-border)] bg-black/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-[var(--hack-cyan)]" />
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--hack-gray)]">Executive Intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Completeness</div>
              <div className="font-mono text-lg font-bold text-[var(--hack-green)]">{assessment.profileCompleteness}%</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] text-[var(--hack-gray)]/60">Confidence</div>
              <div className="font-mono text-lg font-bold text-[var(--hack-cyan)]">{assessment.confidenceScore}%</div>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--hack-gray)] leading-relaxed">{assessment.explanation}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <Stat label="Career" value={assessment.careerRoles} icon={Briefcase} />
        <Stat label="Boards" value={assessment.boardSeats} icon={Briefcase} />
        <Stat label="Education" value={assessment.educationRecords} icon={GraduationCap} />
        <Stat label="Patents" value={assessment.patentCount} icon={Lightbulb} />
        <Stat label="Pubs" value={assessment.publicationCount} icon={FileText} />
        <Stat label="Social" value={assessment.socialProfiles} icon={Globe} />
        <Stat label="Media" value={assessment.mediaMentions} icon={Newspaper} />
        <Stat label="Donations" value={assessment.donationRecords} icon={DollarSign} />
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button onClick={() => setViewMode("timeline")} className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${viewMode === "timeline" ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]" : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)]"}`}>
          <Clock className="h-3 w-3" /> Timeline
        </button>
        <button onClick={() => setViewMode("sections")} className={`flex items-center gap-1.5 border px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${viewMode === "sections" ? "border-[var(--hack-cyan)]/40 bg-[var(--hack-cyan)]/10 text-[var(--hack-cyan)]" : "border-[var(--hack-border)] bg-black/20 text-[var(--hack-gray)]"}`}>
          <FileText className="h-3 w-3" /> Sections
        </button>
      </div>

      {/* Timeline View */}
      {viewMode === "timeline" && timeline.length > 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 max-h-[500px] overflow-y-auto">
          <div className="relative pl-6">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-[var(--hack-cyan)]/20" />
            {timeline.map((event, i) => {
              const Icon = CATEGORY_ICONS[event.category] || Clock;
              return (
                <div key={i} className="relative pb-3">
                  <div className="absolute -left-3 top-2 h-2.5 w-2.5 rounded-full border-2 border-[var(--hack-cyan)] bg-[var(--hack-bg)]" />
                  <div className="border border-[var(--hack-border)] bg-black/30 px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3 text-[var(--hack-cyan)] shrink-0" />
                      <span className="font-mono text-[10px] text-[var(--hack-cyan)] shrink-0">{event.date === "unknown" ? "???" : new Date(event.date).toLocaleDateString()}</span>
                      <span className="font-mono text-[9px] text-[var(--hack-gray)]/50 shrink-0">[{event.category}]</span>
                      <span className="font-mono text-[10px] text-[var(--hack-green)] truncate flex-1">{event.event}</span>
                      <span className="font-mono text-[8px] text-[var(--hack-gray)]/40 shrink-0">{(event.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sections View */}
      {viewMode === "sections" && (
        <div className="space-y-2">
          {/* Career */}
          {career.length > 0 && (
            <Section title="Career History" icon={Briefcase} expanded={expandedSecs.has("career")} onToggle={() => toggleSec("career")}>
              {career.map((c, i) => (
                <Entry key={i} status={c.status} confidence={c.confidence} sourceLabel={c.sourceLabel} tier={c.tier}>
                  <span className="text-[var(--hack-green)] font-bold">{c.title}</span> at <span className="text-[var(--hack-cyan)]">{c.organization}</span>
                </Entry>
              ))}
            </Section>
          )}
          {/* Boards */}
          {boards.length > 0 && (
            <Section title="Board Memberships" icon={Briefcase} expanded={expandedSecs.has("boards")} onToggle={() => toggleSec("boards")}>
              {boards.map((b, i) => (
                <Entry key={i} status="inferred" confidence={b.confidence} sourceLabel={b.sourceLabel} tier={b.tier}>
                  <span className="text-[var(--hack-green)]">{b.role}</span> at <span className="text-[var(--hack-cyan)]">{b.organization}</span>
                </Entry>
              ))}
            </Section>
          )}
          {/* Education */}
          {education.length > 0 && (
            <Section title="Education" icon={GraduationCap} expanded={expandedSecs.has("education")} onToggle={() => toggleSec("education")}>
              {education.map((e, i) => (
                <Entry key={i} status="inferred" confidence={e.confidence} sourceLabel={e.sourceLabel} tier={e.tier}>
                  <span className="text-[var(--hack-green)]">{e.degree}</span>{e.field ? ` in ${e.field}` : ""} from <span className="text-[var(--hack-cyan)]">{e.institution}</span>{e.year ? ` (${e.year})` : ""}
                </Entry>
              ))}
            </Section>
          )}
          {/* Patents */}
          {patents.length > 0 && (
            <Section title="Patents" icon={Lightbulb} expanded={expandedSecs.has("patents")} onToggle={() => toggleSec("patents")}>
              {patents.map((p, i) => (
                <Entry key={i} status="inferred" confidence={p.confidence} sourceLabel={p.sourceLabel} tier={p.tier}>
                  <span className="text-[var(--hack-green)]">{p.title}</span>{p.assignee ? ` (assigned to ${p.assignee})` : ""}{p.patentNumber ? ` [${p.patentNumber}]` : ""}
                </Entry>
              ))}
            </Section>
          )}
          {/* Publications */}
          {publications.length > 0 && (
            <Section title="Publications" icon={FileText} expanded={expandedSecs.has("publications")} onToggle={() => toggleSec("publications")}>
              {publications.map((p, i) => (
                <Entry key={i} status="inferred" confidence={p.confidence} sourceLabel={p.sourceLabel} tier={p.tier}>
                  <span className="text-[var(--hack-gray)]/50">[{p.type}]</span> <span className="text-[var(--hack-green)]">{p.title}</span>{p.venue ? ` — ${p.venue}` : ""}
                </Entry>
              ))}
            </Section>
          )}
          {/* Social */}
          {social.length > 0 && (
            <Section title="Social Presence" icon={Globe} expanded={expandedSecs.has("social")} onToggle={() => toggleSec("social")}>
              <div className="flex flex-wrap gap-1.5">
                {social.map((s, i) => (
                  <span key={i} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1.5 py-0.5 text-[var(--hack-cyan)]">
                    {s.platform}{s.handle ? `: ${s.handle}` : ""}
                  </span>
                ))}
              </div>
            </Section>
          )}
          {/* Media */}
          {media.length > 0 && (
            <Section title="Media Coverage" icon={Newspaper} expanded={expandedSecs.has("media")} onToggle={() => toggleSec("media")}>
              {media.slice(0, 10).map((m, i) => (
                <Entry key={i} status="inferred" confidence={m.confidence} sourceLabel={m.sourceLabel} tier={m.tier}>
                  <span className="text-[var(--hack-gray)]/50">[{m.mentionType}]</span> <span className="text-[var(--hack-green)]">{m.headline.slice(0, 80)}</span> — <span className="text-[var(--hack-cyan)]">{m.outlet}</span>
                </Entry>
              ))}
            </Section>
          )}
          {/* Donations */}
          {donations.length > 0 && (
            <Section title="Political Donations (Public Records)" icon={DollarSign} expanded={expandedSecs.has("donations")} onToggle={() => toggleSec("donations")}>
              {donations.map((d, i) => (
                <Entry key={i} status="confirmed" confidence={d.confidence} sourceLabel={d.sourceLabel} tier={d.tier}>
                  <span className="text-[var(--hack-green)]">{d.amount || "Amount unknown"}</span> to <span className="text-[var(--hack-cyan)]">{d.recipient}</span>{d.jurisdiction ? ` (${d.jurisdiction})` : ""}
                </Entry>
              ))}
            </Section>
          )}
          {/* Relationships */}
          {relationships.length > 0 && (
            <Section title="Relationship Network" icon={GitBranch} expanded={expandedSecs.has("relationships")} onToggle={() => toggleSec("relationships")}>
              <div className="flex flex-wrap gap-1.5">
                {relationships.slice(0, 20).map((r, i) => (
                  <span key={i} className="font-mono text-[9px] border border-[var(--hack-border)] bg-black/40 px-1.5 py-0.5 text-[var(--hack-gray)]">
                    <span className="text-[var(--hack-cyan)]">{r.type}</span>: {r.entity}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {assessment.totalDataPoints === 0 && (
        <div className="border border-[var(--hack-border)] bg-black/20 p-8 text-center">
          <User className="h-8 w-8 text-[var(--hack-gray)]/40 mx-auto mb-2" />
          <p className="font-mono text-xs text-[var(--hack-gray)]">{"» No executive intelligence data discovered. Target may not be a person."}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/30 px-2 py-1.5 text-center">
      <Icon className="h-3 w-3 mx-auto text-[var(--hack-cyan)] mb-0.5" />
      <div className="font-mono text-sm font-bold text-[var(--hack-cyan)]">{value}</div>
      <div className="font-mono text-[8px] uppercase tracking-wider text-[var(--hack-gray)]">{label}</div>
    </div>
  );
}

function Section({ title, icon: Icon, expanded, onToggle, children }: { title: string; icon: React.ElementType; expanded: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--hack-border)] bg-black/20">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--hack-cyan)]/5 transition-colors">
        <Icon className="h-4 w-4 text-[var(--hack-cyan)] shrink-0" />
        <span className="font-mono text-xs text-[var(--hack-green)] flex-1 text-left">{title}</span>
        {expanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
      </button>
      {expanded && <div className="px-3 pb-3 space-y-1">{children}</div>}
    </div>
  );
}

function Entry({ status, confidence, sourceLabel, tier, children }: { status: string; confidence: number; sourceLabel: string; tier: number; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--hack-border)]/30 px-2 py-1">
      <div className="flex items-center gap-2">
        <span className={`font-mono text-[8px] shrink-0 ${STATUS_COLORS[status] || "text-[var(--hack-gray)]"}`}>{status.toUpperCase()}</span>
        <span className="font-mono text-[10px] text-[var(--hack-gray)] flex-1">{children}</span>
      </div>
      <div className="font-mono text-[9px] text-[var(--hack-gray)]/40 mt-0.5">Source: {sourceLabel} · T{tier} · {(confidence * 100).toFixed(0)}%</div>
    </div>
  );
}
