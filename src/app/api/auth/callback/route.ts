// GET /api/auth/callback — handles Supabase Auth redirects.
// Supabase redirects here after email confirmation, password reset, and OAuth.
// We exchange the code for a session (if present) and redirect to the app.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  // OAuth/email errors
  if (error) {
    const msg = encodeURIComponent(errorDescription || error);
    return NextResponse.redirect(`${url.origin}/#/login?error=${msg}`);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        const msg = encodeURIComponent(exchangeError.message);
        return NextResponse.redirect(`${url.origin}/#/login?error=${msg}`);
      }
      // Success — redirect to the appropriate page based on the flow type.
      if (type === "recovery") {
        return NextResponse.redirect(`${url.origin}/#/reset-password?status=verified`);
      }
      // Default: redirect to billing (or home if already had a destination).
      const next = url.searchParams.get("next") || "/#/billing?status=verified";
      return NextResponse.redirect(`${url.origin}${next}`);
    } catch (e) {
      const msg = encodeURIComponent(e instanceof Error ? e.message : "Auth callback failed");
      return NextResponse.redirect(`${url.origin}/#/login?error=${msg}`);
    }
  }

  // No code — redirect home.
  return NextResponse.redirect(`${url.origin}/`);
}
