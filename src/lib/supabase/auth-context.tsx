"use client";

// Supabase Auth Provider — the client-side auth context.
// Wraps the entire app and exposes the current auth state to all components
// via the useAuth() hook. Subscribes to Supabase onAuthStateChange so the
// UI reacts instantly to sign-in, sign-out, token refresh, and email
// verification events.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "./client";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  // Sign in with email + password
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  // Sign up with email + password (sends confirmation email)
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null; needsEmailConfirm: boolean }>;
  // Sign in with magic link (OTP to email)
  signInWithOtp: (email: string) => Promise<{ error: string | null }>;
  // Sign in with OAuth provider (Google, GitHub, etc.)
  signInWithOAuth: (provider: "google" | "github" | "azure") => Promise<{ error: string | null }>;
  // Sign out
  signOut: () => Promise<void>;
  // Send a password reset email
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  // Update the user's password (called from the reset-password page)
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  // Update the user's profile (name, avatar)
  updateProfile: (data: { name?: string; avatarUrl?: string }) => Promise<{ error: string | null }>;
  // Resend the email verification
  resendEmailVerification: (email: string) => Promise<{ error: string | null }>;
  // Refresh the session (force re-fetch)
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    error: null,
  });

  // Initialize: get the current session + subscribe to auth changes.
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setState({
          session,
          user: session?.user ?? null,
          loading: false,
          error: null,
        });
      } catch {
        if (mounted) {
          setState({ session: null, user: null, loading: false, error: "Failed to restore session" });
        }
      }
    }

    init();

    // Subscribe to auth state changes.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setState({
        session,
        user: session?.user ?? null,
        loading: false,
        error: null,
      });
      // Sync the user to the local Prisma DB (best-effort) so the SaaS
      // entitlements system has the current user record.
      // Only sync on meaningful events — skip TOKEN_REFRESHED to avoid
      // unnecessary DB writes every hour.
      if (session?.user && event !== "TOKEN_REFRESHED") {
        fetch("/api/auth/sync", { method: "POST" }).catch(() => {});
      }
      // Invalidate the subscription cache so SaaS-aware components (PlanBadge,
      // FeatureGate, etc.) pick up the new auth state immediately.
      // Dynamic import avoids circular dependency at module load time.
      import("@/lib/saas/use-subscription").then(({ reloadSubscription }) => {
        reloadSubscription();
      }).catch(() => {});
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, [supabase]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name || "" },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) return { error: error.message, needsEmailConfirm: false };
    // If email confirmation is required, the user won't have a session yet.
    const needsEmailConfirm = !data.session && !!data.user;
    return { error: null, needsEmailConfirm };
  }, [supabase]);

  const signInWithOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const signInWithOAuth = useCallback(async (provider: "google" | "github" | "azure") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/reset-password`,
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }, [supabase]);

  const updateProfile = useCallback(async (data: { name?: string; avatarUrl?: string }) => {
    const { error } = await supabase.auth.updateUser({
      data: { name: data.name, avatar_url: data.avatarUrl },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const resendEmailVerification = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setState({
      session,
      user: session?.user ?? null,
      loading: false,
      error: null,
    });
  }, [supabase]);

  const value: AuthContextValue = {
    ...state,
    signInWithPassword,
    signUp,
    signInWithOtp,
    signInWithOAuth,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    resendEmailVerification,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
