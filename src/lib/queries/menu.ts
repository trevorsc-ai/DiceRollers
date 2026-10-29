import type { SupabaseClient } from "@supabase/supabase-js";

export type MenuSet = "regular" | "halloween" | "archived";

export interface MenuItem {
  id: number;
  die_color: "red" | "white" | "daily_double";
  die_number: number;
  drink_name: string;
  logo_url: string | null;
  is_active: boolean;
  menu_set: MenuSet;
}

// Every menu key starts with "menuItems" so invalidating ["menuItems"]
// refreshes both the roll page and the admin page.
export const activeMenuQueryKey = () => ["menuItems", "active"] as const;
export const adminMenuQueryKey = () => ["menuItems", "admin"] as const;

/** Active menu rows used for rolling. */
export async function fetchActiveMenu(supabase: SupabaseClient): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, die_color, die_number, drink_name, logo_url, is_active, menu_set")
    .eq("is_active", true)
    .order("die_number");
  if (error) throw error;
  return (data as MenuItem[]) ?? [];
}

/** Every editable row (regular + halloween, active or not) for /admin/menu. */
export async function fetchAdminMenu(supabase: SupabaseClient): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, die_color, die_number, drink_name, logo_url, is_active, menu_set")
    .neq("menu_set", "archived")
    .order("die_number");
  if (error) throw error;
  return (data as MenuItem[]) ?? [];
}

/** Halloween mode is on whenever a Halloween row is active. */
export function isHalloweenMenu(items: Pick<MenuItem, "is_active" | "menu_set">[]): boolean {
  return items.some((m) => m.is_active && m.menu_set === "halloween");
}

/** Server-side check used by the roll API to reject stale Daily Double saves. */
export async function fetchIsHalloweenActive(supabase: SupabaseClient): Promise<boolean> {
  const { count, error } = await supabase
    .from("menu_items")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("menu_set", "halloween");
  if (error) throw error;
  return (count ?? 0) > 0;
}
