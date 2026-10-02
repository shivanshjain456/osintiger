"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Building2,
  Globe,
  Network,
  Wallet,
  ShieldAlert,
  ChevronRight,
  Zap,
} from "lucide-react";
import { TEMPLATES, type InvestigationTemplate } from "@/lib/osint/templates";

const ICONS: Record<string, typeof User> = {
  User,
  Building2,
  Globe,
  Network,
  Wallet,
  ShieldAlert,
};

export function TemplatePicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (template: InvestigationTemplate, target: string) => void;
}) {
  const [selectedTemplate, setSelectedTemplate] = useState<InvestigationTemplate | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-card/95 backdrop-blur-xl border-[var(--hack-green)]/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-[var(--hack-green)]" />
            Investigation Templates
          </DialogTitle>
          <DialogDescription className="sr-only">
            Pre-configured investigation templates for common OSINT target types.
          </DialogDescription>
        </DialogHeader>

        {!selectedTemplate ? (
          <div className="flex-1 overflow-y-auto -mr-2 pr-2">
            <p className="text-sm text-muted-foreground mb-3">
              Choose a template to quickly start an investigation with the right sources and settings.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {TEMPLATES.map((t) => {
                const Icon = ICONS[t.icon] || User;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t)}
                    className={`group text-left  border border-white/10 bg-gradient-to-br ${t.color} p-4 transition hover:border-[var(--hack-green)]/40 hover:-translate-y-0.5 fade-in`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-9 w-9 items-center justify-center  bg-[var(--hack-green)]/10 ring-1 ring-var(--hack-green)/20">
                        <Icon className="h-4 w-4 text-[var(--hack-green)]" />
                      </div>
                      <span className="font-medium text-sm">{t.label}</span>
                      <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-[var(--hack-green)] transition" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] uppercase">
                        {t.inputType}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{t.exampleTargets.length} examples</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-4">
            <button
              onClick={() => setSelectedTemplate(null)}
              className="text-xs text-muted-foreground hover:text-[var(--hack-green)]"
            >
              ← Back to templates
            </button>
            <div className={` border border-white/10 bg-gradient-to-br ${selectedTemplate.color} p-5`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center  bg-[var(--hack-green)]/15 ring-1 ring-var(--hack-green)/20">
                  {(() => {
                    const Icon = ICONS[selectedTemplate.icon] || User;
                    return <Icon className="h-5 w-5 text-[var(--hack-green)]" />;
                  })()}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedTemplate.label}</h3>
                  <Badge variant="outline" className="text-[9px] uppercase mt-0.5">
                    {selectedTemplate.inputType}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
            </div>

            <div>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Example Targets
              </h4>
              <div className="space-y-1.5">
                {selectedTemplate.exampleTargets.map((target) => (
                  <button
                    key={target}
                    onClick={() => {
                      onSelect(selectedTemplate, target);
                      onOpenChange(false);
                      setSelectedTemplate(null);
                    }}
                    className="group flex w-full items-center gap-3  border border-white/10 bg-black/20 px-4 py-2.5 text-left transition hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5"
                  >
                    <span className="font-mono text-xs text-[var(--hack-green)]/70 shrink-0">→</span>
                    <span className="text-sm flex-1 truncate">{target}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[var(--hack-green)] transition shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
