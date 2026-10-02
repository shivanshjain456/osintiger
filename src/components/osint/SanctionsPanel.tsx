"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fetchSanctions } from "@/lib/osint/client";
import type { SanctionsResult } from "@/lib/osint/types";
import { ShieldAlert, ShieldCheck, ShieldQuestion, Loader2, Search, Scale, ExternalLink, User, Building2 } from "lucide-react";
import { ConfidenceMeter } from "./ConfidenceMeter";

// Client-side program metadata mirror (kept in sync with src/lib/osint/programs.ts)
const PROGRAM_INFO: Record<string, { label: string; authority: string; severity: "critical" | "high" | "moderate" }> = {
  "RUSSIA-EO14024": { label: "Russia Harmful Foreign Activities", authority: "EO 14024 / CAATSA", severity: "high" },
  DPRK2: { label: "North Korea WMD", authority: "WMDPSR / NPKS", severity: "critical" },
  DPRK3: { label: "North Korea Sanctions", authority: "DPRK authorities", severity: "critical" },
  IRAN: { label: "Iran Transactions Reg.", authority: "ITR / IEEPA", severity: "high" },
  "IRAN-HR": { label: "Iran Human Rights", authority: "EO 13553", severity: "moderate" },
  "IRAN-EO13599": { label: "Iran Gov Officials", authority: "EO 13599", severity: "high" },
  SDGT: { label: "Global Terrorism", authority: "EO 13224", severity: "critical" },
  SDNTK: { label: "Narcotics Trafficking", authority: "Kingpin Act", severity: "high" },
  CYBER2: { label: "Malicious Cyber Activities", authority: "EO 13694", severity: "high" },
  VENEZUELA: { label: "Venezuela Sanctions", authority: "EO 13884", severity: "high" },
  BELARUS: { label: "Belarus Sanctions", authority: "EO 13405", severity: "moderate" },
  NICARAGUA: { label: "Nicaragua Sanctions", authority: "NICA Act", severity: "moderate" },
  CUBA: { label: "Cuba Sanctions", authority: "CACR", severity: "moderate" },
  BURMA: { label: "Burma/Myanmar Sanctions", authority: "BSR", severity: "moderate" },
  LIBYA2: { label: "Libya Sanctions", authority: "EO 13726", severity: "high" },
  SUDAN: { label: "Sudan Sanctions", authority: "Darfur authorities", severity: "moderate" },
  ZIMBABWE: { label: "Zimbabwe Sanctions", authority: "ZDERA", severity: "moderate" },
  SSUDAN: { label: "South Sudan Sanctions", authority: "EO 13664", severity: "moderate" },
  DRC: { label: "DR Congo Sanctions", authority: "EO 13413", severity: "moderate" },
  DARFOUR: { label: "Darfur/Sahel Sanctions", authority: "EO 13400", severity: "moderate" },
  Mali: { label: "Mali Sanctions", authority: "IEEPA", severity: "moderate" },
};

function severityBadge(sev: "critical" | "high" | "moderate") {
  if (sev === "critical")
    return "border-[var(--hack-red)]/50 text-[var(--hack-red)] bg-[var(--hack-red)]/10";
  if (sev === "high")
    return "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10";
  return "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10";
}

function statusMeta(status: SanctionsResult["match_status"]) {
  if (status === "likely_match")
    return {
      label: "Likely Match",
      cls: "border-[var(--hack-red)]/50 text-[var(--hack-red)] bg-[var(--hack-red)]/10",
      Icon: ShieldAlert,
      ring: "border-[var(--hack-red)]/40",
    };
  if (status === "possible_match")
    return {
      label: "Possible Match",
      cls: "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10",
      Icon: ShieldQuestion,
      ring: "border-[var(--hack-green)]/40",
    };
  return {
    label: "No Match",
    cls: "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10",
    Icon: ShieldCheck,
    ring: "border-[var(--hack-green)]/40",
  };
}

export function SanctionsPanel({ initialName }: { initialName?: string }) {
  const [name, setName] = useState(initialName || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SanctionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchSanctions(name.trim());
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Screening failed");
    } finally {
      setLoading(false);
    }
  }

  const meta = result ? statusMeta(result.match_status) : null;

  return (
    <Card className="bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[var(--hack-green)]" />
          OFAC SDN Sanctions Screening
        </CardTitle>
        <CardDescription>
          Fuzzy-matched against the U.S. Treasury Specially Designated Nationals list (curated
          sample, Levenshtein + token-overlap scoring). Screening tool only — manual verification required.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter a person or organization name…"
            className="bg-black/40"
          />
          <Button type="submit" disabled={loading} className="bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Screen
          </Button>
        </form>

        {error && <p className="text-sm text-[var(--hack-red)]">{error}</p>}

        {result && meta && (
          <div className={` border ${meta.ring} p-4 space-y-3`}>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className={`gap-1.5 ${meta.cls}`}>
                <meta.Icon className="h-3.5 w-3.5" />
                {meta.label}
              </Badge>
              <span className="font-mono text-[11px] text-muted-foreground">
                checked {result.list_size} entries
              </span>
            </div>

            {result.matches.length === 0 ? (
              <p className="text-sm text-[var(--hack-green)]">
                No SDN entries exceeded the 60% similarity threshold for &ldquo;{result.query}&rdquo;.
              </p>
            ) : (
              <div className="space-y-2">
                {result.matches.map((m, i) => {
                  const prog = PROGRAM_INFO[m.program] || { label: m.program, authority: "OFAC", severity: "moderate" as const };
                  return (
                    <div key={i} className=" border border-white/10 bg-black/30 p-3 hover:border-[var(--hack-green)]/30 transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {m.entity_type === "individual" ? (
                              <User className="h-3.5 w-3.5 text-[var(--hack-green)] shrink-0" />
                            ) : (
                              <Building2 className="h-3.5 w-3.5 text-[var(--hack-green)] shrink-0" />
                            )}
                            <span className="font-semibold text-[var(--hack-cyan)]">{m.sdn_name}</span>
                            <Badge variant="outline" className={`text-[9px] uppercase ${severityBadge(prog.severity)}`}>
                              {prog.severity}
                            </Badge>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Scale className="h-3 w-3" />
                              <span className="text-[var(--hack-cyan)]/90">{prog.label}</span>
                            </span>
                            <span className="font-mono text-muted-foreground/70">[{m.program}]</span>
                            <span className="font-mono text-muted-foreground/70">· {prog.authority}</span>
                          </div>
                          {m.remarks && (
                            <div className="mt-1 text-[11px] text-muted-foreground italic">
                              {m.remarks}
                            </div>
                          )}
                        </div>
                        <div className="w-28 shrink-0">
                          <ConfidenceMeter value={m.similarity} label="similarity" size="sm" />
                        </div>
                      </div>
                      <a
                        href={m.details_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--hack-green)] hover:underline"
                      >
                        View official OFAC entry <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-white/5">
              ⚠ Compliance note: This is an automated screening tool. Definitive sanctions
              status requires manual review against the official OFAC list.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
