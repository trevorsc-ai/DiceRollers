"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface DailyDoubleLogos {
  beer: string | null;
  shot: string | null;
}

const EMPTY: DailyDoubleLogos = { beer: null, shot: null };

/**
 * Returns the rotating daily-double drink logos. TanStack Query dedupes
 * by key, so the feed, history, and roll pages can each call this hook
 * and only one fetch hits Supabase.
 *
 * Logos rotate roughly once a day — give them a 10-minute stale window
 * to skip refetches on tab switches.
 */
export function useDailyDoubleLogos(): DailyDoubleLogos {
  const { data } = useQuery({
    queryKey: ["dailyDoubleLogos"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("menu_items")
        .select("die_number, logo_url")
        .eq("die_color", "daily_double");
      return {
        beer: data?.find((i) => i.die_number === 1)?.logo_url ?? null,
        shot: data?.find((i) => i.die_number === 2)?.logo_url ?? null,
      } satisfies DailyDoubleLogos;
    },
  });

  return data ?? EMPTY;
}
