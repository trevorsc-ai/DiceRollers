/**
 * DiceRollers Wrapped — shapes, statistics and the yearbook superlatives.
 *
 * The two RPCs in migration 075 return raw counts. Everything statistical
 * lives here so it's in one dependency-free, testable place:
 *   - fair-dice baselines (1/8 doubles, 1/64 per combo, 1/8 Malört)
 *   - z-scores, chi-square p-values, "1 in N" odds
 *   - expected twinsies by pure chance
 *   - the yearbook rule: every eligible roller gets exactly one award
 *   - the persona closer
 *
 * Dependency-free so both server and client components can import it.
 */

// ─── RPC shapes ──────────────────────────────────────────────

export interface WrappedCombo {
  red: number;
  white: number;
  count?: number;
  red_name: string | null;
  white_name: string | null;
  red_logo: string | null;
  white_logo: string | null;
}

export interface WrappedLikedRoll extends WrappedCombo {
  likes: number;
  date: string;
  is_doubles: boolean;
  is_daily_double: boolean;
  username?: string;
}

export interface CollectionRace {
  seen: number;
  done_at: number | null;
  done_date: string | null;
  missing?: number[];
}

export interface WrappedAchievement {
  id: string;
  name: string;
  emoji: string;
  category_name: string;
  category_emoji: string;
  completed_at: string;
  unlock_count: number;
}

export interface WrappedPersonal {
  username: string;
  total_rolls: number;
  nights: number;
  doubles: number;
  snake_eyes: number;
  malort: number;
  after_midnight: number;
  red_freq: number[];
  white_freq: number[];
  /** Nights per weekday, 0 = Sunday. */
  dow_nights: number[];
  rollers: number;
  rollers_ahead: number;
  signature_combo: WrappedCombo | null;
  combos_seen: number;
  ghosted_combo: WrappedCombo | null;
  around_the_world: CollectionRace;
  double_trouble: CollectionRace;
  punch_card: CollectionRace;
  clock: { median_min: number | null; earliest_min: number | null; latest_min: number | null };
  earliest_roll: { date: string; night_min: number } | null;
  latest_roll: { date: string; night_min: number } | null;
  longest_streak: { start: string; end: string; nights: number } | null;
  longest_drought: { from: string; to: string; days: number; comeback: WrappedCombo | null } | null;
  twinsies_events: number;
  twin_partner: { username: string; events: number } | null;
  night_partner: { username: string; nights: number } | null;
  likes_received: number;
  likes_given: number;
  most_liked_roll: WrappedLikedRoll | null;
  achievements: WrappedAchievement[];
  punch_cards_this_year: number;
  total_users: number;
}

export interface HeavyweightFighter {
  user_id: string;
  username: string;
  rolls: number;
  nights: number;
  doubles: number;
  malort: number;
  combos: number;
  /** Rolls per month, Jan..Dec. */
  months: number[];
  first_on_shared: number;
}

export interface RollerMetrics {
  user_id: string;
  username: string;
  rolls: number;
  nights: number;
  doubles: number;
  double_pairs: number;
  snake_eyes: number;
  malort: number;
  spooky: number;
  with_company: number;
  distinct_combos: number;
  red_freq: number[];
  white_freq: number[];
  gap_mean: number | null;
  gap_sd: number | null;
  max_gap: number | null;
  max_gap_return: { date: string; white_name: string | null } | null;
  solo_nights: number;
  third_wheel_nights: number;
  monday_nights: number;
  avg_night_min: number | null;
  /** Earliest / latest roll of the night, minutes since 5 AM (migration 077). */
  min_night_min: number | null;
  max_night_min: number | null;
  likes_given: number;
  likes_received: number;
}

export interface WrappedGlobal {
  total_rolls: number;
  rollers: number;
  nights: number;
  doubles: number;
  red_freq: number[];
  white_freq: number[];
  /** Rolls per America/New_York clock hour, 0..23. */
  hour_counts: number[];
  busiest_night: { date: string; rolls: number; rollers: number } | null;
  top_combo: WrappedCombo | null;
  rarest_combo: WrappedCombo | null;
  unrolled_combos: number;
  milestone_roll: (WrappedCombo & { number: number; date: string; username: string }) | null;
  first_roll: { date: string; username: string; red_name: string; white_name: string } | null;
  most_liked_roll: WrappedLikedRoll | null;
  twinsies_events: number;
  /** Per multi-roller night: each roller's roll count. */
  night_roll_counts: number[][];
  heavyweight: { fighters: HeavyweightFighter[]; shared_nights: number; twinsies: number } | null;
  roller_metrics: RollerMetrics[];
}

// ─── Window ──────────────────────────────────────────────────

/**
 * Minimum rolls in the window to be eligible for a superlative. Everyone at or
 * above this gets exactly one award.
 */
export const SUPERLATIVE_MIN_ROLLS = 15;

/** Clockwork's own qualifier: 8 rolls, lower than the general floor above. */
export const CLOCKWORK_MIN_ROLLS = 8;

/**
 * The lowest roll count any award accepts. The RPC returns metrics for every
 * roller at or above this; `assignSuperlatives` applies each award's own floor.
 */
export const AWARD_POOL_MIN_ROLLS = Math.min(SUPERLATIVE_MIN_ROLLS, CLOCKWORK_MIN_ROLLS);

/**
 * Which year Wrapped covers. It drops in early December, so December shows
 * the current year; January still shows last year's.
 */
export function wrappedYear(now: Date = new Date()): number {
  return now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
}

/** Jan 1 – Dec 1 inclusive, by bar-night date. */
export function wrappedWindow(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-01` };
}

// ─── Fair-dice baselines ─────────────────────────────────────

export const P_DOUBLES = 1 / 8;
export const P_COMBO = 1 / 64;
export const P_FACE = 1 / 8;

/** Average rolls to finish each collection (coupon collector). */
export const EXPECTED_ROLLS = {
  aroundTheWorld: 304, // 64 · H(64)
  doubleTrouble: 174, // 8 · 8 · H(8)
  punchCard: 26, // E[max of two 8-coupon collectors]
} as const;

// ─── Statistics ──────────────────────────────────────────────

/** Error function, Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7). */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** z-score of `x` successes in `n` trials against probability `p`. */
export function binomialZ(x: number, n: number, p: number): number {
  if (n <= 0) return 0;
  return (x - n * p) / Math.sqrt(n * p * (1 - p));
}

/**
 * z-score after shrinking toward the baseline with `k` pseudo-trials, so a
 * roller who goes 2-for-3 on doubles can't outrank one who went 30-for-150.
 */
export function shrunkZ(x: number, n: number, p: number, k = 8): number {
  return binomialZ(x + k * p, n + k, p);
}

/** Pearson chi-square statistic against a uniform die. */
export function chiSquareUniform(freq: number[]): number {
  const n = freq.reduce((a, b) => a + b, 0);
  if (n === 0) return 0;
  const e = n / freq.length;
  return freq.reduce((acc, o) => acc + ((o - e) * (o - e)) / e, 0);
}

/**
 * P(χ² ≥ x) for 7 degrees of freedom (an 8-sided die). Closed form for odd
 * df: 2·Q(√x) + 2·φ(√x)·(√x + x^1.5/3 + x^2.5/15).
 */
export function chiSquareP7(x: number): number {
  if (x <= 0) return 1;
  const c = Math.sqrt(x);
  const phi = Math.exp(-x / 2) / Math.sqrt(2 * Math.PI);
  const p = 2 * (1 - normalCdf(c)) + 2 * phi * (c + (c * x) / 3 + (c * x * x) / 15);
  return Math.min(1, Math.max(0, p));
}

export interface DieVerdict {
  label: string;
  emoji: string;
  p: number;
  chi: number;
}

/** Turn a face-count histogram into a fairness verdict. */
export function dieVerdict(freq: number[]): DieVerdict {
  const chi = chiSquareUniform(freq);
  const p = chiSquareP7(chi);
  if (p < 0.01) return { label: "Bring this die to the commissioner", emoji: "🚨", p, chi };
  if (p < 0.05) return { label: "Suspicious", emoji: "🤨", p, chi };
  return { label: "Certified Fair", emoji: "✅", p, chi };
}

/** "1 in 120" style odds for a one-sided z-score. */
export function oneInN(z: number): number {
  const p = 1 - normalCdf(z);
  if (p <= 0) return Infinity;
  return Math.max(1, Math.round(1 / p));
}

/** Expected number of distinct combos after `n` fair rolls. */
export function expectedDistinctCombos(n: number): number {
  return 64 * (1 - Math.pow(63 / 64, n));
}

/**
 * How many twinsies pure chance predicts. For each night and each of the 64
 * combos, P(at least two different rollers hit it), where a roller with r
 * rolls hits a given combo with q = 1 − (63/64)^r.
 */
export function expectedTwinsies(nightRollCounts: number[][]): number {
  let total = 0;
  for (const counts of nightRollCounts) {
    const qs = counts.map((r) => 1 - Math.pow(63 / 64, r));
    const none = qs.reduce((acc, q) => acc * (1 - q), 1);
    let exactlyOne = 0;
    for (let i = 0; i < qs.length; i++) {
      let term = qs[i];
      for (let j = 0; j < qs.length; j++) if (j !== i) term *= 1 - qs[j];
      exactlyOne += term;
    }
    total += 64 * (1 - none - exactlyOne);
  }
  return total;
}

// ─── Formatting ──────────────────────────────────────────────

/** Minutes since 5:00 AM (the bar-night boundary) → "9:47 PM". */
export function formatNightMinutes(nightMin: number): string {
  const clock = (Math.round(nightMin) + 300) % 1440;
  const h24 = Math.floor(clock / 60);
  const m = clock % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** Clock hour (0..23) → "10–11 PM". */
export function formatHourRange(hour: number): string {
  const label = (h: number) => (h % 12 === 0 ? 12 : h % 12);
  const suffix = (h: number) => (h < 12 ? "AM" : "PM");
  const next = (hour + 1) % 24;
  return suffix(hour) === suffix(next)
    ? `${label(hour)}–${label(next)} ${suffix(next)}`
    : `${label(hour)} ${suffix(hour)}–${label(next)} ${suffix(next)}`;
}

/** "+1.6σ" / "−0.4σ". */
export function formatSigma(z: number): string {
  const r = Math.round(z * 10) / 10;
  return `${r >= 0 ? "+" : "−"}${Math.abs(r).toFixed(1)}σ`;
}

/** p-value with sensible precision: "p = 0.62", "p = 0.004", "p < 0.001". */
export function formatP(p: number): string {
  if (p < 0.001) return "p < 0.001";
  if (p < 0.01) return `p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(2)}`;
}

/** Rounded to one decimal, trailing ".0" dropped. */
export function round1(x: number): string {
  return (Math.round(x * 10) / 10).toString();
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONTHS_SHORT = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** "top 15%" percentile for a roller's volume. */
export function topPercent(rollersAhead: number, rollers: number): number {
  if (rollers <= 0) return 100;
  return Math.max(1, Math.ceil(((rollersAhead + 1) / rollers) * 100));
}

/** Index of the max value (first on ties). */
export function argMax(xs: number[]): number {
  return xs.reduce((best, x, i) => (x > xs[best] ? i : best), 0);
}

/** Index of the min value (first on ties). */
export function argMin(xs: number[]): number {
  return xs.reduce((best, x, i) => (x < xs[best] ? i : best), 0);
}

// ─── Yearbook superlatives ───────────────────────────────────

export interface AwardDef {
  id: string;
  emoji: string;
  title: string;
  /**
   * Raw score for this roller, or null if they don't qualify. `kind` says
   * how to make scores comparable across awards:
   *   - "z": already a z-score against fair dice (used as-is)
   *   - "cohort": standardised against the other eligible rollers
   */
  kind: "z" | "cohort";
  /** Rolls needed to compete for this award (default `SUPERLATIVE_MIN_ROLLS`). */
  minRolls?: number;
  score: (m: RollerMetrics) => number | null;
  blurb: (m: RollerMetrics) => string;
}

/** Face (1..8) and die that stray furthest from fair, for the "rigged" award. */
function mostLoadedFace(m: RollerMetrics): { die: "red" | "white"; face: number; count: number; expected: number } {
  const pick = (freq: number[], die: "red" | "white") => {
    const e = m.rolls / 8;
    const i = argMax(freq.map((o) => Math.abs(o - e)));
    return { die, face: i + 1, count: freq[i], expected: e, dev: Math.abs(freq[i] - e) };
  };
  const r = pick(m.red_freq, "red");
  const w = pick(m.white_freq, "white");
  const best = w.dev > r.dev ? w : r;
  return { die: best.die, face: best.face, count: best.count, expected: best.expected };
}

export const AWARDS: AwardDef[] = [
  {
    id: "luckiest",
    emoji: "🍀",
    title: "Luckiest Roller",
    kind: "z",
    score: (m) => shrunkZ(m.doubles, m.rolls, P_DOUBLES),
    blurb: (m) =>
      `${m.doubles} doubles in ${m.rolls} rolls, where ${round1(m.rolls * P_DOUBLES)} were expected (${formatSigma(
        binomialZ(m.doubles, m.rolls, P_DOUBLES)
      )}).`,
  },
  {
    id: "cursed",
    emoji: "🐍",
    title: "Most Cursed",
    kind: "z",
    score: (m) => -shrunkZ(m.doubles, m.rolls, P_DOUBLES),
    blurb: (m) =>
      `${m.doubles} doubles in ${m.rolls} rolls, where ${round1(m.rolls * P_DOUBLES)} were expected. The dice owe you.`,
  },
  {
    id: "malort_magnet",
    emoji: "🧲",
    title: "Malört Magnet",
    kind: "z",
    score: (m) => shrunkZ(m.malort, m.rolls, P_FACE),
    blurb: (m) => `Got Malört ${m.malort} times. A fair die says ${round1(m.rolls * P_FACE)}. The Malört chose you.`,
  },
  {
    id: "snake_eyes",
    emoji: "👀",
    title: "Snake Eyes Survivor",
    kind: "z",
    score: (m) => (m.snake_eyes > 0 ? shrunkZ(m.snake_eyes, m.rolls, P_COMBO) : null),
    blurb: (m) =>
      `Rolled 1-1 ${m.snake_eyes} ${m.snake_eyes === 1 ? "time" : "times"} (expected ${round1(m.rolls * P_COMBO)}).`,
  },
  {
    id: "double_double",
    emoji: "⚡",
    title: "Doubles Twice-in-a-Row Club",
    kind: "z",
    score: (m) => (m.double_pairs > 0 ? shrunkZ(m.double_pairs, Math.max(m.rolls - 1, 0), P_COMBO) : null),
    blurb: (m) =>
      `Back-to-back doubles ${m.double_pairs} ${m.double_pairs === 1 ? "time" : "times"}. Each one is a 1-in-64 shot.`,
  },
  {
    id: "fairest",
    emoji: "⚖️",
    title: "Fairest Dice in the Land",
    kind: "cohort",
    score: (m) => -(chiSquareUniform(m.red_freq) + chiSquareUniform(m.white_freq)),
    blurb: (m) =>
      `Faces spread so evenly it's almost suspicious (χ² = ${round1(
        (chiSquareUniform(m.red_freq) + chiSquareUniform(m.white_freq)) / 2
      )}).`,
  },
  {
    id: "rigged",
    emoji: "🎰",
    title: "Most Rigged-Looking Dice",
    kind: "cohort",
    score: (m) => Math.max(chiSquareUniform(m.red_freq), chiSquareUniform(m.white_freq)),
    blurb: (m) => {
      const f = mostLoadedFace(m);
      return `Your ${f.die} die landed on ${f.face} ${f.count} times. Fair dice say ${round1(f.expected)}.`;
    },
  },
  {
    id: "chaos_agent",
    emoji: "🌪️",
    title: "Chaos Agent",
    kind: "cohort",
    score: (m) => m.distinct_combos / expectedDistinctCombos(m.rolls),
    blurb: (m) => `${m.distinct_combos} different combos in ${m.rolls} rolls. Never the same night twice.`,
  },
  {
    id: "predictable",
    emoji: "🤖",
    title: "Most Predictable",
    kind: "cohort",
    score: (m) => -(m.distinct_combos / expectedDistinctCombos(m.rolls)),
    blurb: (m) =>
      `Only ${m.distinct_combos} different combos in ${m.rolls} rolls. Fair dice would give about ${Math.round(
        expectedDistinctCombos(m.rolls)
      )}.`,
  },
  {
    id: "accountant",
    emoji: "🧮",
    title: "The Accountant",
    kind: "cohort",
    score: (m) =>
      m.nights >= 8 && m.gap_mean && m.gap_sd != null ? -(m.gap_sd / m.gap_mean) : null,
    blurb: (m) =>
      `Rolled every ${round1(m.gap_mean ?? 0)} days, give or take ${round1(m.gap_sd ?? 0)}. Set your watch by it.`,
  },
  {
    id: "clockwork",
    emoji: "⏰",
    title: "Clockwork",
    kind: "cohort",
    minRolls: CLOCKWORK_MIN_ROLLS,
    // Narrowest time-of-day window wins. night_min runs from 5 AM, so a roll
    // after midnight sorts after the evening ones and the window never wraps.
    score: (m) =>
      m.min_night_min == null || m.max_night_min == null ? null : -(m.max_night_min - m.min_night_min),
    blurb: (m) =>
      `All ${m.rolls} rolls landed between ${formatNightMinutes(m.min_night_min ?? 0)} and ${formatNightMinutes(
        m.max_night_min ?? 0
      )}. Same window, every time.`,
  },
  {
    id: "peer_pressure",
    emoji: "👥",
    title: "Peer Pressure Award",
    kind: "cohort",
    score: (m) => m.with_company / m.rolls,
    blurb: (m) =>
      `${Math.round((m.with_company / m.rolls) * 100)}% of rolls came within 30 minutes of someone else's.`,
  },
  {
    id: "lone_wolf",
    emoji: "🐺",
    title: "Lone Wolf",
    kind: "cohort",
    score: (m) => (m.solo_nights > 0 ? m.solo_nights / m.nights : null),
    blurb: (m) => `${m.solo_nights} ${m.solo_nights === 1 ? "night" : "nights"} where nobody else rolled.`,
  },
  {
    id: "third_wheel",
    emoji: "🛞",
    title: "The Third Wheel",
    kind: "cohort",
    score: (m) => (m.third_wheel_nights > 0 ? m.third_wheel_nights / m.nights : null),
    blurb: (m) => `Showed up third to the party ${m.third_wheel_nights} times.`,
  },
  {
    id: "ghost",
    emoji: "👻",
    title: "The Ghost",
    kind: "cohort",
    score: (m) => (m.max_gap && m.max_gap >= 14 ? m.max_gap : null),
    blurb: (m) =>
      `Vanished for ${m.max_gap} days, then came back with ${
        m.max_gap_return?.white_name ? `a ${m.max_gap_return.white_name}` : "a vengeance"
      }.`,
  },
  {
    id: "hype_man",
    emoji: "📣",
    title: "Hype Man",
    kind: "cohort",
    score: (m) => (m.likes_given >= 5 ? Math.log((m.likes_given + 1) / (m.likes_received + 1)) : null),
    blurb: (m) => `Gave ${m.likes_given} likes, got ${m.likes_received}.`,
  },
  {
    id: "crowd_favorite",
    emoji: "❤️",
    title: "Crowd Favorite",
    kind: "cohort",
    score: (m) => (m.likes_received > 0 ? m.likes_received / m.rolls : null),
    blurb: (m) => `${round1(m.likes_received / m.rolls)} likes per roll. The people love you.`,
  },
  {
    id: "closing_time",
    emoji: "🌙",
    title: "Closing Time",
    kind: "cohort",
    score: (m) => m.avg_night_min,
    blurb: (m) => `Average roll at ${formatNightMinutes(m.avg_night_min ?? 0)}. Last call is a suggestion.`,
  },
  {
    id: "early_bird",
    emoji: "🌅",
    title: "Early Bird",
    kind: "cohort",
    score: (m) => (m.avg_night_min == null ? null : -m.avg_night_min),
    blurb: (m) => `Average roll at ${formatNightMinutes(m.avg_night_min ?? 0)}. Home before the chaos.`,
  },
  {
    id: "monday_menace",
    emoji: "📅",
    title: "Monday Menace",
    kind: "cohort",
    score: (m) => (m.monday_nights > 0 ? m.monday_nights / m.nights : null),
    blurb: (m) => `${m.monday_nights} of your ${m.nights} nights were Mondays.`,
  },
  {
    id: "spooky",
    emoji: "🎃",
    title: "Spookiest Roller",
    kind: "cohort",
    score: (m) => (m.spooky > 0 ? m.spooky / m.rolls : null),
    blurb: (m) => `${m.spooky} rolls on the Halloween menu. Boo.`,
  },
];

/** Given to an eligible roller when no award is a positive fit. */
export const FALLBACK_AWARD = {
  id: "certified_regular",
  emoji: "🎲",
  title: "Certified Regular",
  blurb: "Showed up, rolled dice, no notes.",
} as const;

export interface Superlative {
  user_id: string;
  username: string;
  award_id: string;
  emoji: string;
  title: string;
  blurb: string;
  /** Comparable z-ish score that won the award (null for the fallback). */
  score: number | null;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const mu = mean(xs);
  return Math.sqrt(xs.reduce((acc, x) => acc + (x - mu) * (x - mu), 0) / (xs.length - 1));
}

/**
 * The yearbook rule. Score every eligible roller on every award, make the
 * scores comparable (fair-dice z, or z within the cohort), then hand out
 * awards greedily from the strongest score down. Nobody gets two awards and
 * no award goes to two people. Rollers at or above `SUPERLATIVE_MIN_ROLLS` who
 * are left over get the fallback; a roller below it only appears by winning an
 * award with a lower floor (Clockwork).
 */
export function assignSuperlatives(metrics: RollerMetrics[]): Superlative[] {
  const eligible = metrics.filter((m) => m.rolls >= SUPERLATIVE_MIN_ROLLS);

  type Candidate = { m: RollerMetrics; award: AwardDef; score: number };
  const candidates: Candidate[] = [];

  for (const award of AWARDS) {
    // Each award has its own roll floor (Clockwork takes 8+), so it can crown a
    // roller who is below the general floor. Everyone else needs `eligible`.
    const floor = award.minRolls ?? SUPERLATIVE_MIN_ROLLS;
    const raw = metrics
      .filter((m) => m.rolls >= floor)
      .map((m) => ({ m, v: award.score(m) }))
      .filter((x): x is { m: RollerMetrics; v: number } => x.v != null && Number.isFinite(x.v));
    if (raw.length === 0) continue;

    if (award.kind === "z") {
      raw.forEach(({ m, v }) => candidates.push({ m, award, score: v }));
    } else {
      // Need a few people to compare against, and some spread.
      if (raw.length < 3) continue;
      const vs = raw.map((x) => x.v);
      const mu = mean(vs);
      const s = sd(vs);
      if (s === 0) continue;
      raw.forEach(({ m, v }) => candidates.push({ m, award, score: (v - mu) / s }));
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.m.username.localeCompare(b.m.username));

  const takenUsers = new Set<string>();
  const takenAwards = new Set<string>();
  const result: Superlative[] = [];

  for (const c of candidates) {
    if (c.score <= 0) break;
    if (takenUsers.has(c.m.user_id) || takenAwards.has(c.award.id)) continue;
    takenUsers.add(c.m.user_id);
    takenAwards.add(c.award.id);
    result.push({
      user_id: c.m.user_id,
      username: c.m.username,
      award_id: c.award.id,
      emoji: c.award.emoji,
      title: c.award.title,
      blurb: c.award.blurb(c.m),
      score: c.score,
    });
  }

  for (const m of eligible) {
    if (takenUsers.has(m.user_id)) continue;
    result.push({
      user_id: m.user_id,
      username: m.username,
      award_id: FALLBACK_AWARD.id,
      emoji: FALLBACK_AWARD.emoji,
      title: FALLBACK_AWARD.title,
      blurb: FALLBACK_AWARD.blurb,
      score: null,
    });
  }

  // Display order follows the award list so the yearbook reads consistently.
  const order = new Map(AWARDS.map((a, i) => [a.id, i]));
  return result.sort(
    (a, b) => (order.get(a.award_id) ?? AWARDS.length) - (order.get(b.award_id) ?? AWARDS.length)
  );
}

// ─── Persona closer ──────────────────────────────────────────

export interface Persona {
  title: string;
  emoji: string;
  line: string;
}

export function pickPersona(p: WrappedPersonal): Persona {
  const n = p.total_rolls;
  const topDay = WEEKDAYS[argMax(p.dow_nights)];
  const luckZ = binomialZ(p.doubles, n, P_DOUBLES);
  const malortZ = binomialZ(p.malort, n, P_FACE);
  const weekend = p.nights > 0 ? (p.dow_nights[5] + p.dow_nights[6]) / p.nights : 0;
  const lateShare = n > 0 ? p.after_midnight / n : 0;
  const sigShare = n > 0 && p.signature_combo?.count ? p.signature_combo.count / n : 0;

  if (n === 0) {
    return { title: "THE MYSTERY GUEST", emoji: "🕵️", line: "No rolls this year. The dice miss you." };
  }
  if (malortZ >= 1.5) {
    return {
      title: "THE MALÖRT MARTYR",
      emoji: "🥃",
      line: `${luckZ >= 0 ? "Lucky with doubles" : "Unlucky with doubles"}, cursed by the white die, and back every ${topDay}.`,
    };
  }
  if (luckZ >= 1.5) {
    return { title: "THE HIGH ROLLER", emoji: "🎰", line: `The dice bend for you. Especially on ${topDay}s.` };
  }
  if (luckZ <= -1.5) {
    return { title: "THE CURSED ONE", emoji: "🐈‍⬛", line: "The dice owe you. Come collect next year." };
  }
  if (p.around_the_world.done_at != null || p.combos_seen >= 48) {
    return { title: "THE COMPLETIONIST", emoji: "🌎", line: "Gotta roll 'em all. And you nearly did." };
  }
  if (lateShare >= 0.3) {
    return { title: "THE NIGHT OWL", emoji: "🦉", line: "Nothing good happens after midnight. Except your rolls." };
  }
  if (weekend >= 0.5) {
    return { title: "THE WEEKEND WARRIOR", emoji: "🛡️", line: "Fridays and Saturdays belong to you." };
  }
  if (sigShare >= 0.08) {
    return { title: "THE REGULAR", emoji: "🍺", line: "Same combo, same stool, same energy." };
  }
  if ((p.longest_drought?.days ?? 0) >= 45) {
    return { title: "THE GHOST", emoji: "👻", line: "Here one night, gone for a month. Always comes back." };
  }
  return { title: "THE WILDCARD", emoji: "🃏", line: `No pattern, no plan. See you ${topDay}.` };
}

// ─── The Pour (ounces) ───────────────────────────────────────

/** Returned by `get_wrapped_pour` (migration 076): the one count the other RPCs lack. */
export interface WrappedPour {
  personal_daily_doubles: number;
  bar_daily_doubles: number;
}

export const OZ_BEER = 12;
export const OZ_DAILY_DOUBLE_BEER = 16;
export const OZ_SHOT = 1.5;
export const OZ_PER_GALLON = 128;

export interface Pour {
  beer: number;
  dailyDouble: number;
  shots: number;
  total: number;
}

/**
 * Ounces for `rolls` rolls, `dailyDoubles` of which took the Daily Double.
 * Every roll is one beer plus one shot; a Daily Double swaps the 12 oz beer
 * for a 16 oz one (the shot stays 1.5 oz).
 */
export function pourOunces(rolls: number, dailyDoubles: number): Pour {
  const dd = Math.min(Math.max(dailyDoubles, 0), rolls);
  const beer = (rolls - dd) * OZ_BEER;
  const dailyDouble = dd * OZ_DAILY_DOUBLE_BEER;
  const shots = rolls * OZ_SHOT;
  return { beer, dailyDouble, shots, total: beer + dailyDouble + shots };
}

export type VesselId =
  | "mug"
  | "pint"
  | "gulp"
  | "pitcher"
  | "jug"
  | "toilet"
  | "bucket"
  | "keg"
  | "tub"
  | "hottub";

export interface Vessel {
  id: VesselId;
  one: string;
  many: string;
  oz: number;
}

/**
 * The ladder, smallest to largest. One roll is 13.5 oz, so it starts at a
 * mug; real rollers top out around a keg and the bar as a whole around a
 * bathtub. Mug, bathtub and hot tub sizes are typical, not exact.
 */
export const VESSELS: readonly Vessel[] = [
  { id: "mug", one: "coffee mug", many: "coffee mugs", oz: 12 },
  { id: "pint", one: "pint glass", many: "pint glasses", oz: 16 },
  { id: "gulp", one: "Big Gulp", many: "Big Gulps", oz: 32 },
  { id: "pitcher", one: "pitcher", many: "pitchers", oz: 60 },
  { id: "jug", one: "gallon of milk", many: "gallons of milk", oz: OZ_PER_GALLON },
  { id: "toilet", one: "toilet flush", many: "toilet flushes", oz: 1.6 * OZ_PER_GALLON },
  { id: "bucket", one: "5-gallon bucket", many: "5-gallon buckets", oz: 5 * OZ_PER_GALLON },
  { id: "keg", one: "half-barrel keg", many: "half-barrel kegs", oz: 15.5 * OZ_PER_GALLON },
  { id: "tub", one: "bathtub", many: "bathtubs", oz: 40 * OZ_PER_GALLON },
  { id: "hottub", one: "hot tub", many: "hot tubs", oz: 400 * OZ_PER_GALLON },
];

/** The biggest vessel `oz` fills at least once (the mug if it doesn't fill even that). */
export function pickVessel(oz: number): Vessel {
  let best = VESSELS[0];
  for (const v of VESSELS) if (oz / v.oz >= 1) best = v;
  return best;
}

/** Three rungs below the pick, the pick, and one "just short" rung above it. */
export function vesselLadder(oz: number): { best: Vessel; rows: Vessel[] } {
  const best = pickVessel(oz);
  const i = VESSELS.indexOf(best);
  return { best, rows: VESSELS.slice(Math.max(0, i - 3), Math.min(VESSELS.length, i + 2)) };
}

/** "1.1", "17.3", "1,234", or "<0.1" for a count too small to read. */
export function formatVesselCount(n: number): string {
  if (n < 0.1) return "<0.1";
  return n >= 100 ? Math.round(n).toLocaleString() : round1(n);
}
