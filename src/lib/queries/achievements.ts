import type { SupabaseClient } from "@supabase/supabase-js";
import type { TwinsiesEvent } from "@/lib/twinsies";

export interface AchievementRow {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  category_name: string;
  category_emoji: string;
  target_count: number | null;
  sort_order: number;
  hidden: boolean;
}

export interface UserAchievementRow {
  achievement_id: string;
  progress: number;
  progress_detail: {
    red?: number[];
    white?: number[];
    numbers?: number[];
    combos?: string[];
    credited_events?: TwinsiesEvent[];
  } | null;
  completed_at: string | null;
  times_completed?: number;
  cycle_roll_count?: number;
}

export interface PunchCardInstance {
  n: number;
  rolls: number | null;
}

export interface AchievementWithProgress extends AchievementRow {
  progress: number;
  progress_detail: UserAchievementRow["progress_detail"];
  completed_at: string | null;
  times_completed: number;
  cycle_roll_count: number;
  punch_card_history?: PunchCardInstance[];
}

export interface AchievementsPageData {
  achievements: AchievementWithProgress[];
  rarityByAchievement: Record<string, number>;
}

/** Query key for the achievements page — keep stable across client + server. */
export const achievementsPageQueryKey = (userId: string) =>
  ["achievementsPage", userId] as const;

/**
 * Loads the achievements catalog joined with the user's progress, rarity
 * counts, and punch-card history. Used by both the client `useQuery` and
 * the server prefetch on the achievements page.
 *
 * Returns a plain object (no Maps) so the result can be safely dehydrated
 * for server-to-client hydration.
 */
export async function fetchAchievementsPage(
  supabase: SupabaseClient,
  userId: string
): Promise<AchievementsPageData> {
  const [
    { data: allAchievements },
    { data: userProgress },
    { data: rarityData },
    { data: punchHistory },
  ] = await Promise.all([
    supabase.from("achievements").select("*").order("sort_order"),
    supabase
      .from("user_achievements")
      .select("achievement_id, progress, progress_detail, completed_at, times_completed, cycle_roll_count")
      .eq("user_id", userId),
    supabase.rpc("get_achievement_rarity"),
    supabase
      .from("punch_card_completions")
      .select("completion_number, rolls_to_complete")
      .eq("user_id", userId)
      .order("completion_number", { ascending: false }),
  ]);

  if (!allAchievements) return { achievements: [], rarityByAchievement: {} };

  const progressMap = new Map<string, UserAchievementRow>(
    ((userProgress ?? []) as UserAchievementRow[]).map((ua) => [ua.achievement_id, ua])
  );

  const rarityByAchievement: Record<string, number> = {};
  for (const r of (rarityData ?? []) as { achievement_id: string; unlock_count: number | string }[]) {
    rarityByAchievement[r.achievement_id] = Number(r.unlock_count);
  }

  const punchCardHistory: PunchCardInstance[] = (
    (punchHistory ?? []) as { completion_number: number; rolls_to_complete: number | null }[]
  ).map((row) => ({
    n: row.completion_number,
    rolls: row.rolls_to_complete ?? null,
  }));

  const achievements: AchievementWithProgress[] = (allAchievements as AchievementRow[]).map((a) => {
    const ua = progressMap.get(a.id);
    return {
      ...a,
      progress: ua?.progress ?? 0,
      progress_detail: ua?.progress_detail ?? null,
      completed_at: ua?.completed_at ?? null,
      times_completed: ua?.times_completed ?? 0,
      cycle_roll_count: ua?.cycle_roll_count ?? 0,
      punch_card_history: a.id === "the_punch_card" ? punchCardHistory : undefined,
    };
  });

  return { achievements, rarityByAchievement };
}
