import type { SupabaseClient } from "@supabase/supabase-js";

export interface EarnedAchievement {
  name: string;
  emoji: string;
  category_emoji: string;
  category_name: string;
}

// Loads the achievement pills that should be displayed on each roll in the
// given set. Centralises the "punch card lives in a second table" rule so
// every roll-list surface (feed, history, …) stays in sync. Without this,
// surfaces that only read user_achievements miss every Punch Card
// completion — its row there is reset to completed_at = NULL after each
// cycle and earned_on_roll_id is later overwritten.
export async function loadAchievementsForRolls(
  supabase: SupabaseClient,
  rollIds: number[]
): Promise<Record<number, EarnedAchievement[]>> {
  if (rollIds.length === 0) return {};

  const [{ data: userAchievements }, { data: punchCardCompletions }] = await Promise.all([
    supabase
      .from("user_achievements")
      .select("earned_on_roll_id, achievements(id, name, emoji, category_emoji, category_name)")
      .in("earned_on_roll_id", rollIds)
      .not("completed_at", "is", null),
    supabase
      .from("punch_card_completions")
      .select("earned_on_roll_id, completion_number")
      .in("earned_on_roll_id", rollIds),
  ]);

  const byRoll: Record<number, EarnedAchievement[]> = {};

  // Supabase's inferred join type is awkward for nested selects; narrow it
  // explicitly at the boundary instead of `any`.
  type JoinedAchievement = {
    id: string;
    name: string;
    emoji: string;
    category_emoji: string;
    category_name: string;
  };
  type AchievementRow = {
    earned_on_roll_id: number | null;
    achievements: JoinedAchievement | JoinedAchievement[] | null;
  };

  for (const row of (userAchievements ?? []) as unknown as AchievementRow[]) {
    const a = Array.isArray(row.achievements) ? row.achievements[0] : row.achievements;
    if (!a || !row.earned_on_roll_id) continue;
    // Twinsies renders via its own dedicated partner badge.
    if (a.id === "twinsies") continue;
    (byRoll[row.earned_on_roll_id] ??= []).push({
      name: a.name,
      emoji: a.emoji,
      category_emoji: a.category_emoji,
      category_name: a.category_name,
    });
  }

  for (const row of punchCardCompletions ?? []) {
    if (!row.earned_on_roll_id) continue;
    (byRoll[row.earned_on_roll_id] ??= []).push({
      name: "The Punch Card",
      emoji: "👊",
      category_emoji: "💎",
      category_name: "You're a Regular",
    });
  }

  return byRoll;
}

export async function loadTwinsForRolls(
  supabase: SupabaseClient,
  rollIds: number[]
): Promise<Record<number, string[]>> {
  if (rollIds.length === 0) return {};
  const { data } = await supabase
    .from("rolls_with_twins")
    .select("id, twin_partners")
    .in("id", rollIds);

  const byRoll: Record<number, string[]> = {};
  for (const row of (data ?? []) as Array<{ id: number; twin_partners: string[] | null }>) {
    if (row.twin_partners && row.twin_partners.length > 0) {
      byRoll[row.id] = row.twin_partners;
    }
  }
  return byRoll;
}
