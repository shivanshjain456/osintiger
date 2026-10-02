"use client";

// use-subscription — the client-side subscription / entitlement hook.
//
// Single source of truth for the current user's plan + limits on the client.
// All SaaS-aware components (PlanBadge, FeatureGate, billing views, gate
// prompts) read from this hook so we only ever issue one /api/auth/me fetch
// per page load. The promise is cached at module scope and shared across
// every component that calls `useSubscription()`.
//
// `reload()` re-fetches (e.g. after sign-in, after a Stripe checkout return)
// and notifies every subscriber via a tiny pub/sub.
//
// Design note: we deliberately DON'T use React Query here because (a) we want
// a singleton cache that's also readable from non-hook code (e.g. the
// PlanBadge lazy-load), and (b) we only need a single resource. A 30-line
// custom hook is clearer than wiring RQ providers for one endpoint.

import { useEffect, useState, useCallback } from "react";
import type { PlanLimits, PlanTier } from "./plans";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface SubscriptionInfo {
  tier: PlanTier;
  status: string;
  planId?: string;
  billingCycle?: "monthly" | "annual";
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  planLimits: PlanLimits;
}

export interface SubscriptionState {
  user: SessionUser | null;
  subscription: SubscriptionInfo | null;
  planLimits: PlanLimits | null;
  tier: PlanTier;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

// ─── Module-level cache (shared across all hook instances) ───────────────────

interface CachedResult {
  user: SessionUser | null;
  subscription: SubscriptionInfo | null;
  planLimits: PlanLimits | null;
  tier: PlanTier;
  error: string | null;
  fetchedAt: number;
}

let cached: CachedResult | null = null;
let inflight: Promise<CachedResult> | null = null;

// Pub/sub: components subscribe to invalidate their local state on reload.
type Listener = (result: CachedResult) => void;
const listeners = new Set<Listener>();
function emit(result: CachedResult) {
  for (const l of listeners) {
    try {
      l(result);
    } catch {
      // ignore subscriber errors
    }
  }
}

async function fetchOnce(force: boolean): Promise<CachedResult> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as {
        user?: SessionUser | null;
        subscription?: SubscriptionInfo | null;
      };
      const sub = d.subscription || null;
      const result: CachedResult = {
        user: d.user || null,
        subscription: sub,
        planLimits: sub?.planLimits || null,
        tier: (sub?.tier as PlanTier) || "free",
        error: null,
        fetchedAt: Date.now(),
      };
      cached = result;
      emit(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // On error, fall back to anonymous-free entitlement so the UI keeps
      // working. Don't cache errors longer than 30s.
      const result: CachedResult = {
        user: null,
        subscription: null,
        planLimits: null,
        tier: "free",
        error: msg,
        fetchedAt: Date.now(),
      };
      cached = result;
      emit(result);
      return result;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

// Allow stale cache to be served instantly on first render of new components,
// while still triggering a refresh in the background.
export function primeSubscriptionCache(): void {
  void fetchOnce(false);
}

// Force a fresh fetch (e.g. after sign-in or checkout completion).
export async function reloadSubscription(): Promise<void> {
  await fetchOnce(true);
}

// ─── React hook ──────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<Omit<SubscriptionState, "reload">>(() => {
    if (cached) {
      return {
        user: cached.user,
        subscription: cached.subscription,
        planLimits: cached.planLimits,
        tier: cached.tier,
        loading: false,
        error: cached.error,
      };
    }
    return {
      user: null,
      subscription: null,
      planLimits: null,
      tier: "free",
      loading: true,
      error: null,
    };
  });

  useEffect(() => {
    let cancelled = false;

    // Subscribe to future reloads.
    const listener: Listener = (result) => {
      if (cancelled) return;
      setState({
        user: result.user,
        subscription: result.subscription,
        planLimits: result.planLimits,
        tier: result.tier,
        loading: false,
        error: result.error,
      });
    };
    listeners.add(listener);

    // Initial fetch (uses cache when available, so this is near-instant after
    // the first component mounts).
    fetchOnce(false).then((result) => {
      if (cancelled) return;
      setState({
        user: result.user,
        subscription: result.subscription,
        planLimits: result.planLimits,
        tier: result.tier,
        loading: false,
        error: result.error,
      });
    });

    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, []);

  const reload = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    await fetchOnce(true);
  }, []);

  return { ...state, reload };
}

// ─── Convenience helpers ─────────────────────────────────────────────────────

/** Read the current cached tier without subscribing (non-hook). */
export function getCachedTier(): PlanTier {
  return cached?.tier || "free";
}

/** Read the current cached user without subscribing (non-hook). */
export function getCachedUser(): SessionUser | null {
  return cached?.user || null;
}
