# ADR-003: Tailwind CSS v3 Instead of v4

## Status
Accepted

## Context
The project initially used Tailwind CSS v4 (`@import "tailwindcss"` with `@tailwindcss/postcss`). However, Tailwind v4's content scanner has a bug where it generates an invalid CSS rule `var(--hack-*)` as a catch-all when it encounters `bg-[var(--hack-green)]` arbitrary value patterns. This caused a CSS parsing error and HTTP 500 on every page load — a critical bug that existed since the first commit.

## Decision
Downgrade to Tailwind CSS v3, which uses the traditional `@tailwind base; @tailwind components; @tailwind utilities;` directives and doesn't have the content scanner bug.

## Alternatives Considered
1. **Tailwind v4 with `@source none`** — Tried but didn't resolve the issue
2. **Tailwind v4 with `@layer utilities` overrides** — Tried but the error occurs before layer processing
3. **Replace all `bg-[var(--hack-*)]` with CSS classes** — Would require 1000+ replacements across 60+ files
4. **Switch to a different CSS framework** — Too much rework for the existing cyberpunk design system

## Consequences
**Benefits:**
- CSS parsing error resolved — app returns HTTP 200
- Stable, well-documented Tailwind v3 ecosystem
- `tailwind.config.ts` provides explicit theme configuration
- All existing utility classes work unchanged

**Tradeoffs:**
- Misses Tailwind v4 features (CSS-first config, native CSS variables in config)
- Need to maintain `tailwind.config.ts` separately from CSS
- `tailwindcss-animate` used instead of v4's native animation support
