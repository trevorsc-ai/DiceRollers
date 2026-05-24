/**
 * recalculate-achievements.mjs
 *
 * Wipes and recomputes all user_achievements rows from scratch based on
 * current rolls in the database.
 *
 * Usage:
 *   node --env-file=.env.local scripts/recalculate-achievements.mjs
 *
 * Or to target a specific user only:
 *   node --env-file=.env.local scripts/recalculate-achievements.mjs --user=<uuid>
 *
 * Note: Twinsies (twinsies) is intentionally excluded — it's a repeatable
 * cross-user achievement that can't be derived from a single user's roll
 * history. Its rows are preserved (not deleted) during recalc.
 *
 * Note: The Punch Card (the_punch_card) recalc reflects only the current
 * in-progress cycle. Completed cycle history lives in punch_card_completions,
 * which this script does not touch.
 */

import { createClient } from "@supabase/supabase-js";

// ── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const targetUser = process.argv
  .find((a) => a.startsWith("--user="))
  ?.split("=")[1];

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNYHour(timestamp) {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hour12: false,
    }).format(timestamp)
  );
}

/** Compute Easter Sunday for a given year using the Anonymous Gregorian algorithm. */
function getEasterDate(year) {
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
function getThanksgivingDate(year) {
  const firstDay = new Date(year, 10, 1).getDay(); // 0=Sun
  const firstThursday = firstDay <= 4 ? 5 - firstDay : 12 - firstDay;
  const day = firstThursday + 21; // + 3 weeks = 4th Thursday
  return { month: 11, day };
}

// Drink-name matched special combos (order doesn't matter)
const SPECIAL_COMBOS = [
  { id: "high_abv",            redDrink: "Raging Bitch", whiteDrink: "Rumple Minze" },
  { id: "the_freshman",        redDrink: "Whiteclaw",    whiteDrink: "Espolon" },
  { id: "chicago_charcuterie", redDrink: "High Life",    whiteDrink: "Malort" },
  { id: "the_regular",         redDrink: "Mickeys",      whiteDrink: "Malort" },
  { id: "hot_bitch",           redDrink: "Raging Bitch", whiteDrink: "Hot Hooch" },
  { id: "common_man",          redDrink: "High Life",    whiteDrink: "Jim Beam" },
];

// ── Achievement evaluation (full recalc from all rolls) ───────────────────────

function computeAchievements(rolls) {
  /**
   * rolls: array sorted ascending by roll_time, each with:
   *   { id, roll_date, roll_time, red_die_number, white_die_number,
   *     red_drink_name, white_drink_name, is_doubles, is_daily_double }
   */

  const results = {}; // achievementId -> { progress, progress_detail, completed_at }

  function upsert(id, progress, target, detail = null) {
    const isComplete = progress >= target;
    results[id] = {
      progress,
      progress_detail: detail,
      completed_at: isComplete ? new Date().toISOString() : null,
    };
  }

  function markComplete(id) {
    results[id] = {
      progress: 1,
      progress_detail: null,
      completed_at: new Date().toISOString(),
    };
  }

  // Pre-build per-night buckets (used by multiple sections below)
  const rollsByDate = {}; // date -> [rolls]
  for (const r of rolls) {
    (rollsByDate[r.roll_date] ??= []).push(r);
  }

  // ── YOU'RE A REGULAR ──────────────────────────────────────────────────────

  // Ring the Gong: first roll ever
  if (rolls.length >= 1) markComplete("ring_gong");

  // Fifty & Fabulous: 50 total rolls
  upsert("fifty_fabulous", rolls.length, 50);

  // Century Club: 100 total rolls
  upsert("century_club", rolls.length, 100);

  // Daily Double Devotee: take the daily double 10 times
  const ddCount = rolls.filter((r) => r.is_daily_double).length;
  upsert("daily_double_devotee", ddCount, 10);

  // The Contrarian: decline the daily double 10 times
  const contrCount = rolls.filter((r) => r.is_doubles && !r.is_daily_double).length;
  upsert("the_contrarian", contrCount, 10);

  // Malort Advent Calendar: Roll Malort (white=6) 25 times
  const malortCount = rolls.filter((r) => r.white_die_number === 6).length;
  upsert("malort_advent_calendar", malortCount, 25);

  // The Punch Card: Roll each 1–8 on BOTH dice (current cycle only)
  const redHit = new Set(rolls.map((r) => r.red_die_number));
  const whiteHit = new Set(rolls.map((r) => r.white_die_number));
  upsert(
    "the_punch_card",
    redHit.size + whiteHit.size,
    16,
    { red: Array.from(redHit).sort((a, b) => a - b), white: Array.from(whiteHit).sort((a, b) => a - b) }
  );

  // Double Trouble: All 8 unique doubles
  const uniqueDoubles = new Set(
    rolls.filter((r) => r.is_doubles).map((r) => r.red_die_number)
  );
  upsert(
    "double_trouble",
    uniqueDoubles.size,
    8,
    { numbers: Array.from(uniqueDoubles).sort((a, b) => a - b) }
  );

  // Around the World: All 64 unique combos
  const uniqueCombos = new Set(
    rolls.map((r) => `${r.red_die_number}-${r.white_die_number}`)
  );
  upsert("around_the_world", uniqueCombos.size, 64, {
    combos: Array.from(uniqueCombos),
  });

  // Twinsies: intentionally excluded — cross-user, repeatable; cannot be
  // derived from a single user's roll history. Rows are preserved below.

  // ── THE CRAPS TABLE ───────────────────────────────────────────────────────

  // Feeling Lucky: doubles twice in a row (within the same night)
  outer_lucky: for (const nightRolls of Object.values(rollsByDate)) {
    const sorted = [...nightRolls].sort((a, b) =>
      a.roll_time < b.roll_time ? -1 : a.roll_time > b.roll_time ? 1 : 0
    );
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].is_doubles && sorted[i - 1].is_doubles) {
        markComplete("feeling_lucky");
        break outer_lucky;
      }
    }
  }

  // Snake Eyes: double 1s
  if (rolls.some((r) => r.is_doubles && r.red_die_number === 1)) markComplete("snake_eyes");

  // Boxcars: double 8s
  if (rolls.some((r) => r.is_doubles && r.red_die_number === 8)) markComplete("boxcars");

  // Hot Dice: 2+ doubles in one night / On Fire: 3+ doubles in one night
  const doublesByDate = {};
  for (const r of rolls) {
    if (r.is_doubles) doublesByDate[r.roll_date] = (doublesByDate[r.roll_date] ?? 0) + 1;
  }
  if (Object.values(doublesByDate).some((c) => c >= 2)) markComplete("hot_dice");
  if (Object.values(doublesByDate).some((c) => c >= 3)) markComplete("on_fire");

  // Deja Vu: same combo twice in one night
  // Stuck in the Matrix: same combo three times in one night
  for (const nightRolls of Object.values(rollsByDate)) {
    const comboCounts = new Map();
    for (const r of nightRolls) {
      const key = `${r.red_die_number}-${r.white_die_number}`;
      comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
    }
    const maxCount = Math.max(0, ...Array.from(comboCounts.values()));
    if (maxCount >= 2) markComplete("deja_vu");
    if (maxCount >= 3) markComplete("stuck_in_the_matrix");
  }

  // Mark of the Devil: 3+ total 6s across both dice in one night
  // (double-six counts as 2)
  for (const nightRolls of Object.values(rollsByDate)) {
    const totalSixes = nightRolls.reduce(
      (acc, r) =>
        acc + (r.red_die_number === 6 ? 1 : 0) + (r.white_die_number === 6 ? 1 : 0),
      0
    );
    if (totalSixes >= 3) {
      markComplete("mark_of_the_devil");
      break;
    }
  }

  // Shot Roulette: 3+ distinct white_drink_name values from rolls where white die = 7
  {
    const distinctShots = new Set(
      rolls.filter((r) => r.white_die_number === 7).map((r) => r.white_drink_name)
    );
    if (distinctShots.size >= 3) markComplete("shot_roulette");
  }

  // ── SPECIAL COMBINATIONS ─────────────────────────────────────────────────

  // Drink-name matched (single roll)
  for (const combo of SPECIAL_COMBOS) {
    const hit = rolls.find(
      (r) => r.red_drink_name === combo.redDrink && r.white_drink_name === combo.whiteDrink
    );
    if (hit) markComplete(combo.id);
  }

  // Fire and Ice: Hot Hooch and Rumple Minze rolled in the same night
  for (const nightRolls of Object.values(rollsByDate)) {
    const whites = new Set(nightRolls.map((r) => r.white_drink_name));
    if (whites.has("Hot Hooch") && whites.has("Rumple Minze")) {
      markComplete("fire_and_ice");
      break;
    }
  }

  // Gen Alpha: red die 6 + white die 7 (die-number matched)
  if (rolls.some((r) => r.red_die_number === 6 && r.white_die_number === 7)) {
    markComplete("gen_alpha");
  }

  // ── CLOCKING IN ──────────────────────────────────────────────────────────

  const hoursByDate = {};
  for (const r of rolls) {
    const hour = getNYHour(new Date(r.roll_time));
    (hoursByDate[r.roll_date] ??= []).push(hour);
    if (!results["early_bird"]?.completed_at && hour === 17) markComplete("early_bird");
    if (!results["night_owl"]?.completed_at && hour >= 1 && hour <= 3) markComplete("night_owl");

    const [dy, dm, dd] = r.roll_date.split("-").map(Number);
    const dow = new Date(dy, dm - 1, dd).getDay(); // 0=Sun…6=Sat
    if (!results["sunday_funday"]?.completed_at && dow === 0) markComplete("sunday_funday");
    if (!results["case_of_the_mondays"]?.completed_at && dow === 1) markComplete("case_of_the_mondays");
    if (!results["taco_tuesday"]?.completed_at && dow === 2) markComplete("taco_tuesday");
    if (!results["hump_day"]?.completed_at && dow === 3) markComplete("hump_day");
    if (!results["trivia_thursday"]?.completed_at && dow === 4) markComplete("trivia_thursday");
    if (!results["friday_night_lights"]?.completed_at && dow === 5) markComplete("friday_night_lights");
    if (!results["saturday_night_fever"]?.completed_at && dow === 6) markComplete("saturday_night_fever");
  }

  // Open to Close: roll at 5–6 PM (hour 17) and 1–2 AM (hour 1) same night
  for (const hours of Object.values(hoursByDate)) {
    if (hours.some((h) => h === 17) && hours.some((h) => h === 1)) {
      markComplete("open_to_close");
      break;
    }
  }

  // Bender: 3 consecutive bar nights
  // My New Home: 7 consecutive bar nights
  const uniqueSortedDates = [...new Set(rolls.map((r) => r.roll_date))].sort();
  const MS_PER_DAY = 86400000;

  for (let i = 2; i < uniqueSortedDates.length; i++) {
    const d0 = new Date(uniqueSortedDates[i - 2] + "T12:00:00").getTime();
    const d1 = new Date(uniqueSortedDates[i - 1] + "T12:00:00").getTime();
    const d2 = new Date(uniqueSortedDates[i] + "T12:00:00").getTime();
    if (d1 - d0 === MS_PER_DAY && d2 - d1 === MS_PER_DAY) {
      markComplete("bender");
      break;
    }
  }

  for (let i = 6; i < uniqueSortedDates.length; i++) {
    let consecutive = true;
    for (let j = 1; j <= 6; j++) {
      const prev = new Date(uniqueSortedDates[i - j] + "T12:00:00").getTime();
      const curr = new Date(uniqueSortedDates[i - j + 1] + "T12:00:00").getTime();
      if (curr - prev !== MS_PER_DAY) { consecutive = false; break; }
    }
    if (consecutive) { markComplete("my_new_home"); break; }
  }

  // ── DANGER ZONE ──────────────────────────────────────────────────────────

  // Roll count per night
  for (const nightRolls of Object.values(rollsByDate)) {
    const n = nightRolls.length;
    if (n >= 2) markComplete("run_it_back");
    if (n >= 3) markComplete("hat_trick");
    if (n >= 4) markComplete("the_quad_god");
    if (n >= 5) markComplete("the_legend");
  }

  // Power Hour: 2+ rolls within any 60-minute window
  // Slow Down: 3+ rolls within any 60-minute window
  outer_ph: for (let i = 0; i < rolls.length; i++) {
    const windowStart = new Date(rolls[i].roll_time).getTime() - 60 * 60 * 1000;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (new Date(rolls[j].roll_time).getTime() >= windowStart) count++;
      else break;
    }
    if (count >= 2) { markComplete("power_hour"); }
    if (count >= 3) { markComplete("slow_down"); break outer_ph; }
    if (count >= 2 && results["slow_down"]?.completed_at) break outer_ph;
  }

  // Dragon's Breath: Hot Hooch twice in one night
  for (const nightRolls of Object.values(rollsByDate)) {
    const hotHoochCount = nightRolls.filter((r) => r.white_drink_name === "Hot Hooch").length;
    if (hotHoochCount >= 2) {
      markComplete("dragons_breath");
      break;
    }
  }

  // Malort Again!: 2+ Malort rolls (white=6) in one night
  const malortByDate = {};
  for (const r of rolls) {
    if (r.white_die_number === 6) malortByDate[r.roll_date] = (malortByDate[r.roll_date] ?? 0) + 1;
  }
  if (Object.values(malortByDate).some((c) => c >= 2)) markComplete("malort_three_peat");

  // ── HOLIDAYS ─────────────────────────────────────────────────────────────

  for (const r of rolls) {
    const [year, month, day] = r.roll_date.split("-").map(Number);
    const dow = new Date(year, month - 1, day).getDay(); // 0=Sun…6=Sat

    if (!results["new_years_day"]?.completed_at && month === 1 && day === 1)
      markComplete("new_years_day");
    if (!results["valentines_day"]?.completed_at && month === 2 && day === 14)
      markComplete("valentines_day");
    if (!results["leap_day"]?.completed_at && month === 2 && day === 29)
      markComplete("leap_day");
    if (!results["pi_day"]?.completed_at && month === 3 && day === 14)
      markComplete("pi_day");
    if (!results["st_patricks_day"]?.completed_at && month === 3 && day === 17)
      markComplete("st_patricks_day");
    if (!results["april_fools"]?.completed_at && month === 4 && day === 1)
      markComplete("april_fools");
    if (!results["cinco_de_mayo"]?.completed_at && month === 5 && day === 5)
      markComplete("cinco_de_mayo");
    if (!results["independence_day"]?.completed_at && month === 7 && day === 4)
      markComplete("independence_day");
    if (!results["halloween"]?.completed_at && month === 10 && day === 31)
      markComplete("halloween");
    if (!results["new_years_eve"]?.completed_at && month === 12 && day === 31)
      markComplete("new_years_eve");
    if (!results["friday_13th"]?.completed_at && day === 13 && dow === 5)
      markComplete("friday_13th");

    // Christmas: the Sun–Sat week containing Dec 25
    if (!results["christmas"]?.completed_at && month === 12) {
      const christmasDow = new Date(year, 11, 25).getDay();
      const weekStart = 25 - christmasDow;
      if (day >= weekStart && day <= weekStart + 6) markComplete("christmas");
    }

    // Easter: single day derived via Anonymous Gregorian algorithm
    if (!results["easter"]?.completed_at) {
      const easter = getEasterDate(year);
      if (month === easter.month && day === easter.day) markComplete("easter");
    }

    // Thanksgiving: the Sun–Sat week containing the 4th Thursday of November
    if (!results["thanksgiving"]?.completed_at && month === 11) {
      const tday = getThanksgivingDate(year);
      const weekStart = tday.day - 4;
      const weekEnd = tday.day + 2;
      if (day >= weekStart && day <= weekEnd) markComplete("thanksgiving");
    }
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function recalculateUser(userId) {
  // Fetch all rolls for this user sorted chronologically
  const { data: rolls, error: rollsErr } = await supabase
    .from("rolls")
    .select(
      "id, roll_date, roll_time, red_die_number, white_die_number, red_drink_name, white_drink_name, is_doubles, is_daily_double"
    )
    .eq("user_id", userId)
    .order("roll_time", { ascending: true });

  if (rollsErr) throw new Error(`Fetching rolls for ${userId}: ${rollsErr.message}`);

  console.log(`  ${rolls.length} rolls`);

  // Compute what achievements should look like
  const computed = computeAchievements(rolls || []);

  // Delete existing achievements for this user EXCEPT twinsies
  // (twinsies is cross-user and can't be recalculated from a single user's rolls)
  const { error: delErr } = await supabase
    .from("user_achievements")
    .delete()
    .eq("user_id", userId)
    .neq("achievement_id", "twinsies");
  if (delErr) throw new Error(`Deleting achievements for ${userId}: ${delErr.message}`);

  // Insert fresh rows (only for achievements that have any progress)
  const rows = Object.entries(computed)
    .filter(([, v]) => v.progress > 0 || v.completed_at)
    .map(([achievement_id, v]) => ({
      user_id: userId,
      achievement_id,
      progress: v.progress,
      progress_detail: v.progress_detail,
      completed_at: v.completed_at,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from("user_achievements").insert(rows);
    if (insertErr) throw new Error(`Inserting achievements for ${userId}: ${insertErr.message}`);
  }

  const earned = rows.filter((r) => r.completed_at).map((r) => r.achievement_id);
  console.log(`  Earned: ${earned.length > 0 ? earned.join(", ") : "(none)"}`);
  console.log(`  In progress: ${rows.filter((r) => !r.completed_at).length}`);
}

async function main() {
  let userIds;

  if (targetUser) {
    userIds = [targetUser];
    console.log(`Targeting single user: ${targetUser}`);
  } else {
    // Get all users who have rolls
    const { data: users, error } = await supabase
      .from("rolls")
      .select("user_id")
      .order("user_id");
    if (error) throw new Error(`Fetching users: ${error.message}`);
    userIds = [...new Set(users.map((u) => u.user_id))];
    console.log(`Found ${userIds.length} user(s) with rolls`);
  }

  for (const userId of userIds) {
    console.log(`\nProcessing ${userId}...`);
    await recalculateUser(userId);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
