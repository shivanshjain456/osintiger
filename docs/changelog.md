# Changelog

All notable changes to OSINTiger are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.0.0] — 2025

### Added
- Comprehensive SPA hash router with 67+ routes and deep linking
- SaaS subscription platform with 5 tiers (Free, Investigator, Professional, Team, Enterprise)
- Stripe integration: checkout, webhooks, customer portal, credit packs
- Supabase Auth: email/password, OAuth (Google, GitHub), magic link, password reset
- AI credit system with 10 operation types and transactional consumption
- Feature gating: mode restrictions, export format restrictions, feature flags
- Knowledge Base: 6 Prisma models, entity resolution, version history, conflict detection
- Provenance chain: immutable 10-attribute evidence log
- Multi-agent debate: 7 specialized agents + coordinator synthesis
- Intelligence gap analysis: 16-dimension detection with ranked next actions
- 10 domain-aware investigation playbooks
- Visual intelligence dashboard: 9 visualization types
- Social media intelligence: 12 platform adapters
- Notification system with investigation/billing event triggers
- Audit log with standardized error response contract
- API handler wrapper for standardized error handling on all 114 routes
- 295 automated tests covering critical business logic
- Comprehensive documentation: README, architecture, API reference, setup, deployment, contributing
- Architecture Decision Records (ADRs)
- SEO optimization: JSON-LD structured data, sitemap.xml, robots.txt, OG/Twitter cards
- Viewport meta tag, safe-area insets, touch optimization for mobile
- Environment variable validation module with fail-fast on misconfiguration

### Changed
- Downgraded from Tailwind CSS v4 to v3 (v4 had CSS parsing bug with arbitrary `var()` values)
- Replaced NextAuth with Supabase Auth as the production identity provider
- All 245 Tailwind color class violations replaced with CSS custom property references
- Prisma query logging reduced from every-query to warnings-only
- `/api/recent` optimized with lightweight metadata query (9.7ms vs 50-100ms)
- KB stats queries parallelized from 2+ round-trips to 1
- MatrixRain canvas throttled to 30fps with cached gradient
- Entitlement resolution cached with 15-second TTL
- LLM config save, collection delete, investigation delete made atomic via `$transaction`
- Source key upsert made race-condition-safe

### Removed
- 23 unused dependencies (32% production dependency reduction)
- 6 unused shadcn/ui components
- NextAuth v4 and all related code
- Tailwind CSS v4 directives and `@tailwindcss/postcss`
- All "coming soon" placeholder messages

### Security
- Auth bypass fixed on LLM config, source keys, collections, preferences, metadata routes
- Preferences `clientId` now derived from authenticated session (prevents cross-user access)
- Stripe webhook idempotency for credit pack purchases
- AI credit consumption made transactional (prevents race condition overdraw)
- `safeErrorResponse` prevents CWE-209 in production
- All API routes wrapped with `apiHandler` for standardized error handling
- Rate limiting: 30/min investigate, 120/min general
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- AES-256-GCM encryption for LLM provider keys and source API keys

## [1.0.0] — Initial Release

### Added
- 8-step agentic investigation pipeline (Parse → Route → Query → Normalize → Synthesize → ACH → Attribute → Format)
- 74+ free OSINT source APIs
- 5 investigation modes: Standard, Autonomous Agent, Recursive Discovery, AI Plan, Live Monitoring
- AI-powered report synthesis with strict source attribution
- Analysis of Competing Hypotheses (ACH) matrix
- OFAC/Interpol sanctions screening with fuzzy matching
- Ethereum crypto wallet tracing
- Visual intelligence (VLM) image analysis
- Executive intelligence profiles
- Organization hierarchy extraction
- Digital footprint analysis
- Attack surface mapping
- Certificate intelligence
- Technology fingerprinting
- Temporal intelligence
- Entity resolution
- Contradiction detection
- Confidence engine
- Credibility ranking
- Infrastructure evolution tracking
- Cyberpunk/hacker aesthetic UI
- In-memory + Prisma/SQLite dual-layer investigation store
