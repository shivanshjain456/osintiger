# API Reference

All endpoints are relative to the application root. Responses are JSON.

## API Standards

### Error Response Format
All errors follow a standardized shape:
```json
{
  "error": "Human-readable message",
  "code": "not_found",
  "upgradeTier": "investigator"
}
```

### Error Codes
| Code | HTTP Status | Usage |
|------|-------------|-------|
| `not_found` | 404 | Resource doesn't exist |
| `unauthorized` | 401 | Authentication required |
| `plan_required` | 402 | Subscription tier too low |
| `limit_exceeded` | 402 | Monthly usage limit reached |
| `invalid_request` | 400 | Validation failure |
| `insufficient_credits` | 402 | Not enough AI credits |

### Rate Limiting
- **Investigation endpoints:** 30 requests/minute per IP
- **General API:** 120 requests/minute per IP
- **Response:** 429 with `Retry-After` header

---

## Authentication

### POST /api/auth/sync
Sync the current Supabase Auth user to the local Prisma database.

**Auth:** Required (Supabase session cookie)

**Response:** `{ success: true, userId: string }`

### GET /api/auth/me
Get the current session user + entitlement.

**Response:**
```json
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "user" },
  "subscription": { "tier": "free", "status": "free", "planLimits": {...} }
}
```

---

## Investigations

### POST /api/investigate
Start a standard pipeline investigation.

**Auth:** Optional (anonymous users get free tier limits)

**Body:**
```json
{
  "target": "example.com",
  "input_type": "domain",
  "playbook": "corporate_dd"
}
```

**Response:** `{ investigation_id: string, status: "queued", detection: {...} }`

**Entitlement:** 402 if monthly limit exceeded

### GET /api/investigate/:id
Poll investigation status.

**Response:** Full investigation record with steps, source_results, and report.

### DELETE /api/investigate/:id
Delete an investigation and its provenance events.

### PATCH /api/investigate/:id/metadata
Update starred, tags, notes, bookmarks.

**Auth:** Required

**Body:** `{ starred?: boolean, tags?: string[], notes?: string }`

### POST /api/agent/investigate
Start an autonomous agent investigation.

**Entitlement:** Investigator+ plan, 402 if insufficient

### POST /api/discover
Start a recursive discovery session.

**Entitlement:** Investigator+ plan

### POST /api/plan
Start an AI-planned investigation.

**Entitlement:** Investigator+ plan, 15 AI credits

### POST /api/monitor
Start a live monitoring session.

**Entitlement:** Investigator+ plan

---

## Analysis Endpoints

All analysis endpoints follow the pattern: `GET /api/investigate/:id/<analysis>`

| Endpoint | Returns |
|----------|---------|
| `/api/investigate/:id/confidence` | Confidence breakdown |
| `/api/investigate/:id/contradictions` | Contradiction report |
| `/api/investigate/:id/exec-profile` | Executive intelligence profile |
| `/api/investigate/:id/hierarchy` | Organization hierarchy |
| `/api/investigate/:id/threat` | AI threat assessment |
| `/api/investigate/:id/timeline` | Temporal intelligence |
| `/api/investigate/:id/infrastructure` | Infrastructure evolution |
| `/api/investigate/:id/footprint` | Digital footprint |
| `/api/investigate/:id/attack-surface` | Attack surface map |
| `/api/investigate/:id/certificates` | Certificate intelligence |
| `/api/investigate/:id/tech-fingerprint` | Technology fingerprint |
| `/api/investigate/:id/graph` | Knowledge graph |
| `/api/investigate/:id/resolution` | Entity resolution |
| `/api/investigate/:id/social` | Social media intelligence |
| `/api/investigate/:id/dashboard` | Visual intelligence dashboard |
| `/api/investigate/:id/gaps` | Intelligence gap analysis |
| `/api/investigate/:id/debate` | Multi-agent debate (25 AI credits) |
| `/api/investigate/:id/ask` | Follow-up Q&A (2 AI credits) |

---

## Knowledge Base

### GET /api/kb/stats
Knowledge base statistics (entity/relationship/evidence counts, distributions).

### GET /api/kb/search?q=
Search KB entities by name or alias.

### GET /api/kb/entity/:id
Entity detail with evidence, relationships, conflicts, and version history.

### GET /api/kb/entities
List entities with type filter.

### GET /api/kb/relationships
List relationships with search.

### GET /api/kb/evidence
List evidence with entity/source filters.

### GET /api/kb/conflicts
List conflicts with status filter.

### GET /api/kb/versions
List version history with entity type filter.

### GET /api/kb/graph
Knowledge graph data (nodes + edges) for visualization.

---

## Billing & Subscriptions

### GET /api/billing/plans
List all public subscription plans. **No auth required.**

### GET /api/billing/subscription
Get current subscription + usage + credit balance. **Auth required.**

### GET /api/billing/invoices
List invoices (last 24). **Auth required.**

### GET /api/billing/credits
Get credit balance + last 50 transactions. **Auth required.**

### POST /api/stripe/checkout
Create a Stripe checkout session.

**Body:** `{ tier: string, cycle: "monthly" | "annual" }`

**Response:** `{ url: string }` — redirect to Stripe checkout

### POST /api/stripe/portal
Open the Stripe customer portal.

**Response:** `{ url: string }`

### POST /api/stripe/credit-pack
Purchase a credit pack.

**Body:** `{ packId: string }`

### POST /api/stripe/webhook
Stripe webhook handler (raw body, signature verification).

---

## System Operations

### GET /api/system/status
Overall system health with data counts.

### GET /api/system/health
Detailed per-subsystem health checks.

### GET /api/system/diagnostics
Runtime + environment diagnostics (no secrets exposed).

### GET /api/system/queues
Background job queue status.

### GET /api/system/metrics
Time-series metrics.

### GET /api/audit
Audit log with category/severity filters.

### GET /api/notifications
User notifications with filter.

---

## Tools

### GET /api/sanctions/:name
OFAC SDN fuzzy match for a name.

### POST /api/sanctions/batch
Bulk sanctions screening.

### GET /api/crypto/:wallet
Ethereum wallet analysis.

### POST /api/analyze-image
VLM image analysis (file upload or URL). **10 AI credits.**

### POST /api/entitlements/check
Pre-flight entitlement check.

**Body:** `{ action: string, params?: object }`

---

## Settings

### GET/POST/DELETE /api/llm-config
BYO-LLM provider configuration (OpenAI, Anthropic). **Auth required.**

### GET/POST/DELETE /api/source-keys
Source API key management. **Auth required.**

### GET/POST /api/preferences
User preferences (theme, density, default mode). **Auth required.**

### GET/POST/DELETE /api/api-keys
API key management for programmatic access. **Auth + Professional+ plan required.**

### POST /api/feedback
Submit feedback or bug report.

### GET /api/export/all
Export all investigations as JSON archive.

### GET /api/export/:id
Export a single investigation.

### POST /api/import
Import investigations from JSON archive.

### GET /api/recent
List recent investigations with search/filter. **Lightweight metadata query.**

### GET /api/playbooks
List investigation playbooks.

### GET /api/provenance
List provenance events with filters.

### GET /api/provenance/:investigationId
Provenance events for a specific investigation.

### GET /api/provenance/trace/:evidenceId
Evidence chain trace.

### GET /api/collections
List collections. **Auth required.**

### POST /api/collections
Create a collection. **Auth required.**

### GET/DELETE /api/collections/:id
Get or delete a collection. **Auth required.**
