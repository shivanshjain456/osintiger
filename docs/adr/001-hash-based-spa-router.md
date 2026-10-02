# ADR-001: Hash-Based SPA Router Instead of Next.js File-Based Routing

## Status
Accepted

## Context
OSINTiger has 67+ routes across 12 functional groups. The application needs deep-linkable, bookmarkable URLs with back/forward button support. Next.js App Router uses file-based routing where each route is a separate file, but the project constraint requires a single page route (`/`).

## Decision
Use a custom hash-based SPA router (`src/lib/router/`) that parses `window.location.hash` into typed Route objects. All navigation goes through the router so every screen is deep-linkable.

## Alternatives Considered
1. **Next.js file-based routing** — Rejected due to single-page-route constraint
2. **React Router** — Rejected to avoid additional dependency; custom router is ~500 lines and covers all needs
3. **URL path-based routing with catch-all** — Considered but hash-based is simpler for a client-side-only app without server-side route handling

## Consequences
**Benefits:**
- Deep linking works without server configuration
- Back/forward buttons work naturally
- No server-side route handling needed
- All routes are typed via discriminated union

**Tradeoffs:**
- URLs have `#/` prefix (less clean than path-based)
- SEO requires sitemap with hash URLs
- Server doesn't know the current route (all client-side)
