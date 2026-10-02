# Setup Guide

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | >= 20 | Or Bun >= 1.3 |
| OS | Linux/macOS/Windows | WSL2 recommended for Windows |
| Git | Latest | For cloning the repository |
| Supabase | Free tier | Create a project at supabase.com |
| Stripe | Test mode | Create an account at stripe.com |

## Step 1: Clone and Install

```bash
git clone <repository-url>
cd osintiger
bun install
```

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

### Database (Required)
```env
DATABASE_URL=file:./db/custom.db
```
For PostgreSQL: `DATABASE_URL=postgresql://user:password@host:5432/osintiger`

### Supabase (Required)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Go to Settings → API
4. Copy the values:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-service-role-key
```

### Stripe (Required)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy your secret key:
```env
STRIPE_SECRET_KEY=sk_test_your-secret-key
```
3. Go to [Webhooks](https://dashboard.stripe.com/webhooks)
4. Create a webhook endpoint for `https://your-domain.com/api/stripe/webhook`
5. Subscribe to: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.paid`, `invoice.payment_failed`
6. Copy the signing secret:
```env
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

### LLM Encryption Key (Required)
Generate a secure 32-byte key:
```bash
openssl rand -hex 32
```
```env
LLM_ENCRYPTION_KEY=your-generated-key
```

### Application URL (Required)
```env
NEXT_PUBLIC_URL=http://localhost:3000
```

### Optional Source API Keys
```env
ZAI_API_KEY=your-zai-api-key
ABUSEIPDB_API_KEY=your-abuseipdb-key
ETHERSCAN_API_KEY=your-etherscan-key
VIRUSTOTAL_API_KEY=your-virustotal-key
```

## Step 3: Database Setup

```bash
# Push the Prisma schema to your database
bun run db:push

# Seed subscription plans (5 tiers: free, investigator, professional, team, enterprise)
bun run seed:plans
```

## Step 4: Start Development Server

```bash
bun run dev
```

The application will be available at `http://localhost:3000`.

## Step 5: Verify Installation

1. Open `http://localhost:3000` — should show the OSINTiger command center
2. Click "SIGN IN" in the header — should show the login page
3. Navigate to `#/pricing` — should show 5 subscription tiers
4. Navigate to `#/system/status` — should show "healthy" status

## Testing

```bash
# Run all tests (295 tests, ~12s)
bun run test

# Run tests with coverage
bun run test:coverage

# Run tests in watch mode
bun run test:watch

# Run lint
bun run lint
```

## Troubleshooting

### "Cannot find module" errors
```bash
rm -rf node_modules .next
bun install
bun run dev
```

### Database errors
```bash
bun run db:push --accept-data-loss
bun run seed:plans
```

### Supabase connection errors
- Verify `NEXT_PUBLIC_SUPABASE_URL` starts with `https://`
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is at least 20 characters
- Check that your Supabase project is not paused

### Stripe webhook errors
- For local development, use `stripe listen --forward-to localhost:3000/api/stripe/webhook`
- Verify `STRIPE_WEBHOOK_SECRET` starts with `whsec_`

### CSS styling issues
- The project uses Tailwind CSS v3 (not v4)
- If you see CSS parsing errors, ensure `@tailwindcss/postcss` is NOT installed
- Run `rm -rf .next && bun run dev` to clear the cache
