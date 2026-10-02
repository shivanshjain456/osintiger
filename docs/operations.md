# Operations & Production Deployment Runbook

> Operational guidelines, environment configuration, health probes, and runtime management for OSINTiger.

---

## 1. Runtime Requirements

- **Node.js Runtime**: Node.js 20.x LTS, 21.x, or 22.x
- **Package Manager**: npm 10.x or bun 1.1+
- **Persistence Store**: SQLite 3 (default `data/osintiger.db` or `db/osintiger.db`). For multi-tenant high-throughput production, configure Prisma to PostgreSQL by changing `datasource db` in `prisma/schema.prisma`.
- **System Memory**: Minimum 1 GB RAM (2 GB recommended for high-volume concurrent scans).

---

## 2. Environment Configuration

All environment variables must be defined in `.env.local` or injected via your deployment environment. Refer to `.env.example` for baseline templates.

| Variable Name | Required | Default / Example | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | `file:./db/osintiger.db` | Local SQLite database file path or PostgreSQL connection string |
| `NEXT_PUBLIC_URL` | Yes | `http://localhost:3000` | Canonical public URL used for absolute redirects and webhook callbacks |
| `LLM_ENCRYPTION_KEY` | Yes | 64-character hex string | AES-256-GCM symmetric key used to encrypt user BYO-LLM credentials at rest |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | `http://localhost:54321` | Supabase auth endpoint for user authentication |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | JWT placeholder | Supabase anonymous client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | JWT placeholder | Supabase server-side service role key |
| `STRIPE_SECRET_KEY` | Optional | `sk_test_...` | Stripe secret key for billing and credit purchases |
| `STRIPE_WEBHOOK_SECRET` | Optional | `whsec_...` | Stripe webhook signing secret |
| `ABUSEIPDB_API_KEY` | Optional | Key string | Threat intel API key for AbuseIPDB (free tier) |
| `VIRUSTOTAL_API_KEY` | Optional | Key string | Multi-engine scanner API key (free tier) |
| `ETHERSCAN_API_KEY` | Optional | Key string | Ethereum blockchain explorer key (free tier) |

---

## 3. Production Deployment Guide

### Option A: Standard Node.js Production Host
```bash
# 1. Clone and install
git clone https://github.com/shivanshjain456/osintiger.git
cd osintiger
npm install --production=false

# 2. Setup database
npx prisma generate
npx prisma db push --skip-generate

# 3. Seed baseline plans and demo fixtures
npm run seed:plans
npm run seed:demo

# 4. Build application
npm run build

# 5. Run production server
npm start
```

### Option B: Systemd Service Unit (`/etc/systemd/system/osintiger.service`)
```ini
[Unit]
Description=OSINTiger Intelligence Platform
After=network.target

[Service]
Type=simple
User=osintiger
WorkingDirectory=/var/www/osintiger
EnvironmentFile=/var/www/osintiger/.env.local
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

## 4. Health Checks and Operational Probes

OSINTiger exposes dedicated health and diagnostic endpoints for load balancers and uptime monitoring:

- **Liveness Probe**: `GET /api/health`
  - Returns `200 OK` with `{ status: "ok", timestamp: "..." }`.
  - Confirms the Node.js event loop and HTTP server are responsive.
- **System Diagnostics**: `GET /api/system/diagnostics`
  - Validates database connectivity, active queue workers, and environment variable completeness.
- **System Metrics**: `GET /api/system/metrics`
  - Reports investigation counts, source error rates, and queue latency.

---

## 5. Backup and Maintenance Procedures

- **SQLite Database Backup**: Create an online hot backup using SQLite vacuum command:
  ```bash
  sqlite3 db/osintiger.db ".backup 'db/backups/osintiger-$(date +%F).db'"
  ```
- **Provenance Retention**: By default, raw payload records in `ProvenanceEvent` are retained for 90 days. An automated cleanup worker prunes expired records based on `cacheExpiresAt`.
