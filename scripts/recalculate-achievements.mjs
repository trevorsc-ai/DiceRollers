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

const SPECIAL_COMBOS = [
  { id: "high_abv", redDrink: "Raging Bitch", whiteDrink: "Rumple Minze" },
  { id: "the_freshman", redDrink: "Whiteclaw", whiteDrink: "Espolon" },
  { id: "chicago_charcuterie", redDrink: "High Life", whiteDrink: "Malort" },
  { id: "the_regular", redDrink: "Mickeys", whiteDrink: "Malort" },
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

  // The Punch Card: Roll each 1–8 on BOTH dice
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

  // ── THE CRAPS TABLE ───────────────────────────────────────────────────────

  // Feeling Lucky: doubles twice in a row (at any point in history)
  for (let i = 1; i < rolls.length; i++) {
    if (rolls[i].is_doubles && rolls[i - 1].is_doubles) {
      markComplete("feeling_lucky");
      break;
    }
  }

  // On Fire: doubles three times in a row
  for (let i = 2; i < rolls.length; i++) {
    if (rolls[i].is_doubles && rolls[i - 1].is_doubles && rolls[i - 2].is_doubles) {
      markComplete("on_fire");
      break;
    }
  }

  // Snake Eyes: double 1s
  if (rolls.some((r) => r.is_doubles && r.red_die_number === 1)) markComplete("snake_eyes");

  // Boxcars: double 8s
  if (rolls.some((r) => r.is_doubles && r.red_die_number === 8)) markComplete("boxcars");

  // Hot Dice: 3+ doubles in one night
  const doublesByDate = {};
  for (const r of rolls) {
    if (r.is_doubles) doublesByDate[r.roll_date] = (doublesByDate[r.roll_date] ?? 0) + 1;
  }
  if (Object.values(doublesByDate).some((c) => c >= 3)) markComplete("hot_dice");

  // Deja Vu: same combo twice in one night
  const rollsByDate = {};
  for (const r of rolls) {
    (rollsByDate[r.roll_date] ??= []).push(`${r.red_die_number}-${r.white_die_number}`);
  }
  for (const combos of Object.values(rollsByDate)) {
    if (combos.length > new Set(combos).size) {
      markComplete("deja_vu");
      break;
    }
  }

  // ── SPECIAL COMBINATIONS ─────────────────────────────────────────────────

  for (const combo of SPECIAL_COMBOS) {
    const hit = rolls.find(
      (r) => r.red_drink_name === combo.redDrink && r.white_drink_name === combo.whiteDrink
    );
    if (hit) markComplete(combo.id);
  }

  // ── CLOCKING IN ──────────────────────────────────────────────────────────

  // Day-of-week achievements + hour tracking
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

  // Bender: 3 consecutive bar nights (any time in history)
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

  // ── DANGER ZONE ──────────────────────────────────────────────────────────

  // Run It Back: 2+ rolls same night
  for (const nightRolls of Object.values(rollsByDate)) {
    if (nightRolls.length >= 2) {
      markComplete("run_it_back");
      break;
    }
  }

  // Hat Trick: 3+ rolls same night
  for (const nightRolls of Object.values(rollsByDate)) {
    if (nightRolls.length >= 3) {
      markComplete("hat_trick");
      break;
    }
  }

  // The Legend: 5+ rolls same night
  for (const nightRolls of Object.values(rollsByDate)) {
    if (nightRolls.length >= 5) {
      markComplete("the_legend");
      break;
    }
  }

  // The Quad God: 4+ rolls same night
  for (const nightRolls of Object.values(rollsByDate)) {
    if (nightRolls.length >= 4) {
      markComplete("the_quad_god");
      break;
    }
  }

  // Power Hour: any 60-min window with 2+ rolls
  outer_power: for (let i = 0; i < rolls.length; i++) {
    const t = new Date(rolls[i].roll_time).getTime();
    const windowStart = t - 60 * 60 * 1000;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (new Date(rolls[j].roll_time).getTime() >= windowStart) count++;
      else break;
    }
    if (count >= 2) {
      markComplete("power_hour");
      break outer_power;
    }
  }

  // Malort Again!: 2+ Malort rolls in one night
  const malortByDate = {};
  for (const r of rolls) {
    if (r.white_die_number === 6) malortByDate[r.roll_date] = (malortByDate[r.roll_date] ?? 0) + 1;
  }
  if (Object.values(malortByDate).some((c) => c >= 2)) markComplete("malort_three_peat");

  // Slow Down: any 60-min window with 3+ rolls
  outer_slow: for (let i = 0; i < rolls.length; i++) {
    const t = new Date(rolls[i].roll_time).getTime();
    const windowStart = t - 60 * 60 * 1000;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      if (new Date(rolls[j].roll_time).getTime() >= windowStart) count++;
      else break;
    }
    if (count >= 3) {
      markComplete("slow_down");
      break outer_slow;
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

  // Delete existing achievements for this user
  const { error: delErr } = await supabase
    .from("user_achievements")
    .delete()
    .eq("user_id", userId);
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
