"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface DailyDoubleLogos {
  beer: string | null;
  shot: string | null;
}

export function useDailyDoubleLogos(): DailyDoubleLogos {
  const [logos, setLogos] = useState<DailyDoubleLogos>({ beer: null, shot: null });

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("die_number, logo_url")
        .eq("die_color", "daily_double");
      if (cancelled || !data) return;
      setLogos({
        beer: data.find((i) => i.die_number === 1)?.logo_url ?? null,
        shot: data.find((i) => i.die_number === 2)?.logo_url ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return logos;
}
