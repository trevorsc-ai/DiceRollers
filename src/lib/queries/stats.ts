import type { SupabaseClient } from "@supabase/supabase-js";
import type { PodiumLeaderboardData, PodiumRoller } from "@/components/PodiumLeaderboard";

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
