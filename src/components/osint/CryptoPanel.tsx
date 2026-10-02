"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCrypto } from "@/lib/osint/client";
import type { CryptoResult } from "@/lib/osint/types";
import {
  Wallet,
  Loader2,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  AlertTriangle,
  Coins,
} from "lucide-react";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { CryptoTimeline, CryptoHeatmap, CryptoFlowStats } from "./CryptoAnalytics";

function riskMeta(label: CryptoResult["risk_label"]) {
  switch (label) {
    case "low":
      return { cls: "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10", pct: 25 };
    case "moderate":
      return { cls: "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10", pct: 45 };
    case "elevated":
      return { cls: "border-[var(--hack-green)]/50 text-[var(--hack-green)] bg-[var(--hack-green)]/10", pct: 65 };
    case "high":
      return { cls: "border-[var(--hack-red)]/50 text-[var(--hack-red)] bg-[var(--hack-red)]/10", pct: 85 };
  }
}

export function CryptoPanel({ initialWallet }: { initialWallet?: string }) {
  const [wallet, setWallet] = useState(initialWallet || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CryptoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!wallet.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchCrypto(wallet.trim());
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Crypto analysis failed");
    } finally {
      setLoading(false);
    }
  }

  const rm = result ? riskMeta(result.risk_label) : null;

  return (
    <Card className="bg-card/60 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-[var(--hack-green)]" />
          Cryptocurrency Tracing — Ethereum
        </CardTitle>
        <CardDescription>
          Wallet balance, transaction history, counterparty clustering and AI risk assessment.
          Enter a 0x… address to begin.
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
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="0x... Ethereum wallet address"
            className="bg-black/40 font-mono text-sm"
          />
          <Button type="submit" disabled={loading} className="bg-[var(--hack-green)] text-black hover:bg-[var(--hack-green)]">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Trace
          </Button>
        </form>

        {error && <p className="text-sm text-[var(--hack-red)]">{error}</p>}

        {result && rm && (
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Balance" value={`${result.balance_eth.toFixed(4)} ETH`} sub={`$${result.balance_usd.toLocaleString()}`} />
              <KPI label="Transactions" value={String(result.transaction_count)} sub={`${result.total_volume_eth.toFixed(2)} ETH vol`} />
              <KPI label="Counterparties" value={String(result.top_counterparties.length)} sub="unique addrs" />
              <KPI label="ETH Price" value={`$${result.eth_price_usd.toLocaleString()}`} sub="spot" />
            </div>

            {/* Risk */}
            <div className=" border border-white/10 bg-black/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[var(--hack-green)]" />
                  Risk Assessment
                </span>
                <Badge variant="outline" className={`uppercase ${rm.cls}`}>
                  {result.risk_label}
                </Badge>
              </div>
              <ConfidenceMeter value={result.risk_score / 100} label="risk score" size="md" />
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {result.ai_assessment}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground font-mono">
                {result.first_seen && <span>first seen: {new Date(result.first_seen).toLocaleDateString()}</span>}
                {result.last_active && <span>last active: {new Date(result.last_active).toLocaleDateString()}</span>}
                <span>ERC-20 transfers: {result.transactions.filter((t) => t.token).length}</span>
              </div>
            </div>

            {/* Deep analytics */}
            {result.transactions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[var(--hack-green)]" />
                  Deep Analytics
                </h4>
                <CryptoFlowStats transactions={result.transactions} />
                <CryptoTimeline transactions={result.transactions} />
                <CryptoHeatmap transactions={result.transactions} />
              </div>
            )}

            {/* Top counterparties */}
            {result.top_counterparties.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-[var(--hack-green)]" />
                  Top Counterparties
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {result.top_counterparties.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between  border border-white/5 bg-black/20 px-3 py-2 text-xs"
                    >
                      <span className="font-mono truncate max-w-[55%]">{c.address}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted-foreground">{c.count} txs</span>
                        <span className="font-mono text-[var(--hack-green)]">{c.total_eth.toFixed(3)} ETH</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {c.direction}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transactions table */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Coins className="h-4 w-4 text-[var(--hack-green)]" />
                Recent Transactions ({result.transactions.length})
              </h4>
              <div className=" border border-white/10 max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-black/60 backdrop-blur">
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="h-8 text-[11px]">Dir</TableHead>
                      <TableHead className="h-8 text-[11px]">Date</TableHead>
                      <TableHead className="h-8 text-[11px]">Counterparty</TableHead>
                      <TableHead className="h-8 text-[11px] text-right">Value</TableHead>
                      <TableHead className="h-8 text-[11px]">Token</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.transactions.slice(0, 50).map((t, i) => (
                      <TableRow key={i} className="border-white/5 text-xs">
                        <TableCell className="py-1.5">
                          {t.direction === "in" ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-[var(--hack-green)]" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-[var(--hack-red)]" />
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-[11px] text-muted-foreground">
                          {new Date(t.timestamp).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-1.5 font-mono text-[11px] truncate max-w-[160px]">
                          {t.direction === "in" ? t.from : t.to}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono">
                          {t.value_eth > 0 ? t.value_eth.toFixed(4) : "—"}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {t.token ? (
                            <Badge variant="outline" className="text-[10px]">
                              {t.token}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">ETH</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              {result.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded border border-white/10 px-2 py-0.5 hover:border-[var(--hack-green)]/40 hover:text-[var(--hack-green)]"
                >
                  {s.source_label} ↗
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className=" border border-white/10 bg-black/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold text-[var(--hack-green)]">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
