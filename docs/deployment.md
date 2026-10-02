# Deployment Guide

## Infrastructure Overview

```
Users → CDN/Proxy → Next.js Server → Database
                          ↓
              External Services (Supabase, Stripe, OSINT APIs)
```

## Production Environment Variables

All variables in `.env.example` must be set with production values:

| Variable | Production Value |
|----------|-----------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/osintiger` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role key |
| `STRIPE_SECRET_KEY` | `sk_live_...` (live key) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (production webhook) |
| `NEXT_PUBLIC_URL` | `https://your-domain.com` |
| `LLM_ENCRYPTION_KEY` | 32-byte secure key (NOT the default) |
| `ZAI_API_KEY` | Production ZAI key |

**Critical:** The config validation module (`src/lib/config.ts`) will detect placeholder values in production and report them via `/api/system/diagnostics`.

## Deployment Process

### 1. Pre-deployment
```bash
# Run tests
bun run test

# Run lint
bun run lint

# Type check
npx tsc --noEmit
```

### 2. Build
```bash
bun run build
```

### 3. Database Migration
```bash
# Push schema (safe — additive changes only)
bun run db:push

# Seed subscription plans
bun run seed:plans
```

### 4. Deploy
```bash
# Start production server
bun run start
```

### 5. Post-deployment Verification
```bash
# Check system health
curl https://your-domain.com/api/system/status

# Check diagnostics
curl https://your-domain.com/api/system/diagnostics

# Verify plans are seeded
curl https://your-domain.com/api/billing/plans
```

## Stripe Webhook Configuration

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-domain.com/api/stripe/webhook`
3. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`

## Rollback Procedure

### Application Rollback
1. Deploy the previous version
2. Verify health: `curl https://your-domain.com/api/system/status`

### Database Rollback
- The application uses `prisma db push` (not migrations) — schema changes are additive
- If a schema change causes issues, revert the code and run `bun run db:push` again
- SQLite: the database file can be backed up by copying `db/custom.db`

## Monitoring

### Health Endpoints
- `GET /api/system/status` — overall health + data counts
- `GET /api/system/health` — per-subsystem checks
- `GET /api/system/diagnostics` — runtime + config status

### Logs
- Application logs: `dev.log` (development) or stdout (production)
- Error logs: `console.error` calls throughout the codebase
- Audit logs: `AuditLog` table (queryable via `/api/audit`)

### Key Metrics to Monitor
- Investigation completion rate
- AI credit consumption
- API response times
- Database query latency
- Stripe webhook processing
- Supabase auth success rate

## Incident Response

### Application Crash
1. Check `/api/system/status` — is the server responding?
2. Check `dev.log` / stdout for error messages
3. Check database connectivity
4. Restart the application: `bun run start`

### Database Failure
1. Check `DATABASE_URL` is correct
2. Verify database server is running
3. Check connection limits
4. For SQLite: verify file permissions on `db/custom.db`

### Payment Failure
1. Check Stripe dashboard for webhook delivery failures
2. Verify `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are correct
3. Check `/api/system/diagnostics` for config status
4. Stripe webhooks are idempotent — safe to retry

### Security Incident
1. Check `/api/audit` for suspicious activity
2. Rotate compromised credentials immediately
3. Check auth-protected endpoints are returning 401 for unauthenticated requests
4. Review the security headers in middleware responses
