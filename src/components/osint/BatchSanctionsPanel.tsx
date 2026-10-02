"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Loader2,
  Search,
  Upload,
  FileText,
  Download,
  AlertTriangle,
} from "lucide-react";
import type { SanctionsResult } from "@/lib/osint/types";
import { ConfidenceMeter } from "./ConfidenceMeter";

interface BatchResult {
  query: string;
  match_status: SanctionsResult["match_status"];
  top_match: string | null;
  top_similarity: number;
  matches_count: number;
  result: SanctionsResult;
}

interface BatchResponse {
  results: BatchResult[];
  summary: { total: number; no_match: number; possible_match: number; likely_match: number };
  list_size: number;
  checked_at: string;
}

function statusMeta(status: SanctionsResult["match_status"]) {
  if (status === "likely_match")
    return { label: "Likely", cls: "border-[var(--hack-red)]/50 text-[var(--hack-red)] bg-[var(--hack-red)]/10", Icon: ShieldAlert };
  if (status === "possible_match")
    return { label: "Possible", cls: "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10", Icon: ShieldQuestion };
  return { label: "Clear", cls: "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10", Icon: ShieldCheck };
}

export function BatchSanctionsPanel() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    const names = text.split(/[\n,]/).map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/sanctions/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error || `Batch request failed (${r.status})`);
      }
      const data: BatchResponse = await r.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch screening failed");
    } finally {
      setLoading(false);
    }
  }

  function downloadCSV() {
    if (!result) return;
    const header = "query,match_status,top_match,top_similarity,matches_count\n";
    const lines = result.results.map((r) =>
      `"${r.query}","${r.match_status}","${r.top_match || ""}",${r.top_similarity},${r.matches_count}`
    );
    const csv = header + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `osintiger-batch-sanctions-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-[var(--hack-green)]" />
          Batch Sanctions Screening
        </CardTitle>
        <CardDescription>
          Paste a list of names (one per line or comma-separated) for bulk OFAC SDN screening.
          Max 200 names per batch. Results include per-name match status + downloadable CSV.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Names to screen
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Vladimir Putin\nRoman Abramovich\nDaniel Kinahan\nJohn Smith\n..."}
              className="w-full min-h-[140px]  border border-white/10 bg-black/40 p-3 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-var(--hack-green)/40"
            />
            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{text.split(/[\n,]/).map((n) => n.trim()).filter(Boolean).length} names</span>
              <button
                onClick={() => setText("Vladimir Putin\nRoman Abramovich\nDaniel Kinahan\nBashar Al-Assad\nEl Chapo\nJohn Smith")}
                className="text-[var(--hack-green)] hover:underline"
              >
                Load sample
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={run}
              disabled={loading || !text.trim()}
              className="bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Screen Batch
            </Button>
            {result && (
              <Button variant="outline" size="sm" onClick={downloadCSV}>
                <Download className="h-3.5 w-3.5" /> Download CSV
              </Button>
            )}
            {result && (
              <div className="grid grid-cols-3 gap-2 mt-1">
                <SummaryCard label="Clear" value={result.summary.no_match} cls="text-[var(--hack-green)] border-[var(--hack-green)]/30" />
                <SummaryCard label="Possible" value={result.summary.possible_match} cls="text-[var(--hack-green)] border-[var(--hack-green)]/30" />
                <SummaryCard label="Likely" value={result.summary.likely_match} cls="text-[var(--hack-red)] border-[var(--hack-red)]/30" />
              </div>
            )}
            {result && (
              <div className="text-[11px] text-muted-foreground font-mono pt-1">
                Checked {result.list_size} entries at {new Date(result.checked_at).toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-[var(--hack-red)]">{error}</p>}

        {result && (
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {result.results.map((r, i) => {
              const meta = statusMeta(r.match_status);
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3  border p-2.5 transition fade-in ${
                    r.match_status === "likely_match"
                      ? "border-[var(--hack-red)]/30 bg-[var(--hack-red)]/5"
                      : r.match_status === "possible_match"
                      ? "border-[var(--hack-green)]/30 bg-[var(--hack-green)]/5"
                      : "border-white/5 bg-black/20"
                  }`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <meta.Icon className={`h-4 w-4 shrink-0 ${
                    r.match_status === "likely_match" ? "text-[var(--hack-red)]" :
                    r.match_status === "possible_match" ? "text-[var(--hack-green)]" : "text-[var(--hack-green)]"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{r.query}</span>
                      <Badge variant="outline" className={`text-[9px] uppercase ${meta.cls}`}>
                        {meta.label}
                      </Badge>
                    </div>
                    {r.top_match && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        → {r.top_match} ({Math.round(r.top_similarity * 100)}%)
                      </div>
                    )}
                  </div>
                  {r.matches_count > 0 && (
                    <div className="w-20 shrink-0">
                      <ConfidenceMeter value={r.top_similarity} size="sm" showLabel={false} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={` border ${cls} bg-black/20 p-2 text-center`}>
      <div className="font-mono text-lg font-bold">{value}</div>
      <div className="text-[9px] uppercase tracking-wider">{label}</div>
    </div>
  );
}
