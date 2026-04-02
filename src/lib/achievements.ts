import { SupabaseClient } from "@supabase/supabase-js";
import { getNYHour } from "./dateUtils";

export interface AchievementInfo {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category_name: string;
  category_emoji: string;
}

interface RollRecord {
  id: number;
  user_id: string;
  roll_date: string;
  roll_time: string;
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  is_doubles: boolean;
  is_daily_double: boolean;
}

const SPECIAL_COMBOS: Array<{ id: string; redDrink: string; whiteDrink: string }> = [
  { id: "high_abv", redDrink: "Raging Bitch", whiteDrink: "Rumple Minze" },
  { id: "the_freshman", redDrink: "Whiteclaw", whiteDrink: "Espolon" },
  { id: "chicago_charcuterie", redDrink: "High Life", whiteDrink: "Malort" },
  { id: "the_regular", redDrink: "Mickeys", whiteDrink: "Malort" },
];

/**
 * Evaluates all achievements after a roll is saved.
 * Uses the service-role client (bypasses RLS) for writes.
 * Returns achievements newly earned by this roll.
 */
export async function evaluateAchievements(
  adminSupabase: SupabaseClient,
  userId: string,
  roll: RollRecord,
  rollId: number
): Promise<AchievementInfo[]> {
  // Fetch current achievement state for this user
  const { data: existing } = await adminSupabase
    .from("user_achievements")
    .select("achievement_id, progress, progress_detail, completed_at")
    .eq("user_id", userId);

  const completed = new Set(
    (existing || [])
      .filter((ua) => ua.completed_at !== null)
      .map((ua) => ua.achievement_id)
  );

  const newlyCompleted: AchievementInfo[] = [];

  async function fetchAchievementInfo(id: string): Promise<AchievementInfo | null> {
    const { data } = await adminSupabase
      .from("achievements")
      .select("id, name, emoji, description, category_name, category_emoji")
      .eq("id", id)
      .single();
    return data ?? null;
  }

  async function markComplete(achievementId: string) {
    if (completed.has(achievementId)) return;
    await adminSupabase.from("user_achievements").upsert(
      {
        user_id: userId,
        achievement_id: achievementId,
        progress: 1,
        completed_at: new Date().toISOString(),
        earned_on_roll_id: rollId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,achievement_id" }
    );
    const info = await fetchAchievementInfo(achievementId);
    if (info) newlyCompleted.push(info);
  }

  async function updateCounter(
    achievementId: string,
    progress: number,
    target: number,
    progressDetail?: object
  ) {
    if (completed.has(achievementId)) return;
    const isComplete = progress >= target;
    await adminSupabase.from("user_achievements").upsert(
      {
        user_id: userId,
        achievement_id: achievementId,
        progress,
        progress_detail: progressDetail ?? null,
        completed_at: isComplete ? new Date().toISOString() : null,
        earned_on_roll_id: isComplete ? rollId : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,achievement_id" }
    );
    if (isComplete) {
      const info = await fetchAchievementInfo(achievementId);
      if (info) newlyCompleted.push(info);
    }
  }

  // ── YOU'RE A REGULAR ────────────────────────────────────────────────

  // Ring the Gong: first roll ever
  if (!completed.has("ring_gong")) {
    await markComplete("ring_gong");
  }

  // Fifty & Fabulous / Century Club: total roll milestones
  if (!completed.has("fifty_fabulous") || !completed.has("century_club")) {
    const { count: totalRolls } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    if (!completed.has("fifty_fabulous")) {
      await updateCounter("fifty_fabulous", totalRolls ?? 0, 50);
    }
    if (!completed.has("century_club")) {
      await updateCounter("century_club", totalRolls ?? 0, 100);
    }
  }

  // Daily Double Devotee: take the daily double 10 times
  if (!completed.has("daily_double_devotee")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_daily_double", true);
    await updateCounter("daily_double_devotee", count ?? 0, 10);
  }

  // The Contrarian: decline the daily double 10 times
  if (!completed.has("the_contrarian")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_doubles", true)
      .eq("is_daily_double", false);
    await updateCounter("the_contrarian", count ?? 0, 10);
  }

  // Malort Advent Calendar: Roll Malort (white=6) 25 times
  if (!completed.has("malort_advent_calendar")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("white_die_number", 6);
    await updateCounter("malort_advent_calendar", count ?? 0, 25);
  }

  // The Punch Card: Roll each 1–8 on BOTH dice
  if (!completed.has("the_punch_card")) {
    const { data: punchRolls } = await adminSupabase
      .from("rolls")
      .select("red_die_number, white_die_number")
      .eq("user_id", userId);
    const redHit = new Set((punchRolls || []).map((r) => r.red_die_number));
    const whiteHit = new Set((punchRolls || []).map((r) => r.white_die_number));
    await updateCounter(
      "the_punch_card",
      redHit.size + whiteHit.size,
      16,
      { red: Array.from(redHit).sort((a, b) => a - b), white: Array.from(whiteHit).sort((a, b) => a - b) }
    );
  }

  // Double Trouble: All 8 unique doubles
  if (!completed.has("double_trouble")) {
    const { data: doubleRolls } = await adminSupabase
      .from("rolls")
      .select("red_die_number")
      .eq("user_id", userId)
      .eq("is_doubles", true);
    const uniqueDoubles = new Set((doubleRolls || []).map((r) => r.red_die_number));
    await updateCounter(
      "double_trouble",
      uniqueDoubles.size,
      8,
      { numbers: Array.from(uniqueDoubles).sort((a, b) => a - b) }
    );
  }

  // Around the World: All 64 unique combos
  if (!completed.has("around_the_world")) {
    const { data: comboRolls } = await adminSupabase
      .from("rolls")
      .select("red_die_number, white_die_number")
      .eq("user_id", userId);
    const uniqueCombos = new Set(
      (comboRolls || []).map((r) => `${r.red_die_number}-${r.white_die_number}`)
    );
    await updateCounter("around_the_world", uniqueCombos.size, 64, {
      combos: Array.from(uniqueCombos),
    });
  }

  // ── THE CRAPS TABLE ─────────────────────────────────────────────────

  // Feeling Lucky: doubles twice in a row
  if (!completed.has("feeling_lucky")) {
    const { data: recent } = await adminSupabase
      .from("rolls")
      .select("is_doubles")
      .eq("user_id", userId)
      .order("roll_time", { ascending: false })
      .limit(2);
    if (recent && recent.length >= 2 && recent.every((r) => r.is_doubles)) {
      await markComplete("feeling_lucky");
    }
  }

  // On Fire: doubles three times in a row
  if (!completed.has("on_fire")) {
    const { data: recent } = await adminSupabase
      .from("rolls")
      .select("is_doubles")
      .eq("user_id", userId)
      .order("roll_time", { ascending: false })
      .limit(3);
    if (recent && recent.length >= 3 && recent.every((r) => r.is_doubles)) {
      await markComplete("on_fire");
    }
  }

  // Snake Eyes: double 1s
  if (!completed.has("snake_eyes") && roll.is_doubles && roll.red_die_number === 1) {
    await markComplete("snake_eyes");
  }

  // Boxcars: double 8s
  if (!completed.has("boxcars") && roll.is_doubles && roll.red_die_number === 8) {
    await markComplete("boxcars");
  }

  // Hot Dice: 3+ doubles in one night
  if (!completed.has("hot_dice")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date)
      .eq("is_doubles", true);
    if ((count ?? 0) >= 3) {
      await markComplete("hot_dice");
    }
  }

  // Deja Vu: same combo twice in one night
  if (!completed.has("deja_vu")) {
    const { data: nightRolls } = await adminSupabase
      .from("rolls")
      .select("red_die_number, white_die_number")
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date);
    if (nightRolls && nightRolls.length >= 2) {
      const combos = nightRolls.map((r) => `${r.red_die_number}-${r.white_die_number}`);
      if (combos.length > new Set(combos).size) {
        await markComplete("deja_vu");
      }
    }
  }

  // ── SPECIAL COMBINATIONS ─────────────────────────────────────────────
  // Matched by drink name — daily double substitutions won't trigger these
  for (const combo of SPECIAL_COMBOS) {
    if (
      !completed.has(combo.id) &&
      roll.red_drink_name === combo.redDrink &&
      roll.white_drink_name === combo.whiteDrink
    ) {
      await markComplete(combo.id);
    }
  }

  // ── CLOCKING IN ──────────────────────────────────────────────────────

  const nyHour = getNYHour(new Date(roll.roll_time));

  // Day-of-week achievements — use roll_date (already bar-night adjusted)
  const [dow_y, dow_m, dow_d] = roll.roll_date.split("-").map(Number);
  const dow = new Date(dow_y, dow_m - 1, dow_d).getDay(); // 0=Sun…6=Sat

  if (!completed.has("sunday_funday") && dow === 0) {
    await markComplete("sunday_funday");
  }
  if (!completed.has("case_of_the_mondays") && dow === 1) {
    await markComplete("case_of_the_mondays");
  }
  if (!completed.has("taco_tuesday") && dow === 2) {
    await markComplete("taco_tuesday");
  }
  if (!completed.has("hump_day") && dow === 3) {
    await markComplete("hump_day");
  }
  if (!completed.has("trivia_thursday") && dow === 4) {
    await markComplete("trivia_thursday");
  }
  if (!completed.has("friday_night_lights") && dow === 5) {
    await markComplete("friday_night_lights");
  }
  if (!completed.has("saturday_night_fever") && dow === 6) {
    await markComplete("saturday_night_fever");
  }

  if (!completed.has("early_bird") && nyHour === 17) {
    await markComplete("early_bird");
  }

  if (!completed.has("night_owl") && nyHour >= 1 && nyHour <= 3) {
    await markComplete("night_owl");
  }

  // Open to Close: roll between 5–6 PM and 1–2 AM in the same night
  if (!completed.has("open_to_close")) {
    const { data: nightRolls } = await adminSupabase
      .from("rolls")
      .select("roll_time")
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date);
    const hours = (nightRolls || []).map((r) => getNYHour(new Date(r.roll_time)));
    const hasOpener = hours.some((h) => h === 17);
    const hasCloser = hours.some((h) => h === 1);
    if (hasOpener && hasCloser) {
      await markComplete("open_to_close");
    }
  }

  // ── DANGER ZONE ──────────────────────────────────────────────────────

  // Run It Back: 2+ rolls same night
  if (!completed.has("run_it_back")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date);
    if ((count ?? 0) >= 2) {
      await markComplete("run_it_back");
    }
  }

  // Hat Trick: 3+ rolls same night
  if (!completed.has("hat_trick")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date);
    if ((count ?? 0) >= 3) {
      await markComplete("hat_trick");
    }
  }

  // The Legend: 5+ rolls same night
  if (!completed.has("the_legend")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date);
    if ((count ?? 0) >= 5) {
      await markComplete("the_legend");
    }
  }

  // The Quad God: 4+ rolls same night
  if (!completed.has("the_quad_god")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date);
    if ((count ?? 0) >= 4) {
      await markComplete("the_quad_god");
    }
  }

  // Power Hour: 2+ rolls within 60 minutes
  if (!completed.has("power_hour")) {
    const oneHourAgo = new Date(
      new Date(roll.roll_time).getTime() - 60 * 60 * 1000
    ).toISOString();
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("roll_time", oneHourAgo)
      .lte("roll_time", roll.roll_time);
    if ((count ?? 0) >= 2) {
      await markComplete("power_hour");
    }
  }

  // Malort Three-Peat: 3+ Malort rolls in one night
  if (!completed.has("malort_three_peat")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date)
      .eq("white_die_number", 6);
    if ((count ?? 0) >= 3) {
      await markComplete("malort_three_peat");
    }
  }

  // Slow Down: 3+ rolls within 60 minutes
  if (!completed.has("slow_down")) {
    const oneHourAgo = new Date(
      new Date(roll.roll_time).getTime() - 60 * 60 * 1000
    ).toISOString();
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("roll_time", oneHourAgo)
      .lte("roll_time", roll.roll_time);
    if ((count ?? 0) >= 3) {
      await markComplete("slow_down");
    }
  }

  return newlyCompleted;
}
