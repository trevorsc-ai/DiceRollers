import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

// Service role bypasses RLS — sees all profiles regardless of auth state
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get("handle");

  if (!handle || handle.length < 3) {
    return NextResponse.json({ available: false, reason: "too-short" });
  }
  if (handle.length > 20) {
    return NextResponse.json({ available: false, reason: "too-long" });
  }

  const normalizedHandle = handle.toLowerCase().trim();

  // Determine the calling user's ID so we can exclude their own handle
  // (relevant when a logged-in user re-checks their current handle)
  let currentUserId: string | null = null;
  try {
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();
    currentUserId = user?.id ?? null;
  } catch {
    // unauthenticated (signup flow) — no exclusion needed
  }

  const adminSupabase = createAdminClient();
  let query = adminSupabase
    .from("profiles")
    .select("id")
    .ilike("username", normalizedHandle);

  if (currentUserId) {
    query = query.neq("id", currentUserId);
  }

  const { data } = await query.maybeSingle();

  return NextResponse.json({ available: data === null });
}
