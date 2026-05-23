import { SupabaseClient } from "@supabase/supabase-js";
import { getNYHour } from "./dateUtils";
import { twinEventKey, type TwinsiesEvent } from "./twinsies";
import { ACHIEVEMENT_IDS, DOW_ACHIEVEMENTS, type AchievementId } from "./achievementIds";

const A = ACHIEVEMENT_IDS;

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

interface TonightRoll {
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  is_doubles: boolean;
  roll_time: string;
}

interface ExistingRow {
  achievement_id: string;
  progress: number;
  progress_detail: unknown;
  completed_at: string | null;
  times_completed: number | null;
  cycle_started_at: string | null;
}

const SPECIAL_COMBOS: Array<{ id: AchievementId; redDrink: string; whiteDrink: string }> = [
  { id: A.HIGH_ABV,             redDrink: "Raging Bitch", whiteDrink: "Rumple Minze" },
  { id: A.THE_FRESHMAN,         redDrink: "Whiteclaw",    whiteDrink: "Espolon" },
  { id: A.CHICAGO_CHARCUTERIE,  redDrink: "High Life",    whiteDrink: "Malort" },
  { id: A.THE_REGULAR,          redDrink: "Mickeys",      whiteDrink: "Malort" },
  { id: A.HOT_BITCH,            redDrink: "Raging Bitch", whiteDrink: "Hot Hooch" },
  { id: A.COMMON_MAN,           redDrink: "High Life",    whiteDrink: "Jim Beam" },
];

const PUNCH_CARD_EMOJI = "👊";
const MS_PER_DAY = 86_400_000;

/**
 * Evaluates all achievements after a roll is saved.
 *
 * Uses the service-role client (bypasses RLS) for writes. Returns the
 * achievements newly earned by this roll.
 *
 * Performance notes:
 * - All "tonight's rolls" data is fetched in ONE query and reused across
 *   the dozen achievements that need it.
 * - "Recent dates" and "last hour" queries are also fetched once each.
 * - Completion writes are batched into a single upsert at the end where
 *   possible. Achievements with side tables (Punch Card, Twinsies) keep
 *   their dedicated writes since their schema differs.
 * - `fetchAchievementInfo` batches into a single `IN (...)` query.
 */
export async function evaluateAchievements(
  adminSupabase: SupabaseClient,
  userId: string,
  roll: RollRecord,
  rollId: number
): Promise<AchievementInfo[]> {
  // ── Bulk fetch ────────────────────────────────────────────────────────
  // Five focused queries cover everything the rest of the function needs.
  // Previously this was ~20 separate queries spread across each achievement.

  const oneHourAgoIso = new Date(new Date(roll.roll_time).getTime() - 60 * 60 * 1000).toISOString();

  const [
    { data: existingRaw },
    { data: tonightRollsRaw },
    { data: recentDatesRaw },
    { data: lastHourRaw },
    { count: totalRollsCount },
    { count: dailyDoubleTakenCount },
    { count: doublesNotDDCount },
    { count: malortAllTimeCount },
  ] = await Promise.all([
    adminSupabase
      .from("user_achievements")
      .select("achievement_id, progress, progress_detail, completed_at, times_completed, cycle_started_at")
      .eq("user_id", userId),
    adminSupabase
      .from("rolls")
      .select("red_die_number, white_die_number, red_drink_name, white_drink_name, is_doubles, roll_time")
      .eq("user_id", userId)
      .eq("roll_date", roll.roll_date),
    adminSupabase
      .from("rolls")
      .select("roll_date")
      .eq("user_id", userId)
      .order("roll_date", { ascending: false })
      .limit(50),
    adminSupabase
      .from("rolls")
      .select("id", { count: "exact", head: false })
      .eq("user_id", userId)
      .gte("roll_time", oneHourAgoIso)
      .lte("roll_time", roll.roll_time),
    adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_daily_double", true),
    adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_doubles", true)
      .eq("is_daily_double", false),
    adminSupabase
      .from("rolls")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("white_die_number", 6),
  ]);

  const existing: ExistingRow[] = (existingRaw as ExistingRow[]) ?? [];
  const tonightRolls: TonightRoll[] = (tonightRollsRaw as TonightRoll[]) ?? [];
  const recentDates = ((recentDatesRaw ?? []) as { roll_date: string }[]).map((r) => r.roll_date);
  const lastHourCount = (lastHourRaw ?? []).length;

  const completed = new Set(
    existing.filter((ua) => ua.completed_at !== null).map((ua) => ua.achievement_id)
  );

  // Buffered writes: simple completions go through queueCompletion(), repeatable
  // achievements (punch card, twinsies) write directly because their schema
  // differs.
  const completionsToUpsert: Array<{
    user_id: string;
    achievement_id: string;
    progress: number;
    progress_detail: object | null;
    completed_at: string;
    earned_on_roll_id: number;
    updated_at: string;
  }> = [];
  const counterUpdates: Array<{
    user_id: string;
    achievement_id: string;
    progress: number;
    progress_detail: object | null;
    completed_at: string | null;
    earned_on_roll_id: number | null;
    updated_at: string;
  }> = [];
  const newlyEarnedIds: string[] = [];
  // Per-achievement extras (twinsies attaches partner usernames, punch card
  // overrides emoji to the trophy variant).
  const idExtras: Map<string, Partial<AchievementInfo>> = new Map();

  function queueCompletion(achievementId: AchievementId) {
    if (completed.has(achievementId)) return;
    const now = new Date().toISOString();
    completionsToUpsert.push({
      user_id: userId,
      achievement_id: achievementId,
      progress: 1,
      progress_detail: null,
      completed_at: now,
      earned_on_roll_id: rollId,
      updated_at: now,
    });
    completed.add(achievementId); // prevent duplicate queue within this run
    newlyEarnedIds.push(achievementId);
  }

  function queueCounter(
    achievementId: AchievementId,
    progress: number,
    target: number,
    progressDetail?: object
  ) {
    if (completed.has(achievementId)) return;
    const isComplete = progress >= target;
    const now = new Date().toISOString();
    counterUpdates.push({
      user_id: userId,
      achievement_id: achievementId,
      progress,
      progress_detail: progressDetail ?? null,
      completed_at: isComplete ? now : null,
      earned_on_roll_id: isComplete ? rollId : null,
      updated_at: now,
    });
    if (isComplete) {
      completed.add(achievementId);
      newlyEarnedIds.push(achievementId);
    }
  }

  // ── YOU'RE A REGULAR ──────────────────────────────────────────────────

  queueCompletion(A.RING_GONG);
  queueCounter(A.FIFTY_FABULOUS, totalRollsCount ?? 0, 50);
  queueCounter(A.CENTURY_CLUB, totalRollsCount ?? 0, 100);
  queueCounter(A.DAILY_DOUBLE_DEVOTEE, dailyDoubleTakenCount ?? 0, 10);
  queueCounter(A.THE_CONTRARIAN, doublesNotDDCount ?? 0, 10);
  queueCounter(A.MALORT_ADVENT_CALENDAR, malortAllTimeCount ?? 0, 25);

  // The Punch Card: Roll each 1–8 on BOTH dice (repeatable).
  // Cycle accounting + side-table insert keep this branch outside the
  // batched upserts.
  {
    const punchRow = existing.find((ua) => ua.achievement_id === A.THE_PUNCH_CARD);
    const timesCompleted: number = punchRow?.times_completed ?? 0;
    const cycleStartedAt: string | null = punchRow?.cycle_started_at ?? null;

    let punchQuery = adminSupabase
      .from("rolls")
      .select("red_die_number, white_die_number")
      .eq("user_id", userId);
    if (cycleStartedAt) {
      punchQuery = punchQuery.gt("roll_time", cycleStartedAt);
    }
    const { data: punchRolls } = await punchQuery;
    const punchRollsArr = punchRolls ?? [];

    const redHit = new Set(punchRollsArr.map((r) => r.red_die_number));
    const whiteHit = new Set(punchRollsArr.map((r) => r.white_die_number));
    const punchProgress = redHit.size + whiteHit.size;

    if (punchProgress >= 16) {
      const newTimesCompleted = timesCompleted + 1;
      const now = new Date().toISOString();
      await Promise.all([
        adminSupabase.from("user_achievements").upsert(
          {
            user_id: userId,
            achievement_id: A.THE_PUNCH_CARD,
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
        adminSupabase.from("punch_card_completions").insert({
          user_id: userId,
          earned_on_roll_id: rollId,
          completion_number: newTimesCompleted,
          earned_at: now,
          rolls_to_complete: punchRollsArr.length,
        }),
      ]);
      newlyEarnedIds.push(A.THE_PUNCH_CARD);
      idExtras.set(A.THE_PUNCH_CARD, { emoji: PUNCH_CARD_EMOJI });
    } else {
      const now = new Date().toISOString();
      await adminSupabase.from("user_achievements").upsert(
        {
          user_id: userId,
          achievement_id: A.THE_PUNCH_CARD,
          progress: punchProgress,
          progress_detail: {
            red: Array.from(redHit).sort((a, b) => a - b),
            white: Array.from(whiteHit).sort((a, b) => a - b),
          },
          times_completed: timesCompleted,
          cycle_roll_count: punchRollsArr.length,
          cycle_started_at: cycleStartedAt,
          completed_at: null,
          updated_at: now,
        },
        { onConflict: "user_id,achievement_id" }
      );
    }
  }

  // Double Trouble: All 8 unique doubles
  if (!completed.has(A.DOUBLE_TROUBLE)) {
    const { data: doubleRolls } = await adminSupabase
      .from("rolls")
      .select("red_die_number")
      .eq("user_id", userId)
      .eq("is_doubles", true);
    const uniqueDoubles = new Set((doubleRolls ?? []).map((r) => r.red_die_number));
    queueCounter(A.DOUBLE_TROUBLE, uniqueDoubles.size, 8, {
      numbers: Array.from(uniqueDoubles).sort((a, b) => a - b),
    });
  }

  // Around the World: All 64 unique combos
  if (!completed.has(A.AROUND_THE_WORLD)) {
    const { data: comboRolls } = await adminSupabase
      .from("rolls")
      .select("red_die_number, white_die_number")
      .eq("user_id", userId);
    const uniqueCombos = new Set(
      (comboRolls ?? []).map((r) => `${r.red_die_number}-${r.white_die_number}`)
    );
    queueCounter(A.AROUND_THE_WORLD, uniqueCombos.size, 64, {
      combos: Array.from(uniqueCombos),
    });
  }

  // Twinsies: same exact combo as another user on the same night.
  // Repeatable; progress increments every twin event. Modal pops every time.
  {
    const eventKey = twinEventKey(roll.roll_date, roll.red_die_number, roll.white_die_number);

    const { data: matchingRolls } = await adminSupabase
      .from("rolls")
      .select("user_id, profiles!inner(username)")
      .eq("roll_date", roll.roll_date)
      .eq("red_die_number", roll.red_die_number)
      .eq("white_die_number", roll.white_die_number)
      .neq("user_id", userId);

    // Supabase types the inner profile join as an array in TS even though
    // it's a single row at runtime. Pick the first entry.
    type ProfileRow = { username: string | null };
    type TwinRow = { user_id: string; profiles: ProfileRow | ProfileRow[] | null };
    const partnerUsernames = Array.from(
      new Set(
        ((matchingRolls ?? []) as unknown as TwinRow[])
          .map((r) => {
            const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return p?.username ?? null;
          })
          .filter((u): u is string => typeof u === "string")
      )
    ).sort();

    if (partnerUsernames.length > 0) {
      const twinsRow = existing.find((ua) => ua.achievement_id === A.TWINSIES);
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
          await adminSupabase
            .from("user_achievements")
            .update({
              progress: nextProgress,
              progress_detail: { credited_events: nextEvents },
              completed_at: twinsRow.completed_at ?? now,
              updated_at: now,
            })
            .eq("user_id", userId)
            .eq("achievement_id", A.TWINSIES);
        } else {
          await adminSupabase.from("user_achievements").insert({
            user_id: userId,
            achievement_id: A.TWINSIES,
            progress: nextProgress,
            progress_detail: { credited_events: nextEvents },
            completed_at: now,
            earned_on_roll_id: rollId,
            updated_at: now,
          });
        }

        newlyEarnedIds.push(A.TWINSIES);
        idExtras.set(A.TWINSIES, { twinPartners: partnerUsernames, twinCount: nextProgress });
      }
    }
  }

  // ── THE CRAPS TABLE (all derivable from tonightRolls + roll itself) ────

  const tonightSorted = [...tonightRolls].sort((a, b) =>
    a.roll_time < b.roll_time ? -1 : a.roll_time > b.roll_time ? 1 : 0
  );
  const doublesTonight = tonightRolls.filter((r) => r.is_doubles).length;
  const rollsTonight = tonightRolls.length;
  const lastTwo = tonightSorted.slice(-2);

  // Feeling Lucky: doubles twice in a row (within tonight; matches original behavior)
  if (lastTwo.length >= 2 && lastTwo.every((r) => r.is_doubles)) {
    queueCompletion(A.FEELING_LUCKY);
  }

  if (doublesTonight >= 3) queueCompletion(A.ON_FIRE);
  if (doublesTonight >= 2) queueCompletion(A.HOT_DICE);
  if (roll.is_doubles && roll.red_die_number === 1) queueCompletion(A.SNAKE_EYES);
  if (roll.is_doubles && roll.red_die_number === 8) queueCompletion(A.BOXCARS);

  // Deja Vu: same combo twice in one night
  // Stuck in the Matrix: same combo three times in one night
  if (rollsTonight >= 2) {
    const counts = new Map<string, number>();
    for (const r of tonightRolls) {
      const key = `${r.red_die_number}-${r.white_die_number}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const maxCount = Math.max(...Array.from(counts.values()));
    if (maxCount >= 2) queueCompletion(A.DEJA_VU);
    if (maxCount >= 3) queueCompletion(A.STUCK_IN_THE_MATRIX);
  }

  // Mark of the Devil: 3+ total 6s shown across both dies in one night.
  // Double-six = 2, single-six = 1.
  if (roll.red_die_number === 6 || roll.white_die_number === 6) {
    const totalSixes = tonightRolls.reduce(
      (acc, r) => acc + (r.red_die_number === 6 ? 1 : 0) + (r.white_die_number === 6 ? 1 : 0),
      0
    );
    if (totalSixes >= 3) queueCompletion(A.MARK_OF_THE_DEVIL);
  }

  // Shot Roulette: 3+ distinct white_drink_name values from rolls where white die = 7.
  if (roll.white_die_number === 7 && !completed.has(A.SHOT_ROULETTE)) {
    const { data: sevens } = await adminSupabase
      .from("rolls")
      .select("white_drink_name")
      .eq("user_id", userId)
      .eq("white_die_number", 7);
    const distinctShots = new Set((sevens ?? []).map((r) => r.white_drink_name));
    if (distinctShots.size >= 3) queueCompletion(A.SHOT_ROULETTE);
  }

  // ── SPECIAL COMBINATIONS (drink-name matched; DD substitutions don't trigger) ──
  for (const combo of SPECIAL_COMBOS) {
    if (roll.red_drink_name === combo.redDrink && roll.white_drink_name === combo.whiteDrink) {
      queueCompletion(combo.id);
    }
  }

  // Fire and Ice: Hot Hooch and Rumple Minze rolled in the same night.
  // Both live on the white die (#8 and #5), so they can never co-occur on a single roll.
  if (roll.white_drink_name === "Hot Hooch" || roll.white_drink_name === "Rumple Minze") {
    const whitesTonight = new Set(tonightRolls.map((r) => r.white_drink_name));
    if (whitesTonight.has("Hot Hooch") && whitesTonight.has("Rumple Minze")) {
      queueCompletion(A.FIRE_AND_ICE);
    }
  }

  // ── CLOCKING IN ────────────────────────────────────────────────────────

  const nyHour = getNYHour(new Date(roll.roll_time));
  const [dow_y, dow_m, dow_d] = roll.roll_date.split("-").map(Number);
  const dow = new Date(dow_y, dow_m - 1, dow_d).getDay();

  queueCompletion(DOW_ACHIEVEMENTS[dow]);

  if (nyHour === 17) queueCompletion(A.EARLY_BIRD);
  if (nyHour >= 1 && nyHour <= 3) queueCompletion(A.NIGHT_OWL);

  // Open to Close: roll between 5–6 PM and 1–2 AM in the same night
  {
    const hours = tonightRolls.map((r) => getNYHour(new Date(r.roll_time)));
    if (hours.some((h) => h === 17) && hours.some((h) => h === 1)) {
      queueCompletion(A.OPEN_TO_CLOSE);
    }
  }

  // Bender (3) and My New Home (7): consecutive bar nights ending today
  {
    const uniqueDates = Array.from(new Set(recentDates)).sort();
    const endsToday = uniqueDates[uniqueDates.length - 1] === roll.roll_date;
    if (endsToday) {
      const isConsecutiveTail = (n: number): boolean => {
        if (uniqueDates.length < n) return false;
        const tail = uniqueDates.slice(-n);
        for (let i = 1; i < tail.length; i++) {
          const prev = new Date(tail[i - 1] + "T12:00:00").getTime();
          const cur = new Date(tail[i] + "T12:00:00").getTime();
          if (cur - prev !== MS_PER_DAY) return false;
        }
        return true;
      };
      if (isConsecutiveTail(3)) queueCompletion(A.BENDER);
      if (isConsecutiveTail(7)) queueCompletion(A.MY_NEW_HOME);
    }
  }

  // ── DANGER ZONE (all derivable from tonightRolls + lastHourCount) ──────

  if (rollsTonight >= 2) queueCompletion(A.RUN_IT_BACK);
  if (rollsTonight >= 3) queueCompletion(A.HAT_TRICK);
  if (rollsTonight >= 4) queueCompletion(A.THE_QUAD_GOD);
  if (rollsTonight >= 5) queueCompletion(A.THE_LEGEND);

  if (lastHourCount >= 2) queueCompletion(A.POWER_HOUR);
  if (lastHourCount >= 3) queueCompletion(A.SLOW_DOWN);

  // Dragon's Breath: Hot Hooch twice in one night
  if (roll.white_drink_name === "Hot Hooch") {
    const hotHoochCount = tonightRolls.filter((r) => r.white_drink_name === "Hot Hooch").length;
    if (hotHoochCount >= 2) queueCompletion(A.DRAGONS_BREATH);
  }

  // Malort Again!: 2+ Malort rolls in one night
  {
    const malortTonight = tonightRolls.filter((r) => r.white_die_number === 6).length;
    if (malortTonight >= 2) queueCompletion(A.MALORT_THREE_PEAT);
  }

  // ── HOLIDAYS ───────────────────────────────────────────────────────────
  {
    const { year, month, day, dow: holidayDow } = getNYDate(roll.roll_date);

    if (month === 1 && day === 1) queueCompletion(A.NEW_YEARS_DAY);
    if (month === 2 && day === 14) queueCompletion(A.VALENTINES_DAY);
    if (month === 2 && day === 29) queueCompletion(A.LEAP_DAY);
    if (month === 3 && day === 14) queueCompletion(A.PI_DAY);
    if (month === 3 && day === 17) queueCompletion(A.ST_PATRICKS_DAY);
    if (month === 4 && day === 1) queueCompletion(A.APRIL_FOOLS);
    if (month === 5 && day === 5) queueCompletion(A.CINCO_DE_MAYO);
    if (month === 7 && day === 4) queueCompletion(A.INDEPENDENCE_DAY);
    if (month === 10 && day === 31) queueCompletion(A.HALLOWEEN);
    if (month === 12 && day === 31) queueCompletion(A.NEW_YEARS_EVE);
    if (day === 13 && holidayDow === 5) queueCompletion(A.FRIDAY_13TH);

    // Christmas week (the Sun-Sat week containing Dec 25)
    {
      const christmasDow = new Date(year, 11, 25).getDay();
      const weekStartDay = 25 - christmasDow;
      if (month === 12 && day >= weekStartDay && day <= weekStartDay + 6) {
        queueCompletion(A.CHRISTMAS);
      }
    }

    // Easter (single day)
    {
      const easter = getEasterDate(year);
      if (month === easter.month && day === easter.day) queueCompletion(A.EASTER);
    }

    // Thanksgiving week (the Sun-Sat week containing the 4th Thursday)
    {
      const tday = getThanksgivingDate(year);
      const weekStartDay = tday.day - 4;
      const weekEndDay = tday.day + 2;
      if (month === tday.month && day >= weekStartDay && day <= weekEndDay) {
        queueCompletion(A.THANKSGIVING);
      }
    }
  }

  // ── Batched writes ────────────────────────────────────────────────────

  if (completionsToUpsert.length > 0) {
    await adminSupabase
      .from("user_achievements")
      .upsert(completionsToUpsert, { onConflict: "user_id,achievement_id" });
  }
  if (counterUpdates.length > 0) {
    await adminSupabase
      .from("user_achievements")
      .upsert(counterUpdates, { onConflict: "user_id,achievement_id" });
  }

  // ── Fetch metadata for newly earned (one IN query, not N) ─────────────

  if (newlyEarnedIds.length === 0) return [];

  const { data: infos } = await adminSupabase
    .from("achievements")
    .select("id, name, emoji, description, category_name, category_emoji")
    .in("id", newlyEarnedIds);

  const infoMap = new Map<string, AchievementInfo>(
    ((infos ?? []) as AchievementInfo[]).map((i) => [i.id, i])
  );

  // Preserve original ordering and apply per-ID extras
  return newlyEarnedIds
    .map((id) => {
      const base = infoMap.get(id);
      if (!base) return null;
      const extras = idExtras.get(id);
      return extras ? { ...base, ...extras } : base;
    })
    .filter((x): x is AchievementInfo => x !== null);
}
