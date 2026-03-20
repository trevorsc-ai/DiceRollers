import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const handle = request.nextUrl.searchParams.get("handle");

  if (!handle || handle.length < 3) {
    return NextResponse.json({ available: false, reason: "too-short" });
  }
  if (handle.length > 20) {
    return NextResponse.json({ available: false, reason: "too-long" });
  }

  const normalizedHandle = handle.toLowerCase().trim();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .ilike("username", normalizedHandle)
    .maybeSingle();

  return NextResponse.json({ available: data === null });
}
