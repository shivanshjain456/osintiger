# ADR-004: AI Credit System for Usage-Based Billing

## Status
Accepted

## Context
The platform offers AI-powered features (synthesis, VLM, debate, Q&A) that consume expensive computational resources. A pure subscription model (flat monthly fee) doesn't account for varying usage patterns — a power user running 50 multi-agent debates consumes significantly more AI resources than a casual user running 5 standard syntheses.

## Decision
Implement an AI credit system where each AI operation has a fixed cost:
- Synthesis: 5 credits | ACH: 3 | VLM: 10 | Debate: 25 | Plan: 15 | Q&A: 2
- Each subscription tier grants a monthly credit allowance (10 → 50,000)
- Credits can be purchased as add-on packs ($15 → $900)
- Credit consumption is transactional (`db.$transaction` with aggregate + debit)

## Alternatives Considered
1. **Pure subscription (no credits)** — Doesn't account for usage variance; power users are undercharged
2. **Pure pay-per-use** — Friction for new users; unpredictable costs
3. **Token-based metering** — Too granular; hard to explain to users; varies by model

## Consequences
**Benefits:**
- Users understand exactly what each operation costs
- Monthly grants let users try features without purchasing
- Add-on packs provide revenue from heavy users
- Transactional consumption prevents race condition overdraw
- Credits expire with the billing period (monthly reset)

**Tradeoffs:**
- Additional complexity in the entitlements system
- `balanceAfter` field on each transaction (kept consistent via `$transaction`)
- Monthly credit grants need to be triggered on subscription activation
