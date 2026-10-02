// GET /api/crypto/[wallet] — Ethereum wallet tracing + AI risk assessment.

import { NextResponse } from "next/server";
import { queryEtherscan } from "@/lib/osint/sources/etherscan";
import { assessCryptoRisk } from "@/lib/osint/ai-client";
import type { CryptoResult, CryptoTransaction, SourceConsulted } from "@/lib/osint/types";
import { isValidEthereumAddress } from "@/lib/osint/detector";
import { safeErrorResponse } from "@/lib/osint/safe-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fetch real ETH→USD price from Coinbase API.
async function getEthPriceUsd(): Promise<number> {
  const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) {
    throw new Error(`Coinbase price API HTTP ${r.status}`);
  }
  const j = await r.json();
  const p = parseFloat(j?.data?.amount);
  if (isNaN(p)) {
    throw new Error("Coinbase price API returned invalid price");
  }
  return p;
}

function riskFromActivity(txs: CryptoTransaction[], counterparties: number, balanceEth: number): number {
  let score = 18;
  if (counterparties > 6) score += 12;
  if (balanceEth > 100) score += 14;
  const tokenRatio = txs.filter((t) => t.token).length / Math.max(1, txs.length);
  if (tokenRatio > 0.6) score += 18;
  const roundTransfers = txs.filter((t) => t.value_eth > 0 && t.value_eth % 1 === 0).length;
  if (roundTransfers > txs.length * 0.5) score += 10;
  const dust = txs.filter((t) => t.value_eth > 0 && t.value_eth < 0.001).length;
  if (dust > txs.length * 0.4) score += 8;
  return Math.max(5, Math.min(95, score));
}

function label(score: number): CryptoResult["risk_label"] {
  if (score < 30) return "low";
  if (score < 55) return "moderate";
  if (score < 75) return "elevated";
  return "high";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await params;
  const addr = decodeURIComponent(wallet).trim();
  if (!isValidEthereumAddress(addr)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address (expected 0x + 40 hex chars)" },
      { status: 400 }
    );
  }

  // Query blockchain data (Etherscan + Blockscout)
  const eth = await queryEtherscan(addr);

  // If both APIs failed, return the error — NO fake data
  if (eth.source_result.status === "error") {
    return NextResponse.json(
      {
        error: eth.source_result.error || "Ethereum blockchain API error",
        wallet: addr,
        valid: true,
      },
      { status: 503 }
    );
  }

  // Fetch real ETH price
  let ethPrice: number;
  try {
    ethPrice = await getEthPriceUsd();
  } catch (e) {
    return safeErrorResponse(e, "Failed to fetch ETH price");
  }

  const riskScore = riskFromActivity(
    eth.transactions,
    eth.counterparties.length,
    eth.balance_eth
  );

  // Build a compact summary for the AI
  const topCp = eth.counterparties.slice(0, 5).map(
    (c) => `${c.address.slice(0, 10)}… (${c.count} txs, ${c.total_eth.toFixed(3)} ETH, ${c.direction})`
  );
  const summary = [
    `Wallet: ${addr}`,
    `Balance: ${eth.balance_eth.toFixed(4)} ETH (~$${(eth.balance_eth * ethPrice).toFixed(2)})`,
    `Transactions analyzed: ${eth.transactions.length}`,
    `Total volume: ${eth.total_volume_eth.toFixed(3)} ETH`,
    `ERC-20 token transfers: ${eth.token_transfers}`,
    `Counterparties: ${eth.counterparties.length}`,
    `Top counterparties: ${topCp.join(" | ")}`,
    `First activity: ${eth.first_seen}`,
    `Last activity: ${eth.last_active}`,
  ].join("\n");

  const aiAssessment = await assessCryptoRisk(addr, summary);

  const sources: SourceConsulted[] = [
    {
      source: "etherscan",
      source_label: "Etherscan",
      status: eth.source_result.status,
      url: `https://etherscan.io/address/${addr}`,
      finding_count: eth.source_result.findings.length,
    },
  ];

  const result: CryptoResult = {
    wallet: addr,
    valid: true,
    balance_eth: eth.balance_eth,
    balance_usd: parseFloat((eth.balance_eth * ethPrice).toFixed(2)),
    eth_price_usd: ethPrice,
    transaction_count: eth.transactions.length,
    first_seen: eth.first_seen,
    last_active: eth.last_active,
    top_counterparties: eth.counterparties,
    total_volume_eth: parseFloat(eth.total_volume_eth.toFixed(4)),
    risk_score: riskScore,
    risk_label: label(riskScore),
    ai_assessment: aiAssessment,
    transactions: eth.transactions,
    sources,
  };

  return NextResponse.json(result);
}
