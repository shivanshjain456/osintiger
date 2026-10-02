"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Loader2,
  FileText,
  X,
  ChevronRight,
} from "lucide-react";

interface SearchResult {
  id: string;
  target: string;
  input_type: string;
  status: string;
  created_at: string;
  confidence: number | null;
  key_findings_count: number;
  sources_count: number;
  needs_review: boolean;
  starred: boolean;
  tags: string[];
}

export function SearchDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (id: string, target: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  async function runSearch(q?: string) {
    const search = (q ?? query).trim();
    if (!search) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      // Full-text search across finding content
      const r = await fetch(
        `/api/recent?content=${encodeURIComponent(search)}&limit=50`,
        { cache: "no-store" }
      );
      const data = await r.json();
      setResults(data.investigations || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-card/95 backdrop-blur-xl border-[var(--hack-green)]/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-[var(--hack-green)]" />
            Full-Text Search
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search across all report content — executive summaries, findings, detailed analysis, and raw source data.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="relative pb-3 border-b border-white/10">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search within reports (findings, analysis, source data)…"
            className="pl-10 pr-10 bg-black/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setSearched(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <div className="flex-1 overflow-y-auto -mr-2 pr-2 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Searching across all reports…
            </div>
          ) : !searched ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Search across all report content.</p>
              <p className="text-xs mt-1">Matches executive summaries, findings, analysis, and raw source data.</p>
              <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                {["Google", "Russia", "sanctions", "crypto", "proxy"].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setQuery(s);
                      runSearch(s);
                    }}
                    className=" border border-white/10 bg-black/30 px-3 py-1 text-xs text-[var(--hack-cyan)]/80 hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No reports found matching &ldquo;{query}&rdquo;.</p>
              <p className="text-xs mt-1">Try different keywords or check spelling.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground mb-2">
                {results.length} report{results.length !== 1 ? "s" : ""} matching &ldquo;{query}&rdquo;
              </div>
              {results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect(item.id, item.target);
                    onOpenChange(false);
                  }}
                  className="group flex w-full items-center gap-3  border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5 fade-in"
                >
                  <div className="flex h-8 w-8 items-center justify-center  bg-[var(--hack-green)]/10 ring-1 ring-var(--hack-green)/20 shrink-0">
                    <FileText className="h-4 w-4 text-[var(--hack-green)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{item.target}</span>
                      {item.starred && (
                        <span className="text-[var(--hack-green)] text-xs">★</span>
                      )}
                      {item.needs_review && (
                        <Badge variant="outline" className="text-[9px] border-[var(--hack-red)]/40 text-[var(--hack-red)] bg-[var(--hack-red)]/10 shrink-0">
                          REVIEW
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-mono uppercase">{item.input_type}</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      <span>{item.sources_count} sources</span>
                      <span>{item.key_findings_count} findings</span>
                    </div>
                  </div>
                  {item.confidence != null && (
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-[var(--hack-green)]">
                        {Math.round(item.confidence * 100)}%
                      </div>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-[var(--hack-green)] transition shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
