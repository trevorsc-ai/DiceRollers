import type { SupabaseClient } from "@supabase/supabase-js";

export interface DashboardStats {
  total_users: number;
  public_users: number;
  oath_users: number;
  dau: number;
  wau: number;
  mau: number;
  total_rolls: number;
  rolls_last_7d: number;
  rolls_last_30d: number;
  signups_by_day: { day: string; count: number }[];
  dau_by_day: { day: string; count: number }[];
  rolls_by_day: { day: string; count: number }[];
  user_growth_by_week: { week: string; new_users: number; cumulative: number }[];
  top_users_30d: { username: string; rolls: number }[];
}

export const ADMIN_DASHBOARD_KEY = ["adminDashboard"] as const;

export async function fetchAdminDashboard(
  supabase: SupabaseClient
): Promise<DashboardStats | null> {
  const { data, error } = await supabase.rpc("get_admin_dashboard_stats");
  if (error || !data) return null;
  return data as DashboardStats;
}
