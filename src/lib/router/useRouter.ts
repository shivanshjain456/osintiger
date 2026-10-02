"use client";

// React bindings for the SPA router. Components use `useRoute()` to read the
// current route and the navigation helpers to move between views.
//
// We use a useState + useEffect subscription pattern (rather than
// useSyncExternalStore) because the latter requires getSnapshot to return a
// cached stable reference, which is fragile across HMR reloads. The
// subscription pattern is simpler and equally correct for a client-side
// hash router.

import { useState, useEffect, useCallback } from "react";
import {
  subscribe,
  parseRoute,
  navigate as routerNavigate,
  replace as routerReplace,
  back as routerBack,
  hrefFor,
  titleFor,
} from "./router";
import type { Route } from "./types";

// The server-side initial route. The client MUST use the same initial value
// to avoid hydration mismatches — the real route is read from the URL hash
// in a useEffect after hydration completes.
const SSR_INITIAL: Route = { name: "home" };

/** Read the current route. Re-renders on navigation. */
export function useRoute(): Route {
  // Always initialize with SSR_INITIAL so the first client render matches
  // the server render. The real route (from window.location.hash) is applied
  // in the useEffect below, which runs after hydration.
  const [route, setRoute] = useState<Route>(SSR_INITIAL);

  useEffect(() => {
    // Subscribe first — this calls ensureInit() which computes the real
    // initial route from the URL hash.
    const unsub = subscribe((r) => setRoute(r));
    // Now sync the state with the post-init route (may differ from SSR_INITIAL).
    // Deferred to avoid synchronous setState-in-effect.
    queueMicrotask(() => setRoute(parseRoute()));
    return unsub;
  }, []);

  return route;
}

export function useNavigate() {
  return useCallback((route: Route) => routerNavigate(route), []);
}

export function useReplace() {
  return useCallback((route: Route) => routerReplace(route), []);
}

export function useBack() {
  return useCallback(() => routerBack(), []);
}

/** Build a hash href for an <a> tag. */
export function useHref(route: Route): string {
  return hrefFor(route);
}

/** Update document.title whenever the route changes. Call once at the root. */
export function useRouteTitle() {
  const route = useRoute();
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = titleFor(route);
    }
  }, [route]);
}
