# OSINTiger — Architecture Documentation

## Overview

OSINTiger is a production-grade AI-powered OSINT (Open Source Intelligence) platform built on
Next.js 16 with App Router. It collects, verifies, correlates, and presents publicly available
intelligence with transparent sourcing, clear confidence levels, and a strict evidence-first
methodology.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma ORM + SQLite |
| AI | z-ai-web-dev-sdk (LLM + VLM + web_search) |
| Icons | Lucide React |
| State | React hooks + polling (no external state lib) |

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes (server-side)
│   │   ├── investigate/          # POST initiate, GET poll, POST ask
│   │   ├── export/               # GET export (csv/json/txt/md)
│   │   ├── recent/               # GET recent investigations
│   │   ├── crypto/               # GET wallet analysis
│   │   ├── sanctions/            # GET/BATCH sanctions screening
│   │   ├── analyze-image/        # POST VLM image analysis
│   │   ├── analytics/            # GET stats + version analytics
│   │   └── health/               # GET health check
│   ├── error.tsx                 # Error boundary
│   ├── loading.tsx               # Loading boundary
│   ├── layout.tsx                # Root layout (dark mode, fonts)
│   └── page.tsx                  # Single visible route (/)
├── components/
│   ├── osint/                    # OSINT-specific components
│   │   ├── HomeView.tsx          # Hero search + source grid
│   │   ├── ProgressView.tsx      # Live pipeline progress
│   │   ├── ReportView.tsx        # 10-tab intelligence report
│   │   ├── LinkGraphPanel.tsx    # SVG entity relationship graph
│   │   ├── AskAIPanel.tsx        # Follow-up Q&A UI
│   │   ├── IntelligenceSections.tsx # BLUF/5W1H/Timeline/Risk/Gaps
│   │   ├── ACHMatrix.tsx         # Competing hypotheses matrix
│   │   ├── IntelMap.tsx          # SVG world map with geo points
│   │   ├── ConfidenceMeter.tsx   # Confidence ring + bar
│   │   ├── AttributionTag.tsx    # [SOURCE] tag renderer
│   │   └── ...                   # 20+ other components
│   └── ui/                       # shadcn/ui primitives
├── lib/
│   └── osint/
│       ├── types.ts              # Full domain model (11 input types, 15+ report sections)
│       ├── detector.ts           # Universal target detection (regex + heuristics + scoring)
│       ├── router.ts             # Source routing matrix (74 sources, 11 input types)
│       ├── pipeline.ts           # 8-step orchestrator (parse→route→query→normalize→synthesize→ach→attribute→format)
│       ├── ai-client.ts          # AI synthesis + ACH + crypto risk + VLM + ask-AI
│       ├── normalizer.ts         # Finding dedup + geopoint extraction
│       ├── attribution.ts        # [SOURCE] tag validation
│       ├── ach.ts                # ACH matrix builder
│       ├── store.ts              # Dual-layer cache (in-memory + Prisma)
│       └── sources/
│           ├── _helpers.ts       # Shared utilities
│           ├── web-search.ts     # z-ai-web-dev-sdk web_search
│           ├── crtsh.ts          # Certificate Transparency
│           ├── ipinfo.ts         # IP geolocation
│           ├── edgar.ts          # SEC EDGAR
│           ├── fec.ts            # FEC donations
│           ├── icij.ts           # ICIJ Offshore Leaks
│           ├── opencorporates.ts # Corporate registry
│           ├── ofac.ts           # OFAC SDN screening
│           ├── etherscan.ts      # Ethereum wallet (Blockscout)
│           ├── threat-intel.ts   # Shodan-style
│           └── extended/
│               ├── _shared.ts              # Rate limiter + helpers
│               ├── index.ts                # Round 1 sources (20)
│               ├── additional-sources.ts   # Round 2 sources (11)
│               ├── expanded-sources.ts     # Round 3 sources (22)
│               └── universal-sources.ts    # Round 4 sources (11)
├── middleware.ts                 # Rate limiting + security headers + body size
└── prisma/
    └── schema.prisma             # Investigation model
```

## Architecture Decisions

### 1. Single-Route Design
Only `/` is user-visible. All views (home, progress, report) are rendered conditionally
based on application state, not URL routing. This simplifies the UX and prevents deep-link
sharing of sensitive investigation data.

### 2. Fire-and-Forget Pipeline
The 8-step pipeline runs asynchronously via `runPipeline(id, detection).catch(...)`.
The frontend polls `/api/investigate/[id]` for live status updates. This decouples
long-running collection from the request cycle.

### 3. Dual-Layer Caching
- **In-memory Map**: Instant reads for active investigations (sub-ms).
- **Prisma/SQLite**: Persistence across server restarts, searchable history.
- **2s stale threshold**: If a cached record is in_progress and older than 2s,
  the DB is checked for updates (handles dev-mode hot reloads).

### 4. Source Routing Matrix
Each input type maps to a prioritized list of sources. The router deduplicates
and returns a flat array. Sources are queried in parallel via `Promise.allSettled`
with per-source timeouts (14s).

### 5. Evidence-First AI
The AI synthesis prompt enforces:
- Every claim MUST end with `[SOURCE: label, URL: url]`
- Only provided data may be used (no outside knowledge)
- Contradictions must be explicitly noted
- Insufficient data → "Insufficient data." (never fabricated)

### 6. Zero Hallucination Policy
If evidence is insufficient for any report section, the AI outputs
"No verified evidence found." The Ask AI feature refuses to answer
questions that cannot be answered from collected evidence.

## Data Flow

```
User Input
    │
    ▼
[1] detectInput() ──► DetectionResult (type, script, language, region, confidence)
    │
    ▼
[2] routeSources() ──► SourceKey[] (e.g., ["crtsh", "doh", "ipinfo", ...])
    │
    ▼
[3] Promise.allSettled(runSource(key) for each key) ──► SourceResult[]
    │                    └─► rateLimitedFetch() → parse → normalize findings
    │
    ▼
[4] normalizeSourceResults() ──► NormalizedBundle (findings, geopoints, sources)
    │
    ▼
[5] synthesizeReport() ──► AISynthesisRaw (BLUF, 5W1H, timeline, findings, risks, graph, ...)
    │                    └─► z-ai-web-dev-sdk chat.completions.create() × 3 retries
    │
    ▼
[6] synthesizeACH() + buildAch() ──► ACHAnalysis (hypotheses, evidence, matrix)
    │
    ▼
[7] markAttribution() ──► ReportData (attribution_valid, needs_manual_review)
    │
    ▼
[8] updateRecord(status="completed", report) ──► Persisted to cache + DB
```

## Security

- **Rate limiting**: 30 req/min for investigate, 120 req/min general (per-IP, in-memory)
- **Security headers**: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.
- **Body size limit**: 10MB max
- **SSRF protection**: Private IP blocking on image analysis
- **XSS prevention**: React escaping + CSP + PDF export sanitization
- **Input validation**: All inputs sanitized (max 256 chars, HTML stripped)
- **SQL injection**: Prisma parameterized queries throughout

## Performance

- **Parallel source queries**: All sources run concurrently with 14s timeout each
- **Per-source rate limiting**: Prevents API abuse (configurable interval)
- **Finding dedup**: Prevents redundant data in AI prompt
- **Finding cap**: 6 findings per source max (keeps AI prompt tractable)
- **Adaptive polling**: 500ms early, 1500ms later (reduces unnecessary requests)
- **Prisma select optimization**: /api/recent skips heavy JSON columns

## Extensibility

### Adding a New Source
1. Create a function in `src/lib/osint/sources/extended/` that returns `SourceResult`
2. Add the source key to `SourceKey` in `router.ts`
3. Add routing entries in the `ROUTING` matrix
4. Add labels and URLs in `SOURCE_LABELS` and `SOURCE_URLS`
5. Add a case in `runSource()` in `pipeline.ts`

### Adding a New Input Type
1. Add the type to `InputType` in `types.ts`
2. Add detection regex + scoring in `detector.ts`
3. Add a routing function in `ROUTING` in `router.ts`
4. Add the option to the type dropdown in `HomeView.tsx`

### Adding a New Report Section
1. Add the interface to `types.ts` and the field to `ReportData`
2. Add the section to the AI synthesis prompt in `ai-client.ts`
3. Add the field to `AISynthesisRaw` interface
4. Map it in `pipeline.ts` baseReport construction
5. Create a UI component and add a tab in `ReportView.tsx`
