"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Trash2,
  Clock,
  Globe,
  Network,
  Wallet,
  User,
  Building2,
  ShieldAlert,
  AlertTriangle,
  X,
  Download,
  Loader2,
  Star,
  History as HistoryIcon,
} from "lucide-react";
import {
  fetchRecentWithFilters,
  deleteInvestigation,
  patchInvestigationMetadata,
  type HistoryItem,
} from "@/lib/osint/client";

const TYPE_ICONS: Record<string, typeof User> = {
  person: User,
  organization: Building2,
  domain: Globe,
  ip: Network,
  wallet: Wallet,
};

export function HistoryDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (id: string, target: string) => void;
}) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [starring, setStarring] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecentWithFilters(query, typeFilter, 100, starredOnly);
      // If query starts with #, filter by tag client-side
      let filtered = data.investigations;
      if (query.startsWith("#")) {
        const tagQuery = query.slice(1).toLowerCase();
        filtered = filtered.filter((i) =>
          i.tags.some((t) => t.toLowerCase().includes(tagQuery))
        );
      }
      setItems(filtered);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, starredOnly]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(load, 250); // debounce
      return () => clearTimeout(t);
    }
  }, [open, load]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteInvestigation(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleStar(id: string, current: boolean) {
    setStarring(id);
    try {
      const result = await patchInvestigationMetadata(id, { starred: !current });
      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, starred: result.starred } : i
        )
      );
    } catch {
      // ignore
    } finally {
      setStarring(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col bg-card/95 backdrop-blur-xl border-[var(--hack-green)]/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HistoryIcon className="h-5 w-5 text-[var(--hack-green)]" />
            Investigation History
            <Badge variant="outline" className="ml-2 font-mono text-[10px]">
              {items.length} records
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Search, filter, and manage past OSINT investigations persisted in the database.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 pb-3 border-b border-white/10">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by target name or #tag…"
              className="pl-9 bg-black/40"
            />
          </div>
          <button
            onClick={() => setStarredOnly((v) => !v)}
            className={`flex items-center gap-1.5  border px-3 py-2 text-xs transition shrink-0 ${
              starredOnly
                ? "border-[var(--hack-green)]/50 bg-[var(--hack-green)]/15 text-[var(--hack-green)]"
                : "border-white/10 bg-black/40 text-muted-foreground hover:border-[var(--hack-green)]/30"
            }`}
            title="Show starred only"
          >
            <Star className={`h-3.5 w-3.5 ${starredOnly ? "fill-var(--hack-green) text-[var(--hack-green)]" : ""}`} />
            <span className="hidden sm:inline">Starred</span>
          </button>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-black/40">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="person">Person</SelectItem>
              <SelectItem value="organization">Organization</SelectItem>
              <SelectItem value="domain">Domain</SelectItem>
              <SelectItem value="ip">IP Address</SelectItem>
              <SelectItem value="wallet">ETH Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-1.5 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading history…
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <HistoryIcon className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No investigations found.</p>
              <p className="text-xs mt-1">
                {query || typeFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Start your first investigation from the home page."}
              </p>
            </div>
          ) : (
            items.map((item) => {
              const Icon = TYPE_ICONS[item.input_type] || Globe;
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-3  border border-white/10 bg-black/20 px-3 py-2.5 transition hover:border-[var(--hack-green)]/40 hover:bg-[var(--hack-green)]/5"
                >
                  <div className="flex h-8 w-8 items-center justify-center  bg-[var(--hack-green)]/10 ring-1 ring-var(--hack-green)/20 shrink-0">
                    <Icon className="h-4 w-4 text-[var(--hack-green)]" />
                  </div>
                  <button
                    onClick={() => {
                      onSelect(item.id, item.target);
                      onOpenChange(false);
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{item.target}</span>
                      {item.starred && (
                        <Star className="h-3 w-3 fill-var(--hack-green) text-[var(--hack-green)] shrink-0" />
                      )}
                      {item.needs_review && (
                        <Badge variant="outline" className="text-[9px] border-[var(--hack-red)]/40 text-[var(--hack-red)] bg-[var(--hack-red)]/10 shrink-0">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                          REVIEW
                        </Badge>
                      )}
                      {item.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[9px] border-[var(--hack-green)]/30 text-[var(--hack-cyan)]/80 bg-[var(--hack-green)]/5 shrink-0">
                          {tag}
                        </Badge>
                      ))}
                      {item.tags.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{item.tags.length - 3}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-mono uppercase">{item.input_type}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                      <span>{item.sources_count} sources</span>
                      <span>{item.key_findings_count} findings</span>
                    </div>
                  </button>
                  {item.confidence != null && (
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold text-[var(--hack-green)]">
                        {Math.round(item.confidence * 100)}%
                      </div>
                      <div className="text-[9px] uppercase text-muted-foreground">conf</div>
                    </div>
                  )}
                  <button
                    onClick={() => handleToggleStar(item.id, item.starred)}
                    disabled={starring === item.id}
                    className={`shrink-0  p-1.5 transition hover:bg-[var(--hack-green)]/10 disabled:opacity-50 ${
                      item.starred ? "text-[var(--hack-green)]" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-[var(--hack-green)]"
                    }`}
                    title={item.starred ? "Unstar" : "Star this investigation"}
                  >
                    {starring === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Star className={`h-3.5 w-3.5 ${item.starred ? "fill-var(--hack-green)" : ""}`} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="shrink-0  p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition hover:bg-[var(--hack-red)]/10 hover:text-[var(--hack-red)] disabled:opacity-50"
                    title="Delete investigation"
                  >
                    {deleting === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-mono">
            Showing {items.length} of {items.length} (DB-backed, persists across sessions)
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-7"
          >
            <X className="h-3.5 w-3.5" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
