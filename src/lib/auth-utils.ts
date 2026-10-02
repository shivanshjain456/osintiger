// Password + user management helpers — server-side only.
//
// These are the low-level primitives used by:
//   - the credentials `authorize` callback in `src/lib/auth.ts`
//   (removed — Supabase Auth handles signup client-side)
//   - (future) password reset / email verification flows
//
// Everything here goes through Prisma (`@/lib/db`) and bcryptjs. IDs are
// generated with `crypto.randomUUID()` to match the rest of the codebase.

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { recordAudit } from "@/lib/osint/audit";

const BCRYPT_ROUNDS = 12;

// ─── Password hashing ────────────────────────────────────────────────────────

/** Hash a plaintext password with bcrypt (12 rounds). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // Malformed hash / unexpected bcrypt error → treat as verification fail.
    return false;
  }
}

// ─── User management ─────────────────────────────────────────────────────────

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
  image: string;
  hashedPassword: string;
  stripeCustomerId: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

/** Look up a user by email. Returns null if not found. */
export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const user = await db.user.findUnique({ where: { email: normalized } });
  return user as AuthUser | null;
}

/**
 * Create a new user with a hashed password.
 *
 * Throws if the email is already registered — callers should catch and
 * return a 400. On success, records a `user.signup` audit entry.
 */
export async function createUser(
  email: string,
  password: string,
  name?: string
): Promise<AuthUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = (name || "").trim();

  // Race-condition guard: check before insert. The unique index on User.email
  // is the real safety net — if a concurrent insert sneaks in, the Prisma
  // error will bubble up to the caller as a 500 (acceptable; rare).
  const existing = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });
  if (existing) {
    throw new Error("EMAIL_ALREADY_IN_USE");
  }

  const hashedPassword = await hashPassword(password);
  const id = crypto.randomUUID();
  const now = new Date();

  const user = await db.user.create({
    data: {
      id,
      email: normalizedEmail,
      name: trimmedName,
      hashedPassword,
      role: "user",
      // Defaults: stripeCustomerId "", image "", emailVerified null
      createdAt: now,
      updatedAt: now,
    },
  });

  // Audit — fire-and-forget (recordAudit already swallows errors).
  await recordAudit({
    action: "user.signup",
    category: "auth",
    actorType: "user",
    actorId: id,
    resourceType: "user",
    resourceId: id,
    detail: `New user registered: ${normalizedEmail}`,
    metadata: { email: normalizedEmail, name: trimmedName },
    severity: "info",
    outcome: "success",
  });

  return user as AuthUser;
}

/** Stamp `lastLoginAt` on the user. Called after a successful sign-in. */
export async function updateLastLogin(userId: string): Promise<void> {
  if (!userId) return;
  await db.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date(), updatedAt: new Date() },
  });
}
