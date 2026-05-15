import { SupabaseClient } from "@supabase/supabase-js";
import { getNYHour } from "./dateUtils";
import { twinEventKey, type TwinsiesEvent } from "./twinsies";

/** Parse a roll_date string ("YYYY-MM-DD") into components. */
function getNYDate(rollDate: string): { year: number; month: number; day: number; dow: number } {
  const [y, m, d] = rollDate.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun…6=Sat
  return { year: y, month: m, day: d, dow };
}

/** Compute Easter Sunday for a given year using the Anonymous Gregorian algorithm. */
function getEasterDate(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Compute the date of Thanksgiving (4th Thursday of November) for a given year. */
function getThanksgivingDate(year: number): { month: number; day: number } {
  // Find first Thursday of November
  const firstDay = new Date(year, 10, 1).getDay(); // 0=Sun
  const firstThursday = firstDay <= 4 ? 5 - firstDay : 12 - firstDay;
  const day = firstThursday + 21; // + 3 weeks = 4th Thursday
  return { month: 11, day };
}

export interface AchievementInfo {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category_name: string;
  category_emoji: string;
  // Twinsies-only: the partner usernames for the unlocking event
  twinPartners?: string[];
  // Twinsies-only: running total after this event was credited
  twinCount?: number;
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
  { id: "hot_bitch", redDrink: "Raging Bitch", whiteDrink: "Hot Hooch" },
];

function punchCardEmoji(): string {
  return "👊";
}

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
    .select("achievement_id, progress, progress_detail, completed_at, times_completed, cycle_started_at")
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

  // The Punch Card: Roll each 1–8 on BOTH dice (repeatable)
  {
    const punchRow = (existing || []).find((ua) => ua.achievement_id === "the_punch_card");
    const timesCompleted: number = punchRow?.times_completed ?? 0;
    const cycleStartedAt: string | null = punchRow?.cycle_started_at ?? null;

    // Query only rolls from the current cycle (after last completion reset)
    let punchQuery = adminSupabase
      .from("rolls")
      .select("red_die_number, white_die_number")
      .eq("user_id", userId);
    if (cycleStartedAt) {
      punchQuery = punchQuery.gt("roll_time", cycleStartedAt);
    }
    const { data: punchRolls } = await punchQuery;

    const redHit = new Set((punchRolls || []).map((r) => r.red_die_number));
    const whiteHit = new Set((punchRolls || []).map((r) => r.white_die_number));
    const progress = redHit.size + whiteHit.size;

    if (progress >= 16) {
      const newTimesCompleted = timesCompleted + 1;
      const now = new Date().toISOString();
      await Promise.all([
        // Update the main achievement row (resets for next cycle)
        adminSupabase.from("user_achievements").upsert(
          {
            user_id: userId,
            achievement_id: "the_punch_card",
            progress: 0,
            progress_detail: null,
            times_completed: newTimesCompleted,
            cycle_roll_count: 0,
            cycle_started_at: now,
            completed_at: null,
            earned_on_roll_id: rollId,
            updated_at: now,
          },
          { onConflict: "user_id,achievement_id" }
        ),
        // Record this completion in history so the feed can show every earn
        adminSupabase.from("punch_card_completions").insert({
          user_id: userId,
          earned_on_roll_id: rollId,
          completion_number: newTimesCompleted,
          earned_at: now,
          rolls_to_complete: punchRolls!.length,
        }),
      ]);
      const info = await fetchAchievementInfo("the_punch_card");
      if (info) {
        newlyCompleted.push({
          ...info,
          emoji: punchCardEmoji(),
        });
      }
    } else {
      const now = new Date().toISOString();
      await adminSupabase.from("user_achievements").upsert(
        {
          user_id: userId,
          achievement_id: "the_punch_card",
          progress,
          progress_detail: {
            red: Array.from(redHit).sort((a, b) => a - b),
            white: Array.from(whiteHit).sort((a, b) => a - b),
          },
          times_completed: timesCompleted,
          cycle_roll_count: punchRolls!.length,
          // Keep cycle_started_at null during the first cycle so all rolls count.
          // It only gets set when a cycle completes and resets.
          cycle_started_at: cycleStartedAt,
          completed_at: null,
          updated_at: now,
        },
        { onConflict: "user_id,achievement_id" }
      );
    }
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

  // Twinsies: same exact combo as another user on the same night.
  // Repeatable: target=1 so it "completes" on first twin, but progress
  // keeps incrementing on every subsequent twin event. Modal pops every time.
  {
    const eventKey = twinEventKey(roll.roll_date, roll.red_die_number, roll.white_die_number);

    const { data: matchingRolls } = await adminSupabase
      .from("rolls")
      .select("user_id, profiles!inner(username)")
      .eq("roll_date", roll.roll_date)
      .eq("red_die_number", roll.red_die_number)
      .eq("white_die_number", roll.white_die_number)
      .neq("user_id", userId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partnerUsernames = Array.from(
      new Set(
        (matchingRolls || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((r: any) => r.profiles?.username as string | undefined)
          .filter((u): u is string => typeof u === "string")
      )
    ).sort();

    if (partnerUsernames.length > 0) {
      const twinsRow = (existing || []).find((ua) => ua.achievement_id === "twinsies");
      const detail = (twinsRow?.progress_detail ?? {}) as { credited_events?: TwinsiesEvent[] };
      const credited = detail.credited_events ?? [];

      if (!credited.some((e) => e.key === eventKey)) {
        const newEvent: TwinsiesEvent = {
          key: eventKey,
          roll_date: roll.roll_date,
          red: roll.red_die_number,
          white: roll.white_die_number,
          partners: partnerUsernames,
          roll_id: rollId,
        };
        const nextEvents = [...credited, newEvent];
        const nextProgress = nextEvents.length;
        const now = new Date().toISOString();

        if (twinsRow) {
          // Existing row: increment progress + append event. Preserve completed_at
          // and earned_on_roll_id from the first unlock.
          await adminSupabase
            .from("user_achievements")
            .update({
              progress: nextProgress,
              progress_detail: { credited_events: nextEvents },
              completed_at: twinsRow.completed_at ?? now,
              updated_at: now,
            })
            .eq("user_id", userId)
            .eq("achievement_id", "twinsies");
        } else {
          // First-ever twin for this user: insert fresh row.
          await adminSupabase.from("user_achievements").insert({
            user_id: userId,
            achievement_id: "twinsies",
            progress: nextProgress,
            progress_detail: { credited_events: nextEvents },
            completed_at: now,
            earned_on_roll_id: rollId,
            updated_at: now,
          });
        }

        const info = await fetchAchievementInfo("twinsies");
        if (info) {
          newlyCompleted.push({
            ...info,
            twinPartners: partnerUsernames,
            twinCount: nextProgress,
          });
        }
      }
    }
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

  // On Fire: 3+ doubles in one night
  if (!completed.has("on_fire")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date)
      .eq("is_doubles", true);
    if ((count ?? 0) >= 3) {
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

  // Hot Dice: 2+ doubles in one night
  if (!completed.has("hot_dice")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date)
      .eq("is_doubles", true);
    if ((count ?? 0) >= 2) {
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

  // Bender: 3 consecutive bar nights (streak must end on today's roll)
  if (!completed.has("bender")) {
    const { data: recentDates } = await adminSupabase
      .from("rolls")
      .select("roll_date")
      .eq("user_id", userId)
      .order("roll_date", { ascending: false })
      .limit(50);
    const uniqueDates = Array.from(new Set((recentDates || []).map((r) => r.roll_date))).sort();
    if (
      uniqueDates.length >= 3 &&
      uniqueDates[uniqueDates.length - 1] === roll.roll_date
    ) {
      const last3 = uniqueDates.slice(-3);
      const MS_PER_DAY = 86400000;
      const d0 = new Date(last3[0] + "T12:00:00").getTime();
      const d1 = new Date(last3[1] + "T12:00:00").getTime();
      const d2 = new Date(last3[2] + "T12:00:00").getTime();
      if (d1 - d0 === MS_PER_DAY && d2 - d1 === MS_PER_DAY) {
        await markComplete("bender");
      }
    }
  }

  // My New Home: 7 consecutive bar nights (streak must end on today's roll)
  if (!completed.has("my_new_home")) {
    const { data: recentDates } = await adminSupabase
      .from("rolls")
      .select("roll_date")
      .eq("user_id", userId)
      .order("roll_date", { ascending: false })
      .limit(50);
    const uniqueDates = Array.from(new Set((recentDates || []).map((r) => r.roll_date))).sort();
    if (
      uniqueDates.length >= 7 &&
      uniqueDates[uniqueDates.length - 1] === roll.roll_date
    ) {
      const last7 = uniqueDates.slice(-7);
      const MS_PER_DAY = 86400000;
      let consecutive = true;
      for (let i = 1; i < last7.length; i++) {
        if (new Date(last7[i] + "T12:00:00").getTime() - new Date(last7[i - 1] + "T12:00:00").getTime() !== MS_PER_DAY) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) {
        await markComplete("my_new_home");
      }
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

  // Dragon's Breath: Hot Hooch twice in one night
  if (!completed.has("dragons_breath") && roll.white_drink_name === "Hot Hooch") {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date)
      .eq("white_drink_name", "Hot Hooch");
    if ((count ?? 0) >= 2) {
      await markComplete("dragons_breath");
    }
  }

  // Malort Again!: 2+ Malort rolls in one night
  if (!completed.has("malort_three_peat")) {
    const { count } = await adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date)
      .eq("white_die_number", 6);
    if ((count ?? 0) >= 2) {
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

  // ── HOLIDAYS ─────────────────────────────────────────────────────────

  {
    const { year, month, day, dow } = getNYDate(roll.roll_date);

    // Fixed-date holidays
    if (!completed.has("new_years_day") && month === 1 && day === 1) {
      await markComplete("new_years_day");
    }
    if (!completed.has("valentines_day") && month === 2 && day === 14) {
      await markComplete("valentines_day");
    }
    if (!completed.has("leap_day") && month === 2 && day === 29) {
      await markComplete("leap_day");
    }
    if (!completed.has("pi_day") && month === 3 && day === 14) {
      await markComplete("pi_day");
    }
    if (!completed.has("st_patricks_day") && month === 3 && day === 17) {
      await markComplete("st_patricks_day");
    }
    if (!completed.has("april_fools") && month === 4 && day === 1) {
      await markComplete("april_fools");
    }
    if (!completed.has("cinco_de_mayo") && month === 5 && day === 5) {
      await markComplete("cinco_de_mayo");
    }
    if (!completed.has("independence_day") && month === 7 && day === 4) {
      await markComplete("independence_day");
    }
    if (!completed.has("halloween") && month === 10 && day === 31) {
      await markComplete("halloween");
    }
    if (!completed.has("christmas")) {
      const christmasDow = new Date(year, 11, 25).getDay();
      const weekStartDay = 25 - christmasDow;
      if (month === 12 && day >= weekStartDay && day <= weekStartDay + 6) {
        await markComplete("christmas");
      }
    }
    if (!completed.has("new_years_eve") && month === 12 && day === 31) {
      await markComplete("new_years_eve");
    }

    // Friday the 13th
    if (!completed.has("friday_13th") && day === 13 && dow === 5) {
      await markComplete("friday_13th");
    }

    // Easter (variable)
    if (!completed.has("easter")) {
      const easter = getEasterDate(year);
      if (month === easter.month && day === easter.day) {
        await markComplete("easter");
      }
    }

    // Thanksgiving (variable)
    if (!completed.has("thanksgiving")) {
      const tday = getThanksgivingDate(year);
      // Thanksgiving is always Thursday (dow=4); week runs Sun–Sat
      const weekStartDay = tday.day - 4;
      const weekEndDay = tday.day + 2;
      if (month === tday.month && day >= weekStartDay && day <= weekEndDay) {
        await markComplete("thanksgiving");
      }
    }
  }

  return newlyCompleted;
}
