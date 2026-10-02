"use client";

import { useState, useEffect } from "react";
import {
  Building2, User, ShieldAlert, Server, ShieldCheck, FileText, GitBranch,
  AlertTriangle, AlertCircle, BookOpen, ChevronDown, ChevronRight, Loader2,
} from "lucide-react";
import {
  fetchPlaybooks, type PlaybookSummary, type PlaybookType,
} from "@/lib/osint/client";

const PLAYBOOK_ICONS: Record<string, React.ElementType> = {
  Building2,
  User,
  ShieldAlert,
  Server,
  ShieldCheck,
  FileText,
  GitBranch,
  AlertTriangle,
  AlertCircle,
  BookOpen,
};

const COLOR_CLASSES: Record<string, { text: string; border: string; bg: string }> = {
  cyan: { text: "text-[var(--hack-cyan)]", border: "border-[var(--hack-cyan)]/40", bg: "bg-[var(--hack-cyan)]/10" },
  green: { text: "text-[var(--hack-green)]", border: "border-[var(--hack-green)]/40", bg: "bg-[var(--hack-green)]/10" },
  amber: { text: "text-[var(--hack-amber)]", border: "border-[var(--hack-amber)]/40", bg: "bg-[var(--hack-amber)]/10" },
  red: { text: "text-[var(--hack-red)]", border: "border-[var(--hack-red)]/40", bg: "bg-[var(--hack-red)]/10" },
  purple: { text: "text-[var(--hack-purple)]", border: "border-[var(--hack-purple)]/40", bg: "bg-[var(--hack-purple)]/10" },
};

interface Props {
  inputType: string;
  selected: PlaybookType | null;
  onSelect: (playbook: PlaybookType | null) => void;
}

export function PlaybookPicker({ inputType, selected, onSelect }: Props) {
  const [playbooks, setPlaybooks] = useState<PlaybookSummary[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, { type: PlaybookType; name: string; shortName: string; color: string; icon: string }[]>>({});
  const [recommended, setRecommended] = useState<PlaybookType | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedPb, setExpandedPb] = useState<Set<PlaybookType>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = await fetchPlaybooks(inputType);
        if (!active) return;
        setPlaybooks(d.playbooks);
        setByCategory(d.byCategory);
        setRecommended(d.recommended);
        // Auto-expand the recommended category
        if (d.recommended) {
          const rec = d.playbooks.find((p) => p.type === d.recommended);
          if (rec) setExpandedCats(new Set([rec.category]));
        }
        setLoading(false);
      } catch {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [inputType]);

  const toggleCat = (cat: string) => setExpandedCats((prev) => {
    const next = new Set(prev);
    if (next.has(cat)) next.delete(cat); else next.add(cat);
    return next;
  });

  const togglePb = (type: PlaybookType) => setExpandedPb((prev) => {
    const next = new Set(prev);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });

  if (loading) return (
    <div className="flex items-center gap-2 py-2">
      <Loader2 className="h-3 w-3 animate-spin text-[var(--hack-cyan)]" />
      <span className="font-mono text-[10px] text-[var(--hack-gray)]">Loading playbooks...</span>
    </div>
  );

  const selectedPb = playbooks.find((p) => p.type === selected);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--hack-gray)]">Playbook:</span>
        <button
          onClick={() => onSelect(null)}
          className={`font-mono text-[9px] border px-2 py-0.5 uppercase transition ${
            selected === null
              ? "border-[var(--hack-border)] bg-black/40 text-[var(--hack-gray)]"
              : "border-[var(--hack-border)] bg-transparent text-[var(--hack-gray)]/60 hover:text-[var(--hack-gray)]"
          }`}
        >
          Auto (default)
        </button>
        {recommended && (
          <span className="font-mono text-[9px] text-[var(--hack-cyan)]/60">
            recommended: {playbooks.find((p) => p.type === recommended)?.shortName}
          </span>
        )}
        {selectedPb && (
          <span className="font-mono text-[9px] text-[var(--hack-green)]">
            selected: {selectedPb.shortName}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {Object.entries(byCategory).map(([cat, pbs]) => {
          const isExpanded = expandedCats.has(cat);
          return (
            <div key={cat} className="border border-[var(--hack-border)] bg-black/20">
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-[var(--hack-cyan)]/5"
              >
                {isExpanded ? <ChevronDown className="h-3 w-3 text-[var(--hack-gray)]" /> : <ChevronRight className="h-3 w-3 text-[var(--hack-gray)]" />}
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--hack-gray)]">{cat}</span>
                <span className="font-mono text-[8px] text-[var(--hack-gray)]/50 ml-auto">{pbs.length}</span>
              </button>
              {isExpanded && (
                <div className="px-2 pb-2 space-y-1">
                  {pbs.map((pbSum) => {
                    const pb = playbooks.find((p) => p.type === pbSum.type);
                    if (!pb) return null;
                    const Icon = PLAYBOOK_ICONS[pb.icon] || BookOpen;
                    const colors = COLOR_CLASSES[pb.color] || COLOR_CLASSES.cyan;
                    const isSelected = selected === pb.type;
                    const isRecommended = recommended === pb.type;
                    const isApplicable = pb.applicableInputTypes.includes(inputType) || inputType === "auto";
                    const isExpandedPb = expandedPb.has(pb.type);
                    return (
                      <div key={pb.type} className={`border ${isSelected ? colors.border + " " + colors.bg : "border-[var(--hack-border)] bg-black/30"}`}>
                        <div className="flex items-center">
                          <button
                            onClick={() => onSelect(isSelected ? null : pb.type)}
                            className={`flex items-center gap-2 px-2 py-1.5 flex-1 text-left hover:bg-white/5 ${isApplicable ? "" : "opacity-50"}`}
                          >
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${colors.text}`} />
                            <span className={`font-mono text-[10px] ${isSelected ? colors.text : "text-[var(--hack-gray)]"}`}>{pb.shortName}</span>
                            {isRecommended && <span className="font-mono text-[7px] text-[var(--hack-cyan)] border border-[var(--hack-cyan)]/30 px-0.5">REC</span>}
                            {isApplicable && !isRecommended && <span className="font-mono text-[7px] text-[var(--hack-green)] border border-[var(--hack-green)]/30 px-0.5">FIT</span>}
                          </button>
                          <button
                            onClick={() => togglePb(pb.type)}
                            className="px-2 py-1.5 hover:bg-white/5"
                          >
                            {isExpandedPb ? <ChevronDown className="h-2.5 w-2.5 text-[var(--hack-gray)]" /> : <ChevronRight className="h-2.5 w-2.5 text-[var(--hack-gray)]" />}
                          </button>
                        </div>
                        {isExpandedPb && (
                          <div className="px-2 pb-2 space-y-1.5">
                            <p className="font-mono text-[9px] text-[var(--hack-gray)]/70 leading-relaxed">{pb.description}</p>
                            <div>
                              <span className="font-mono text-[8px] uppercase text-[var(--hack-cyan)]/50">Collection:</span>
                              <p className="font-mono text-[9px] text-[var(--hack-gray)]/60 italic">{pb.collectionRationale}</p>
                            </div>
                            <div>
                              <span className="font-mono text-[8px] uppercase text-[var(--hack-green)]/50">Scoring:</span>
                              <p className="font-mono text-[9px] text-[var(--hack-gray)]/60 italic">{pb.scoringRationale}</p>
                            </div>
                            <div>
                              <span className="font-mono text-[8px] uppercase text-[var(--hack-amber)]/50">Reporting:</span>
                              <p className="font-mono text-[9px] text-[var(--hack-gray)]/60 italic">{pb.reportingRationale}</p>
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[8px] text-[var(--hack-gray)]/50">
                              <span>certainty: {pb.expectedCertainty}</span>
                              <span>questions: {pb.typicalQuestions.length}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
