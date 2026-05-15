import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getAdjustedRollDate } from "@/lib/dateUtils";
import { evaluateAchievements } from "@/lib/achievements";

// Admin client for achievement writes (bypasses RLS)
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  // Authenticate via session
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    redDieNumber,
    whiteDieNumber,
    redDrinkName,
    whiteDrinkName,
    redDrinkLogo,
    whiteDrinkLogo,
    dailyDouble,
  } = body as {
    redDieNumber: number;
    whiteDieNumber: number;
    redDrinkName: string;
    whiteDrinkName: string;
    redDrinkLogo: string | null;
    whiteDrinkLogo: string | null;
    dailyDouble: boolean;
  };

  const now = new Date();
  const rollTime = now.toISOString();
  const rollDate = getAdjustedRollDate(now);

  // Insert the roll
  const { data: rollData, error: rollError } = await supabase
    .from("rolls")
    .insert({
      user_id: user.id,
      roll_date: rollDate,
      roll_time: rollTime,
      red_die_number: redDieNumber,
      white_die_number: whiteDieNumber,
      red_drink_name: redDrinkName,
      white_drink_name: whiteDrinkName,
      red_drink_logo: redDrinkLogo ?? null,
      white_drink_logo: whiteDrinkLogo ?? null,
      is_daily_double: (redDieNumber === 6 && whiteDieNumber === 6) ? false : (dailyDouble ?? false),
    })
    .select()
    .single();

  if (rollError || !rollData) {
    return NextResponse.json({ error: rollError?.message ?? "Insert failed" }, { status: 500 });
  }

  // Evaluate achievements using admin client
  const adminSupabase = createAdminClient();
  let newAchievements: Awaited<ReturnType<typeof evaluateAchievements>> = [];
  try {
    newAchievements = await evaluateAchievements(adminSupabase, user.id, rollData, rollData.id);
  } catch {
    // Achievement evaluation errors shouldn't fail the roll save
  }

  // Store new achievement IDs in localStorage hint via response
  return NextResponse.json({
    rollId: rollData.id,
    newAchievements,
  });
}
