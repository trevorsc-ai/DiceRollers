import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadAchievementsForRolls,
  loadTwinsForRolls,
  type EarnedAchievement,
} from "@/lib/rollAchievements";

export const PAGE_SIZE = 50;

/** Shared roll body shape used by feed and history list items. */
export interface BaseRoll {
  id: number;
  roll_time: string;
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  red_drink_logo: string | null;
  white_drink_logo: string | null;
  is_doubles: boolean;
  is_daily_double: boolean;
  achievements: EarnedAchievement[];
  twinPartners: string[];
}

export interface FeedRoll extends BaseRoll {
  user_id: string;
  username: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface HistoryRoll extends BaseRoll {
  roll_date: string;
  rollNumber: number;
}

export interface RollsPage<T> {
  items: T[];
  nextCursor: string | null;
}

interface RawFeedRow {
  id: number;
  roll_time: string;
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  red_drink_logo: string | null;
  white_drink_logo: string | null;
  is_doubles: boolean;
  is_daily_double: boolean | null;
  user_id: string;
  profiles: { username: string | null } | { username: string | null }[] | null;
  roll_likes: { user_id: string }[] | null;
}

function readUsername(profiles: RawFeedRow["profiles"]): string {
  const row = Array.isArray(profiles) ? profiles[0] : profiles;
  return row?.username ?? "anonymous";
}

/**
 * Fetch one page of the global feed. `cursor` is the `roll_time` of the last
 * item from the previous page (null for the first page).
 */
export async function fetchFeedPage(
  supabase: SupabaseClient,
  myUserId: string | null,
  cursor: string | null
): Promise<RollsPage<FeedRoll>> {
  let query = supabase
    .from("rolls")
    .select(`
      id, roll_time, red_die_number, white_die_number,
      red_drink_name, white_drink_name, red_drink_logo, white_drink_logo,
      is_doubles, is_daily_double, user_id,
      profiles!inner(username),
      roll_likes(user_id)
    `)
    .order("roll_time", { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) query = query.lt("roll_time", cursor);

  const { data } = await query;
  const rows = ((data ?? []) as unknown) as RawFeedRow[];
  if (rows.length === 0) return { items: [], nextCursor: null };

  const rollIds = rows.map((r) => r.id);
  const [achievementsByRoll, twinsByRoll] = await Promise.all([
    loadAchievementsForRolls(supabase, rollIds),
    loadTwinsForRolls(supabase, rollIds),
  ]);

  const items: FeedRoll[] = rows.map((r) => ({
    id: r.id,
    roll_time: r.roll_time,
    red_die_number: r.red_die_number,
    white_die_number: r.white_die_number,
    red_drink_name: r.red_drink_name,
    white_drink_name: r.white_drink_name,
    red_drink_logo: r.red_drink_logo,
    white_drink_logo: r.white_drink_logo,
    is_doubles: r.is_doubles,
    is_daily_double: r.is_daily_double ?? false,
    user_id: r.user_id,
    username: readUsername(r.profiles),
    likeCount: r.roll_likes?.length ?? 0,
    likedByMe: r.roll_likes?.some((l) => l.user_id === myUserId) ?? false,
    achievements: achievementsByRoll[r.id] ?? [],
    twinPartners: twinsByRoll[r.id] ?? [],
  }));

  const lastTime = items[items.length - 1].roll_time;
  return { items, nextCursor: rows.length < PAGE_SIZE ? null : lastTime };
}

export const unseenLikesQueryKey = (userId: string, sinceIso: string) =>
  ["unseenLikes", userId, sinceIso] as const;

/**
 * Count of likes received on this user's rolls since `sinceIso`,
 * excluding self-likes. HEAD request — no rows returned, just the count.
 */
export async function fetchUnseenLikesCount(
  supabase: SupabaseClient,
  userId: string,
  sinceIso: string
): Promise<number> {
  const { count } = await supabase
    .from("roll_likes")
    .select("id, rolls!inner(user_id)", { count: "exact", head: true })
    .eq("rolls.user_id", userId)
    .neq("user_id", userId)
    .gt("created_at", sinceIso);
  return count ?? 0;
}

export interface HistoryFilters {
  search: string;
  doublesOnly: boolean;
  achievementsOnly: boolean;
  twinsiesOnly: boolean;
  dateFrom: string;
  dateTo: string;
}

/** Empty default filter set — used by the server prefetch path. */
export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  search: "",
  doublesOnly: false,
  achievementsOnly: false,
  twinsiesOnly: false,
  dateFrom: "",
  dateTo: "",
};

export const historyQueryKey = (userId: string, filters: HistoryFilters) =>
  ["history", userId, filters] as const;

export const historyTotalQueryKey = (userId: string) =>
  ["historyTotal", userId] as const;

interface RawHistoryRow {
  id: number;
  roll_date: string;
  roll_time: string;
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  red_drink_logo: string | null;
  white_drink_logo: string | null;
  is_doubles: boolean;
  is_daily_double: boolean | null;
  user_roll_number: number;
}

// Supabase's .or() filter syntax uses ',' '(' ')' as separators and '%' '_'
// as LIKE wildcards. Strip them so a search box can't break the query.
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()"\\%_]/g, "").trim();
}

export async function fetchHistoryPage(
  supabase: SupabaseClient,
  userId: string,
  filters: HistoryFilters,
  cursor: string | null
): Promise<RollsPage<HistoryRoll>> {
  const q = sanitizeSearch(filters.search);
  let query = supabase
    .from("rolls_with_flags")
    .select("*")
    .eq("user_id", userId)
    .order("roll_time", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) query = query.lt("roll_time", cursor);
  if (filters.doublesOnly) query = query.eq("is_doubles", true);
  if (filters.achievementsOnly) query = query.eq("has_achievement", true);
  if (filters.twinsiesOnly) query = query.eq("has_twin", true);
  if (filters.dateFrom) query = query.gte("roll_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("roll_date", filters.dateTo);
  if (q) query = query.or(`red_drink_name.ilike.%${q}%,white_drink_name.ilike.%${q}%`);

  const { data } = await query;
  const rows = ((data ?? []) as unknown) as RawHistoryRow[];
  if (rows.length === 0) return { items: [], nextCursor: null };

  const rollIds = rows.map((r) => r.id);
  const [achievementsByRoll, twinsByRoll] = await Promise.all([
    loadAchievementsForRolls(supabase, rollIds),
    loadTwinsForRolls(supabase, rollIds),
  ]);

  const items: HistoryRoll[] = rows.map((r) => ({
    id: r.id,
    roll_date: r.roll_date,
    roll_time: r.roll_time,
    red_die_number: r.red_die_number,
    white_die_number: r.white_die_number,
    red_drink_name: r.red_drink_name,
    white_drink_name: r.white_drink_name,
    red_drink_logo: r.red_drink_logo,
    white_drink_logo: r.white_drink_logo,
    is_doubles: r.is_doubles,
    is_daily_double: r.is_daily_double ?? false,
    achievements: achievementsByRoll[r.id] ?? [],
    twinPartners: twinsByRoll[r.id] ?? [],
    rollNumber: r.user_roll_number,
  }));

  const lastTime = items[items.length - 1].roll_time;
  return { items, nextCursor: rows.length < PAGE_SIZE ? null : lastTime };
}
