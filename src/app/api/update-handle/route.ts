import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  // Authenticate the caller
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { handle } = body as { handle: string };
  if (!handle || typeof handle !== "string") {
    return NextResponse.json({ error: "Invalid handle" }, { status: 400 });
  }

  const normalized = handle.toLowerCase().trim();
  if (normalized.length < 3 || normalized.length > 20) {
    return NextResponse.json({ error: "Handle must be 3–20 characters" }, { status: 400 });
  }

  const adminSupabase = createAdminClient();

  // Fetch current username for rollback if needed
  const { data: currentProfile } = await adminSupabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!currentProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // No-op if handle hasn't changed
  if (currentProfile.username === normalized) {
    return NextResponse.json({ success: true, username: normalized });
  }

  // Check availability — exclude self, use service role so all profiles are visible
  const { data: conflict } = await adminSupabase
    .from("profiles")
    .select("id")
    .ilike("username", normalized)
    .neq("id", user.id)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json({ error: "handle-taken" }, { status: 409 });
  }

  // Update profile username
  const { error: profileError } = await adminSupabase
    .from("profiles")
    .update({ username: normalized })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: "update-failed" }, { status: 500 });
  }

  // Update auth email using admin API — bypasses Supabase's email confirmation flow
  // so the synthetic email change takes effect immediately with no pending state.
  const { error: authError } = await adminSupabase.auth.admin.updateUserById(
    user.id,
    { email: `${normalized}@dicerollers.local` }
  );

  if (authError) {
    // Roll back the profile change
    await adminSupabase
      .from("profiles")
      .update({ username: currentProfile.username })
      .eq("id", user.id);
    return NextResponse.json({ error: "update-failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true, username: normalized });
}
