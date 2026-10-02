// POST /api/auth/sync — sync the current Supabase Auth user to the local Prisma DB.
// Called by the client AuthProvider on every auth state change. Does a full
// upsert (updates lastLoginAt, name, avatar, emailVerified) to keep the local
// record fresh. This is separate from getSessionUser() which does a fast
// findUnique lookup on every API request.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserToPrisma } from "@/lib/supabase/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ success: false, error: "No session" }, { status: 401 });
    }

    // Full sync: upserts the user record with current profile info + lastLoginAt.
    await syncUserToPrisma(user as never);

    return NextResponse.json({ success: true, userId: user.id });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}
