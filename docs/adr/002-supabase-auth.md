# ADR-002: Supabase Auth Instead of NextAuth

## Status
Accepted

## Context
The application initially used NextAuth v4 with credentials provider and JWT sessions. As the platform evolved into a SaaS product, the auth requirements grew to include OAuth (Google, GitHub), magic link, email verification, and password reset — all of which NextAuth requires significant custom configuration for.

## Decision
Replace NextAuth with Supabase Auth (GoTrue) as the production identity provider. Supabase provides a managed auth service with built-in OAuth, magic link, email verification, and password reset — all with minimal configuration.

## Alternatives Considered
1. **NextAuth v4** — Required custom OAuth provider configuration, no built-in email verification, no magic link
2. **Clerk** — Commercial auth provider, but adds cost and vendor lock-in
3. **Auth0** — Enterprise auth provider, but expensive at scale and complex to configure
4. **Custom auth** — Too much engineering effort for standard auth flows

## Consequences
**Benefits:**
- Built-in OAuth (Google, GitHub), magic link, email verification, password reset
- Managed service — no auth infrastructure to maintain
- Row-Level Security (RLS) available if needed
- Generous free tier (50,000 monthly active users)
- `@supabase/ssr` handles cookie-based sessions seamlessly

**Tradeoffs:**
- External dependency on Supabase service availability
- User data stored in Supabase Auth (synced to local Prisma DB via `syncUserToPrisma`)
- Graceful degradation needed when Supabase is unreachable (no-op client fallback)
