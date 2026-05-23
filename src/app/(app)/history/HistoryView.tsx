"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Search, Filter } from "lucide-react";
import { useDailyDoubleLogos } from "@/hooks/useDailyDoubleLogos";
import { useScrollSentinel } from "@/hooks/useScrollSentinel";
import { RollCard } from "@/components/roll/RollCard";
import {
  fetchHistoryPage,
  historyQueryKey,
  historyTotalQueryKey,
  type HistoryFilters,
  type HistoryRoll,
} from "@/lib/queries/rolls";

const SEARCH_DEBOUNCE_MS = 250;

export default function HistoryView({ userId }: { userId: string }) {
  const supabase = createClient();
  const dailyDoubleLogo = useDailyDoubleLogos();

  // Lifetime total (independent of filters)
  const { data: totalRolls } = useQuery({
    queryKey: historyTotalQueryKey(userId),
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      const { count } = await supabase
        .from("rolls")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      return count ?? 0;
    },
  });

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [doublesOnly, setDoublesOnly] = useState(false);
  const [achievementsOnly, setAchievementsOnly] = useState(false);
  const [twinsiesOnly, setTwinsiesOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const filters = useMemo<HistoryFilters>(
    () => ({
      search: debouncedSearch,
      doublesOnly,
      achievementsOnly,
      twinsiesOnly,
      dateFrom,
      dateTo,
    }),
    [debouncedSearch, doublesOnly, achievementsOnly, twinsiesOnly, dateFrom, dateTo]
  );

  const {
    data,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: historyQueryKey(userId, filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchHistoryPage(supabase, userId, filters, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const rolls: HistoryRoll[] = data?.pages.flatMap((p) => p.items) ?? [];

  const sentinelRef = useScrollSentinel(() => {
    if (hasNextPage && !loadingMore) fetchNextPage();
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="neon-title font-display text-[38px] tracking-[0.32em] leading-none">HISTORY</h1>
          <p className="font-display text-[11px] tracking-[0.14em] text-text-muted mt-1">
            {totalRolls ?? 0} TOTAL ROLLS
          </p>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-[18px] pb-[84px] flex flex-col gap-2.5">
        {/* Search */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            style={{ width: 15, height: 15 }}
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drinks..."
            className="w-full bg-surface border border-surface-2 rounded-[10px] pl-9 pr-3 py-2.5 text-text-primary placeholder-text-secondary focus:outline-none focus:border-neon-pink transition-colors text-[13px]"
          />
        </div>

        {/* Filter row */}
        <div className="flex gap-2 flex-wrap">
          <FilterChip label="DOUBLES ONLY" active={doublesOnly} onToggle={() => setDoublesOnly((v) => !v)} />
          <FilterChip label="ACHIEVEMENTS" active={achievementsOnly} onToggle={() => setAchievementsOnly((v) => !v)} />
          <FilterChip label="TWINSIES" active={twinsiesOnly} onToggle={() => setTwinsiesOnly((v) => !v)} />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-surface border border-surface-2 rounded-lg px-2.5 py-[7px] text-text-secondary font-display text-[10px] focus:outline-none focus:border-neon-pink [color-scheme:dark] tracking-[0.10em]"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-surface border border-surface-2 rounded-lg px-2.5 py-[7px] text-text-secondary font-display text-[10px] focus:outline-none focus:border-neon-pink [color-scheme:dark] tracking-[0.10em]"
          />
        </div>

        {/* Roll list */}
        {loading ? (
          <div className="text-center text-text-secondary py-12">Loading...</div>
        ) : rolls.length === 0 ? (
          <div className="text-center text-text-secondary py-12">
            <p className="text-4xl mb-3">🎲</p>
            <p>No rolls yet. Get rolling!</p>
          </div>
        ) : (
          <>
            {rolls.map((roll) => (
              <HistoryRollCard key={roll.id} roll={roll} dailyDoubleLogo={dailyDoubleLogo} />
            ))}
            <div ref={sentinelRef} className="h-1" aria-hidden />
            {loadingMore && (
              <div className="text-center text-text-secondary py-4 font-display text-[11px] tracking-[0.18em]">
                LOADING MORE…
              </div>
            )}
            {!hasNextPage && !loadingMore && (
              <div className="text-center text-text-muted py-6 font-display text-[10px] tracking-[0.22em]">
                · END OF THE LINE ·
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-[11px] py-[7px] rounded-lg border font-display text-[10px] tracking-[0.16em] font-bold transition-all"
      style={
        active
          ? {
              background: "rgba(255,214,0,0.20)",
              borderColor: "#FFD600",
              color: "#FFD600",
              boxShadow: "0 0 8px rgba(255,214,0,0.25)",
            }
          : { background: "transparent", borderColor: "#252525", color: "#555" }
      }
    >
      <Filter style={{ width: 11, height: 11 }} strokeWidth={2} />
      {label}
    </button>
  );
}

function HistoryRollCard({
  roll,
  dailyDoubleLogo,
}: {
  roll: HistoryRoll;
  dailyDoubleLogo: ReturnType<typeof useDailyDoubleLogos>;
}) {
  const date = new Date(roll.roll_time);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <RollCard
      roll={roll}
      dailyDoubleLogo={dailyDoubleLogo}
      rounded="md"
      header={
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-text-primary text-[12px] font-medium">{dateStr}</span>
            <span className="font-display text-[10px] text-text-muted tracking-[0.10em]">#{roll.rollNumber}</span>
          </div>
          <p className="font-display text-[10px] text-text-muted mt-0.5">{timeStr}</p>
        </div>
      }
    />
  );
}
