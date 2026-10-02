// Server-side session resolution — replaces the NextAuth getSessionUser().
// Reads the Supabase session from cookies, syncs the user to Prisma, and
// returns the local user record. All API routes call this instead of NextAuth.

import { createClient } from "./server";
import { db } from "@/lib/db";
import type { SupabaseUser } from "./types";

export interface SessionUser {
  id: string;        // Supabase UID (also the Prisma User.id)
  email: string;
  name: string;
  role: string;
  image: string;
  emailVerified: boolean;
  supabaseUser: SupabaseUser;
}

/**
 * Get the authenticated user from the Supabase session (server-side).
 * Reads cookies via the Supabase SSR client, validates the JWT, and syncs
 * the user to the local Prisma database.
 *
 * Returns null if no session or if the session is invalid.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    const uid = user.id;

    // Fast path: look up the local Prisma user by the Supabase UID (primary key
    // for Supabase-native users) OR by the supabaseUid field (for legacy users
    // migrated from NextAuth whose primary key is the old NextAuth UUID).
    let localUser = await db.user.findUnique({ where: { id: uid } });
    if (!localUser) {
      // Fall back to supabaseUid lookup for legacy migrated users.
      localUser = await db.user.findFirst({ where: { supabaseUid: uid } });
    }

    // If the local user doesn't exist yet (e.g., first API call after signup
    // before /api/auth/sync ran), create it now.
    if (!localUser) {
      localUser = await syncUserToPrisma(user as unknown as SupabaseUser);
    }

    return {
      id: localUser.id,
      email: localUser.email,
      name: localUser.name,
      role: localUser.role,
      image: localUser.image,
      emailVerified: !!user.email_confirmed_at,
      supabaseUser: user as unknown as SupabaseUser,
    };
  } catch {
    return null;
  }
}

/**
 * Sync a Supabase Auth user to the local Prisma User table.
 * Called on every session resolution (idempotent upsert).
 * If the user doesn't exist locally, creates them with free-tier welcome credits.
 */
export async function syncUserToPrisma(supabaseUser: SupabaseUser) {
  const uid = supabaseUser.id;
  const email = supabaseUser.email;
  const name =
    (supabaseUser.user_metadata?.name as string) ||
    (supabaseUser.user_metadata?.full_name as string) ||
    email.split("@")[0];
  const image = (supabaseUser.user_metadata?.avatar_url as string) || "";

  // Check if the user already exists locally.
  const existing = await db.user.findUnique({ where: { id: uid } });

  if (existing) {
    // Update last login + profile info if changed.
    const updated = await db.user.update({
      where: { id: uid },
      data: {
        supabaseUid: uid,
        name,
        image,
        emailVerified: supabaseUser.email_confirmed_at ? new Date() : existing.emailVerified,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return updated;
  }

  // New user — create the local record. Also check if a user with this email
  // already exists (e.g. from the legacy NextAuth system) and merge if so.
  const existingByEmail = await db.user.findUnique({ where: { email } });
  if (existingByEmail) {
    // Merge: update the existing record to use the Supabase UID.
    // Delete the old record and re-create with the Supabase UID to maintain
    // referential integrity (or just update the id if no relations depend on it).
    // Safest: update the existing record's supabaseUid and keep the old id.
    const updated = await db.user.update({
      where: { id: existingByEmail.id },
      data: {
        supabaseUid: uid,
        name,
        image,
        emailVerified: supabaseUser.email_confirmed_at ? new Date() : existingByEmail.emailVerified,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return updated;
  }

  // Brand new user — create with the Supabase UID as the primary key.
  const newUser = await db.user.create({
    data: {
      id: uid,
      supabaseUid: uid,
      name,
      email,
      image,
      emailVerified: supabaseUser.email_confirmed_at ? new Date() : null,
      lastLoginAt: new Date(),
    },
  });

  // Grant free-tier welcome AI credits (best-effort).
  try {
    const { grantAICredits } = await import("@/lib/saas/entitlements");
    const { getPlanDefinition } = await import("@/lib/saas/plans");
    const freePlan = getPlanDefinition("free");
    if (freePlan && freePlan.limits.aiCreditsPerMonth > 0) {
      await grantAICredits(
        uid,
        freePlan.limits.aiCreditsPerMonth,
        "monthly_grant",
        null,
        "Free tier welcome credits"
      );
    }
  } catch {
    // non-critical
  }

  return newUser;
}
