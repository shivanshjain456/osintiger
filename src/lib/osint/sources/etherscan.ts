// Etherscan / Blockscout — Ethereum blockchain data.
// Primary: Blockscout public API (free, no key required) — https://eth.blockscout.com/api/v2
// Secondary: Etherscan API (if ETHERSCAN_API_KEY is set) — https://api.etherscan.io/api
// Both return REAL on-chain data. No simulation, no fallback to fake data.

import type { SourceResult, NormalizedFinding, CryptoTransaction, CryptoCounterparty } from "../types";
import { fetchWithTimeout, nowISO, fmtEth } from "./_helpers";

export interface EtherscanOutput {
  balance_eth: number;
  transactions: CryptoTransaction[];
  counterparties: CryptoCounterparty[];
  total_volume_eth: number;
  first_seen: string;
  last_active: string;
  token_transfers: number;
  source_result: SourceResult;
}

export async function queryEtherscan(wallet: string): Promise<EtherscanOutput> {
  const start = Date.now();

  // Strategy 1: Etherscan API (if key present)
  if (process.env.ETHERSCAN_API_KEY) {
    try {
      const result = await queryEtherscanApi(wallet, start);
      if (result) return result;
    } catch (e) {
      console.error("[etherscan] Etherscan API failed:", e instanceof Error ? e.message : String(e));
    }
  }

  // Strategy 2: Blockscout public API (free, no key required)
  try {
    const result = await queryBlockscoutApi(wallet, start);
    if (result) return result;
  } catch (e) {
    console.error("[etherscan] Blockscout API failed:", e instanceof Error ? e.message : String(e));
  }

  // Both APIs failed — return a real error, NOT fake data
  const errorMsg = "Ethereum blockchain APIs are currently unavailable. Both Etherscan and Blockscout returned errors.";
  return {
    balance_eth: 0,
    transactions: [],
    counterparties: [],
    total_volume_eth: 0,
    first_seen: nowISO(),
    last_active: nowISO(),
    token_transfers: 0,
    source_result: {
      source: "etherscan",
      source_label: "Etherscan",
      target: wallet,
      status: "error",
      error: errorMsg,
      latency_ms: Date.now() - start,
      findings: [],
    },
  };
}

// Query Etherscan API v1 (requires key)
async function queryEtherscanApi(wallet: string, start: number): Promise<EtherscanOutput | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const balUrl = `https://api.etherscan.io/api?module=account&action=balance&address=${wallet}&tag=latest&apikey=${apiKey}`;
  const txUrl = `https://api.etherscan.io/api?module=account&action=txlist&address=${wallet}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${apiKey}`;

  const [balRes, txRes] = await Promise.all([
    fetchWithTimeout(balUrl, {}, 10000),
    fetchWithTimeout(txUrl, {}, 12000),
  ]);

  if (!balRes.ok || !txRes.ok) {
    throw new Error(`Etherscan HTTP error: bal=${balRes.status} tx=${txRes.status}`);
  }

  const balJson = await balRes.json();
  const txJson = await txRes.json();

  if (balJson.status === "0" && balJson.message === "NOTOK") {
    throw new Error(`Etherscan API error: ${balJson.result || "unknown"}`);
  }

  const balanceEth = fmtEth(balJson.result || "0");
  const txs: CryptoTransaction[] = (txJson.result || []).slice(0, 50).map(
    (t: Record<string, string>) => ({
      hash: t.hash,
      block: parseInt(t.blockNumber, 10),
      timestamp: new Date(parseInt(t.timeStamp, 10) * 1000).toISOString(),
      from: t.from,
      to: t.to,
      value_eth: fmtEth(t.value || "0"),
      direction: t.to.toLowerCase() === wallet.toLowerCase() ? "in" : "out",
    })
  );

  return buildOutput(wallet, balanceEth, txs, start, "Etherscan (live)");
}

// Query Blockscout public API v2 (free, no key required)
// Docs: https://docs.blockscout.com/devs/apis/rpc/account
async function queryBlockscoutApi(wallet: string, start: number): Promise<EtherscanOutput | null> {
  // 1. Get balance
  const balUrl = `https://eth.blockscout.com/api/v2/addresses/${wallet}`;
  const balRes = await fetchWithTimeout(balUrl, {}, 10000);
  if (!balRes.ok) {
    throw new Error(`Blockscout balance HTTP ${balRes.status}`);
  }
  const balData = await balRes.json();
  const balanceWei = balData?.coin_balance || "0";
  const balanceEth = fmtEth(balanceWei);

  // 2. Get transactions
  const txUrl = `https://eth.blockscout.com/api/v2/addresses/${wallet}/transactions`;
  const txRes = await fetchWithTimeout(txUrl, {}, 12000);
  if (!txRes.ok) {
    throw new Error(`Blockscout txs HTTP ${txRes.status}`);
  }
  const txData = await txRes.json();
  const rawTxs = txData?.items || [];

  const txs: CryptoTransaction[] = rawTxs.slice(0, 50).map((t: {
    hash: string;
    block_number: string | number;
    timestamp: string;
    from: { hash: string };
    to: { hash: string } | null;
    value: string;
    token: { symbol: string } | null;
    tx_types: string[];
  }) => ({
    hash: t.hash,
    block: parseInt(String(t.block_number), 10) || 0,
    timestamp: t.timestamp || nowISO(),
    from: t.from?.hash || "",
    to: t.to?.hash || "",
    value_eth: fmtEth(t.value || "0"),
    token: t.token?.symbol,
    direction: (t.to?.hash || "").toLowerCase() === wallet.toLowerCase() ? "in" : "out",
  }));

  return buildOutput(wallet, balanceEth, txs, start, "Blockscout (live)");
}

function buildOutput(
  wallet: string,
  balanceEth: number,
  txs: CryptoTransaction[],
  start: number,
  sourceLabel: string
): EtherscanOutput {
  const findings: NormalizedFinding[] = [];
  const counterparties = aggregateCounterparties(wallet, txs);
  const totalVol = txs.reduce((s, t) => s + t.value_eth, 0);
  const tokenTransfers = txs.filter((t) => t.token).length;

  findings.push({
    data: `${sourceLabel}: balance ${balanceEth.toFixed(4)} ETH across ${txs.length} recent transactions, ${counterparties.length} counterparties, ${tokenTransfers} ERC-20 token transfers`,
    source_url: `https://etherscan.io/address/${wallet}`,
    confidence: 0.95,
    timestamp: nowISO(),
  });

  if (counterparties[0]) {
    findings.push({
      data: `Top counterparty ${counterparties[0].address.slice(0, 10)}… interacted ${counterparties[0].count} times (${counterparties[0].total_eth.toFixed(3)} ETH)`,
      source_url: `https://etherscan.io/address/${wallet}`,
      confidence: 0.9,
      timestamp: nowISO(),
    });
  }

  return {
    balance_eth: balanceEth,
    transactions: txs,
    counterparties,
    total_volume_eth: totalVol,
    first_seen: txs.length ? txs[txs.length - 1].timestamp : nowISO(),
    last_active: txs.length ? txs[0].timestamp : nowISO(),
    token_transfers: tokenTransfers,
    source_result: {
      source: "etherscan",
      source_label: "Etherscan",
      target: wallet,
      status: "success",
      latency_ms: Date.now() - start,
      findings,
      raw: { balance_eth: balanceEth, tx_count: txs.length, data_source: sourceLabel },
    },
  };
}

function aggregateCounterparties(
  wallet: string,
  txs: CryptoTransaction[]
): CryptoCounterparty[] {
  const map = new Map<string, CryptoCounterparty>();
  const w = wallet.toLowerCase();
  for (const t of txs) {
    const other = t.from.toLowerCase() === w ? t.to : t.from;
    if (!other) continue;
    const dir = t.from.toLowerCase() === w ? "out" : "in";
    const existing = map.get(other.toLowerCase());
    if (existing) {
      existing.count++;
      existing.total_eth += t.value_eth;
      if (existing.direction !== dir) existing.direction = "both";
    } else {
      map.set(other.toLowerCase(), {
        address: other,
        count: 1,
        total_eth: t.value_eth,
        direction: dir,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}
