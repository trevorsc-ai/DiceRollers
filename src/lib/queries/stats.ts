import type { SupabaseClient } from "@supabase/supabase-js";
import type { PodiumLeaderboardData, PodiumRoller } from "@/components/PodiumLeaderboard";
import {
  SUPERLATIVE_MIN_ROLLS,
  wrappedWindow,
  type WrappedGlobal,
  type WrappedPersonal,
} from "@/lib/wrapped";

/** Shared stats shape returned by both RPCs. */
export interface StatsShape {
  total_rolls: number;
  total_doubles: number;
  red_die_freq: Record<string, number>;
  white_die_freq: Record<string, number>;
  top_beers: { drink_name: string; count: number }[];
  top_shots: { drink_name: string; count: number }[];
  day_of_week: { day_num: number; count: number }[];
  current_streak?: number;
  leaderboard?: { username: string; count: number; flair: string[] }[];
}

export interface PunchCardClubMember {
  rank: number;
  user: string;
  cardNumber: number;
  rolls: number;
  you: boolean;
}

export interface GlobalStatsPageData {
  stats: StatsShape | null;
  club: { members: PunchCardClubMember[]; total: number; completions: number };
  podium: PodiumLeaderboardData | null;
}

export const personalStatsQueryKey = (userId: string) =>
  ["personalStats", userId] as const;

export const globalStatsQueryKey = ["globalStats"] as const;

export async function fetchPersonalStats(
  supabase: SupabaseClient,
  userId: string
): Promise<StatsShape | null> {
  const { data, error } = await supabase.rpc("get_personal_stats", { target_user_id: userId });
  if (error || !data) return null;
  return data as StatsShape;
}

export async function fetchGlobalStatsPage(
  supabase: SupabaseClient,
  currentUserId: string | null
): Promise<GlobalStatsPageData> {
  // Wrap each RPC so one failure doesn't blank the whole page. The consumers
  // below already null-check stats/club/podium independently.
  const safe = async <T,>(p: PromiseLike<{ data: T | null; error: unknown }>) => {
    try {
      return await p;
    } catch {
      return { data: null, error: null };
    }
  };

  const [{ data, error }, { data: clubData }, { data: podiumRaw }] = await Promise.all([
    safe(supabase.rpc("get_global_stats")),
    safe(supabase.rpc("get_punch_card_club")),
    safe(supabase.rpc("get_podium_leaderboard")),
  ]);

  const stats = !error && data ? (data as StatsShape) : null;

  type ClubRow = {
    user_id: string;
    username: string;
    completion_number: number;
    best_rolls: number;
    earned_at: string;
    total_members: number;
    total_completions: number;
  };
  const club = (() => {
    const rows = (clubData ?? []) as ClubRow[];
    if (rows.length === 0) return { members: [] as PunchCardClubMember[], total: 0, completions: 0 };
    return {
      members: rows.map((row, idx) => ({
        rank: idx + 1,
        user: row.username,
        cardNumber: row.completion_number,
        rolls: row.best_rolls,
        you: row.user_id === currentUserId,
      })),
      total: Number(rows[0].total_members),
      completions: Number(rows[0].total_completions),
    };
  })();

  const podium = (() => {
    if (!podiumRaw) return null;
    const raw = podiumRaw as PodiumLeaderboardData & {
      rollers: (PodiumRoller & { user_id: string })[];
    };
    return {
      ...raw,
      rollers: raw.rollers.map((r) => ({ ...r, you: r.user_id === currentUserId })),
    };
  })();

  return { stats, club, podium };
}

/* ── Punch Card Club: full roster (members + every completion) ─────── */

export interface PunchCardCompletionRow {
  userId: string;
  username: string;
  cardNumber: number;
  rolls: number;
  earnedAt: string;
}

export interface PunchCardClubRosterMember {
  userId: string;
  username: string;
  completions: number;
  bestRolls: number;
  lastEarnedAt: string;
}

export interface PunchCardClubRoster {
  /** Every completion, fastest first (same order as the club leaderboard). */
  completions: PunchCardCompletionRow[];
  /** One row per member, most completions first, then fastest card. */
  members: PunchCardClubRosterMember[];
}

export const punchCardClubRosterQueryKey = ["punchCardClubRoster"] as const;

export async function fetchPunchCardClubRoster(
  supabase: SupabaseClient
): Promise<PunchCardClubRoster> {
  // Same filter as get_punch_card_club() so counts line up with the header.
  const { data, error } = await supabase
    .from("punch_card_completions")
    .select("user_id, completion_number, rolls_to_complete, earned_at, profiles(username)")
    .not("rolls_to_complete", "is", null)
    .order("rolls_to_complete", { ascending: true })
    .order("earned_at", { ascending: true });

  if (error) {
    console.error("[fetchPunchCardClubRoster] failed to load completions", error);
    throw error;
  }

  type Row = {
    user_id: string;
    completion_number: number;
    rolls_to_complete: number;
    earned_at: string;
    profiles: { username: string } | { username: string }[] | null;
  };

  const completions: PunchCardCompletionRow[] = ((data ?? []) as Row[]).map((r) => {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      userId: r.user_id,
      username: profile?.username ?? "unknown",
      cardNumber: r.completion_number,
      rolls: r.rolls_to_complete,
      earnedAt: r.earned_at,
    };
  });

  const byUser = new Map<string, PunchCardClubRosterMember>();
  for (const c of completions) {
    const m = byUser.get(c.userId);
    if (!m) {
      byUser.set(c.userId, {
        userId: c.userId,
        username: c.username,
        completions: 1,
        bestRolls: c.rolls,
        lastEarnedAt: c.earnedAt,
      });
    } else {
      m.completions += 1;
      m.bestRolls = Math.min(m.bestRolls, c.rolls);
      if (c.earnedAt > m.lastEarnedAt) m.lastEarnedAt = c.earnedAt;
    }
  }

  const members = Array.from(byUser.values()).sort(
    (a, b) => b.completions - a.completions || a.bestRolls - b.bestRolls
  );

  return { completions, members };
}

/* ── Wrapped (year-in-review) ────────────────────────────────────── */

export const wrappedQueryKey = (userId: string, year: number) => ["wrapped", userId, year] as const;
export const wrappedGlobalQueryKey = (year: number) => ["wrappedGlobal", year] as const;

/** One roller's year. Shape documented in `WrappedPersonal`. */
export async function fetchWrapped(
  supabase: SupabaseClient,
  userId: string,
  year: number
): Promise<WrappedPersonal> {
  const { start, end } = wrappedWindow(year);
  const { data, error } = await supabase.rpc("get_wrapped", { p_user: userId, p_start: start, p_end: end });
  if (error) {
    console.error("[fetchWrapped] get_wrapped failed", { userId, year, error });
    throw error;
  }
  return data as WrappedPersonal;
}

/** Bar-wide year, the Heavyweight head-to-head, and superlative metrics. */
export async function fetchWrappedGlobal(supabase: SupabaseClient, year: number): Promise<WrappedGlobal> {
  const { start, end } = wrappedWindow(year);
  const { data, error } = await supabase.rpc("get_wrapped_global", {
    p_start: start,
    p_end: end,
    p_min_rolls: SUPERLATIVE_MIN_ROLLS,
  });
  if (error) {
    console.error("[fetchWrappedGlobal] get_wrapped_global failed", { year, error });
    throw error;
  }
  return data as WrappedGlobal;
}

/* ── App flags (admin-controlled switches, e.g. `wrapped_live`) ──── */

export type AppFlagKey = "wrapped_live";

export const appFlagQueryKey = (key: AppFlagKey) => ["appFlag", key] as const;

export async function fetchAppFlag(supabase: SupabaseClient, key: AppFlagKey): Promise<boolean> {
  const { data, error } = await supabase.from("app_flags").select("enabled").eq("key", key).maybeSingle();
  if (error) {
    console.error("[fetchAppFlag] failed to read flag", { key, error });
    throw error;
  }
  return data?.enabled ?? false;
}
