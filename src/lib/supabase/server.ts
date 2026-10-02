// Supabase Server Client — used by API routes and server components.
// Reads cookies from the request to restore the user's session, and writes
// cookies back on session refresh. Uses the anon key (not service role) so
// Row-Level-Security policies still apply.
//
// If env vars are missing, returns a no-op client so the app doesn't crash —
// getSessionUser() will return null (anonymous mode) instead of throwing.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function createClient() {
  const cookieStore = await cookies();

  // If env vars are missing, return a no-op client.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      auth: {
        getUser: async () => ({ data: { user: null }, error: { message: "Not configured" } }),
        getSession: async () => ({ data: { session: null }, error: null }),
        signOut: async () => ({}),
      },
    } as unknown as ReturnType<typeof createServerClient<Database>>;
  }

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  });
}

// Service-role client — bypasses RLS. Use ONLY for trusted admin operations
// (never expose to the client). e.g. deleting a user, listing all users.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceClient() {
  return createSupabaseClient<Database>(
    SUPABASE_URL || "http://localhost:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
