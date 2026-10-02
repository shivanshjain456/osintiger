// Auth module — backed by Supabase Auth.
//
// This file re-exports the Supabase-based session helpers so that all
// existing API routes that `import { getSessionUser } from "@/lib/auth"`
// continue to work without modification.
//
// Supabase Auth is the single source of truth for:
//   - User identity (Supabase Auth UID)
//   - Sessions (JWT in cookies, managed by @supabase/ssr)
//   - Credentials (passwords managed by Supabase GoTrue)
//   - Email verification, password reset, OAuth
//
// The local Prisma User table is synced from Supabase on every session
// resolution (see syncUserToPrisma in supabase/session.ts).

export { getSessionUser, syncUserToPrisma, type SessionUser } from "@/lib/supabase/session";

// Re-export the auth utils for backward compatibility.
export { hashPassword, verifyPassword } from "@/lib/auth-utils";
