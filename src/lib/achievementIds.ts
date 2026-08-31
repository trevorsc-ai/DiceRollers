/**
 * Canonical list of achievement IDs.
 *
 * Achievements live in two places that must agree: the `achievements` row in
 * Supabase, and any code that references the row by ID. Importing from this
 * file gives us autocomplete and a single typo-proof source. If a row exists
 * in the DB but isn't listed here, that's a sign the seed migration moved
 * forward without the app.
 *
 * Categories mirror `achievements.category` values from migration 010 so
 * grouping logic in the UI can use them directly.
 */

export const ACHIEVEMENT_IDS = {
  // You're a Regular
  RING_GONG: "ring_gong",
  FIFTY_FABULOUS: "fifty_fabulous",
  CENTURY_CLUB: "century_club",
  DAILY_DOUBLE_DEVOTEE: "daily_double_devotee",
  THE_CONTRARIAN: "the_contrarian",
  MALORT_ADVENT_CALENDAR: "malort_advent_calendar",
  THE_PUNCH_CARD: "the_punch_card",
  DOUBLE_TROUBLE: "double_trouble",
  AROUND_THE_WORLD: "around_the_world",
  TWINSIES: "twinsies",

  // The Craps Table
  FEELING_LUCKY: "feeling_lucky",
  ON_FIRE: "on_fire",
  SNAKE_EYES: "snake_eyes",
  BOXCARS: "boxcars",
  HOT_DICE: "hot_dice",
  DEJA_VU: "deja_vu",
  DYSLEXIC_DEJA_VU: "dyslexic_deja_vu",
  STUCK_IN_THE_MATRIX: "stuck_in_the_matrix",
  MARK_OF_THE_DEVIL: "mark_of_the_devil",
  SHOT_ROULETTE: "shot_roulette",

  // Special Combinations (matched by drink names or die numbers)
  HIGH_ABV: "high_abv",
  THE_FRESHMAN: "the_freshman",
  CHICAGO_CHARCUTERIE: "chicago_charcuterie",
  THE_REGULAR: "the_regular",
  HOT_BITCH: "hot_bitch",
  COMMON_MAN: "common_man",
  FIRE_AND_ICE: "fire_and_ice",
  GEN_ALPHA: "gen_alpha",
  FORGET_THE_ALAMO: "forget_the_alamo",

  // Clocking In
  SUNDAY_FUNDAY: "sunday_funday",
  CASE_OF_THE_MONDAYS: "case_of_the_mondays",
  TACO_TUESDAY: "taco_tuesday",
  HUMP_DAY: "hump_day",
  TRIVIA_THURSDAY: "trivia_thursday",
  FRIDAY_NIGHT_LIGHTS: "friday_night_lights",
  SATURDAY_NIGHT_FEVER: "saturday_night_fever",
  EARLY_BIRD: "early_bird",
  NIGHT_OWL: "night_owl",
  OPEN_TO_CLOSE: "open_to_close",
  BENDER: "bender",
  MY_NEW_HOME: "my_new_home",

  // Danger Zone
  RUN_IT_BACK: "run_it_back",
  HAT_TRICK: "hat_trick",
  THE_LEGEND: "the_legend",
  THE_QUAD_GOD: "the_quad_god",
  POWER_HOUR: "power_hour",
  DRAGONS_BREATH: "dragons_breath",
  MALORT_THREE_PEAT: "malort_three_peat",
  SLOW_DOWN: "slow_down",

  // Holidays
  NEW_YEARS_DAY: "new_years_day",
  VALENTINES_DAY: "valentines_day",
  LEAP_DAY: "leap_day",
  PI_DAY: "pi_day",
  ST_PATRICKS_DAY: "st_patricks_day",
  APRIL_FOOLS: "april_fools",
  CINCO_DE_MAYO: "cinco_de_mayo",
  INDEPENDENCE_DAY: "independence_day",
  HALLOWEEN: "halloween",
  CHRISTMAS: "christmas",
  NEW_YEARS_EVE: "new_years_eve",
  FRIDAY_13TH: "friday_13th",
  EASTER: "easter",
  THANKSGIVING: "thanksgiving",
  WORLD_CUP: "world_cup",
} as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[keyof typeof ACHIEVEMENT_IDS];

/** Day-of-week (0=Sun..6=Sat) → achievement ID. */
export const DOW_ACHIEVEMENTS: Record<number, AchievementId> = {
  0: ACHIEVEMENT_IDS.SUNDAY_FUNDAY,
  1: ACHIEVEMENT_IDS.CASE_OF_THE_MONDAYS,
  2: ACHIEVEMENT_IDS.TACO_TUESDAY,
  3: ACHIEVEMENT_IDS.HUMP_DAY,
  4: ACHIEVEMENT_IDS.TRIVIA_THURSDAY,
  5: ACHIEVEMENT_IDS.FRIDAY_NIGHT_LIGHTS,
  6: ACHIEVEMENT_IDS.SATURDAY_NIGHT_FEVER,
};
