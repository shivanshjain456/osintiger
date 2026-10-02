"use client";

import { AppShell } from "@/components/osint/AppShell";
import { AuthProvider } from "@/lib/supabase/auth-context";

export default function Home() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
