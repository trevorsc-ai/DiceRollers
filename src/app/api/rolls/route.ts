import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getAdjustedRollDate } from "@/lib/dateUtils";
import { evaluateAchievements } from "@/lib/achievements";

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

  // Evaluate achievements using admin client. Errors don't fail the roll
  // save, but we log them so they're visible in server logs.
  let newAchievements: Awaited<ReturnType<typeof evaluateAchievements>> = [];
  try {
    newAchievements = await evaluateAchievements(getAdminClient(), user.id, rollData, rollData.id);
  } catch (err) {
    console.error("evaluateAchievements failed", {
      userId: user.id,
      rollId: rollData.id,
      error: err instanceof Error ? err.message : err,
    });
  }

  // Store new achievement IDs in localStorage hint via response
  return NextResponse.json({
    rollId: rollData.id,
    newAchievements,
  });
}
