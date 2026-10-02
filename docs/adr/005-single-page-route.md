# ADR-005: Single Page Route with Client-Side Hash Router

## Status
Accepted

## Context
The project constraint specifies that only the `/` route can exist as a Next.js page route. All other navigation must be handled client-side. This is a deployment constraint, not an architectural preference.

## Decision
Use a single Next.js page route (`src/app/page.tsx`) that renders the `AppShell` component. The `AppShell` uses the hash-based SPA router to determine which view to render. All 67+ routes are client-side hash routes (e.g., `#/investigations`, `#/billing`, `#/pricing`).

## Alternatives Considered
1. **Multiple Next.js page routes** — Violates the deployment constraint
2. **Server-side rendering with route segments** — Not possible with single-page constraint
3. **React Portal with path-based routing** — Would require server-side route handling

## Consequences
**Benefits:**
- Complies with deployment constraint
- All navigation is client-side (fast, no server round-trips)
- Deep linking works via hash URLs
- Server doesn't need route configuration

**Tradeoffs:**
- No server-side rendering for individual routes
- SEO requires sitemap with hash URLs
- Initial load renders the full app shell (code splitting is client-side only)
