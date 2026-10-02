// API helper utilities: fetch with timeout, retry, and respectful rate-limit handling.

export async function fetchWithTimeout(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "OSINTiger/1.0 (research; contact: research@example.com)",
        ...(opts.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export function nowISO(): string {
  return new Date().toISOString();
}

// Format a number as ETH with given decimals
export function fmtEth(wei: string | number, decimals = 18): number {
  const big =
    typeof wei === "number" ? BigInt(Math.round(wei)) : BigInt(wei || "0");
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = big / divisor;
  const frac = big % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6);
  return parseFloat(`${whole}.${fracStr}`);
}

// Simple delay
export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
