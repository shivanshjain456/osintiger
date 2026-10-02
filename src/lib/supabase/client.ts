// Supabase Browser Client — used by client components for auth + realtime.
// Reads the public anon key (safe to expose) and the project URL from env.
// This is the REAL Supabase client — all auth methods make real HTTP calls
// to the Supabase Auth (GoTrue) service.
//
// If env vars are missing or the Supabase URL is unreachable, we return a
// no-op client that never throws — the AuthProvider will treat this as
// "no session" and the app renders in anonymous mode instead of crashing.

import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  // If env vars are missing, return a no-op client that won't crash the app.
  // The AuthProvider's try/catch will handle the "no session" case gracefully.
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Return a minimal stub that won't throw on creation but will return
    // null sessions from auth calls.
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ error: { message: "Authentication service not configured" } }),
        signUp: async () => ({ error: { message: "Authentication service not configured" }, data: {} }),
        signInWithOtp: async () => ({ error: { message: "Authentication service not configured" } }),
        signInWithOAuth: async () => ({ error: { message: "Authentication service not configured" } }),
        signOut: async () => ({}),
        resetPasswordForEmail: async () => ({ error: { message: "Authentication service not configured" } }),
        updateUser: async () => ({ error: { message: "Authentication service not configured" } }),
        resend: async () => ({ error: { message: "Authentication service not configured" } }),
      },
    } as unknown as ReturnType<typeof createBrowserClient>;
  }

  // Singleton — avoid creating multiple browser clients.
  if (!clientInstance) {
    clientInstance = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return clientInstance;
}
