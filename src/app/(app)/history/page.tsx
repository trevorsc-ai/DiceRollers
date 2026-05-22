"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Filter } from "lucide-react";
import { formatPartners } from "@/lib/twinsies";
import {
  loadAchievementsForRolls,
  loadTwinsForRolls,
  type EarnedAchievement,
} from "@/lib/rollAchievements";
import { useDailyDoubleLogos, type DailyDoubleLogos } from "@/hooks/useDailyDoubleLogos";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 250;

interface Roll {
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
  is_daily_double: boolean;
  achievements: EarnedAchievement[];
  twinPartners: string[];
  rollNumber: number;
}

// Supabase's .or() filter syntax uses ',' '(' ')' as separators and '%' '_'
// as LIKE wildcards. Strip them so a search box can't break the query.
function sanitizeSearch(q: string): string {
  return q.replace(/[,()"\\%_]/g, "").trim();
}

export default function HistoryPage() {
  const supabase = createClient();
  const dailyDoubleLogo = useDailyDoubleLogos();

  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalRolls, setTotalRolls] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [doublesOnly, setDoublesOnly] = useState(false);
  const [achievementsOnly, setAchievementsOnly] = useState(false);
  const [twinsiesOnly, setTwinsiesOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Keyset pagination refs (stable across re-renders so the observer
  // doesn't churn). Mirrors src/app/(app)/feed/page.tsx.
  const lastTimeRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const inFlightRef = useRef(false);
  const userIdRef = useRef<string | null>(null);

  // Debounce the search box so each keystroke doesn't refetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const loadPage = useCallback(async () => {
    if (inFlightRef.current || !hasMoreRef.current) return;
    if (!userIdRef.current) return;
    inFlightRef.current = true;
    const isFirstPage = lastTimeRef.current === null;
    if (!isFirstPage) setLoadingMore(true);

    const q = sanitizeSearch(debouncedSearch);

    let query = supabase
      .from("rolls_with_flags")
      .select("*")
      .eq("user_id", userIdRef.current)
      .order("roll_time", { ascending: false })
      .limit(PAGE_SIZE);

    if (lastTimeRef.current) query = query.lt("roll_time", lastTimeRef.current);
    if (doublesOnly) query = query.eq("is_doubles", true);
    if (achievementsOnly) query = query.eq("has_achievement", true);
    if (twinsiesOnly) query = query.eq("has_twin", true);
    if (dateFrom) query = query.gte("roll_date", dateFrom);
    if (dateTo) query = query.lte("roll_date", dateTo);
    if (q) query = query.or(`red_drink_name.ilike.%${q}%,white_drink_name.ilike.%${q}%`);

    const { data: rollData } = await query;

    if (!rollData || rollData.length === 0) {
      hasMoreRef.current = false;
      setHasMore(false);
      if (isFirstPage) {
        setRolls([]);
        setLoading(false);
      }
      setLoadingMore(false);
      inFlightRef.current = false;
      return;
    }

    const rollIds = rollData.map((r: { id: number }) => r.id);
    const [achievementsByRoll, twinsByRoll] = await Promise.all([
      loadAchievementsForRolls(supabase, rollIds),
      loadTwinsForRolls(supabase, rollIds),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: Roll[] = rollData.map((r: any) => ({
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

    setRolls((prev) => (isFirstPage ? mapped : [...prev, ...mapped]));
    lastTimeRef.current = mapped[mapped.length - 1].roll_time;
    if (rollData.length < PAGE_SIZE) {
      hasMoreRef.current = false;
      setHasMore(false);
    }
    if (isFirstPage) setLoading(false);
    setLoadingMore(false);
    inFlightRef.current = false;
  }, [supabase, debouncedSearch, doublesOnly, achievementsOnly, twinsiesOnly, dateFrom, dateTo]);

  // First mount: resolve the user, then fetch the lifetime roll count for
  // the header. The count is independent of filters; it's the user's total.
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      userIdRef.current = user.id;
      const { count } = await supabase
        .from("rolls")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (!cancelled) setTotalRolls(count ?? 0);
      if (!cancelled) await loadPage();
    }
    init();
    return () => {
      cancelled = true;
    };
    // loadPage is intentionally omitted: it's invoked once on init and re-run
    // by the filter-reset effect below when its deps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Any filter change resets pagination and refetches page 1. Skipped on
  // first mount (handled by the init effect above).
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!userIdRef.current) return;
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    lastTimeRef.current = null;
    hasMoreRef.current = true;
    inFlightRef.current = false;
    setHasMore(true);
    setLoading(true);
    setRolls([]);
    loadPage();
  }, [debouncedSearch, doublesOnly, achievementsOnly, twinsiesOnly, dateFrom, dateTo, loadPage]);

  // IntersectionObserver sentinel: load the next page when the bottom
  // marker scrolls into view. Mirrors the feed.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadPage();
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadPage, hasMore, loading]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
          <button
            onClick={() => setDoublesOnly(!doublesOnly)}
            className="flex items-center gap-1.5 px-[11px] py-[7px] rounded-lg border font-display text-[10px] tracking-[0.16em] font-bold transition-all"
            style={
              doublesOnly
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
            DOUBLES ONLY
          </button>
          <button
            onClick={() => setAchievementsOnly(!achievementsOnly)}
            className="flex items-center gap-1.5 px-[11px] py-[7px] rounded-lg border font-display text-[10px] tracking-[0.16em] font-bold transition-all"
            style={
              achievementsOnly
                ? { background: "rgba(255,214,0,0.20)", borderColor: "#FFD600", color: "#FFD600", boxShadow: "0 0 8px rgba(255,214,0,0.25)" }
                : { background: "transparent", borderColor: "#252525", color: "#555" }
            }
          >
            <Filter style={{ width: 11, height: 11 }} strokeWidth={2} />
            ACHIEVEMENTS
          </button>
          <button
            onClick={() => setTwinsiesOnly(!twinsiesOnly)}
            className="flex items-center gap-1.5 px-[11px] py-[7px] rounded-lg border font-display text-[10px] tracking-[0.16em] font-bold transition-all"
            style={
              twinsiesOnly
                ? { background: "rgba(255,214,0,0.20)", borderColor: "#FFD600", color: "#FFD600", boxShadow: "0 0 8px rgba(255,214,0,0.25)" }
                : { background: "transparent", borderColor: "#252525", color: "#555" }
            }
          >
            <Filter style={{ width: 11, height: 11 }} strokeWidth={2} />
            TWINSIES
          </button>
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
              <RollCard key={roll.id} roll={roll} dailyDoubleLogo={dailyDoubleLogo} />
            ))}
            <div ref={sentinelRef} className="h-1" aria-hidden />
            {loadingMore && (
              <div className="text-center text-text-secondary py-4 font-display text-[11px] tracking-[0.18em]">
                LOADING MORE…
              </div>
            )}
            {!hasMore && !loadingMore && (
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

function RollCard({ roll, dailyDoubleLogo }: { roll: Roll; dailyDoubleLogo: DailyDoubleLogos }) {
  const date = new Date(roll.roll_time);
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const redLogo = roll.is_daily_double ? dailyDoubleLogo.beer : roll.red_drink_logo;
  const whiteLogo = roll.is_daily_double ? dailyDoubleLogo.shot : roll.white_drink_logo;

  return (
    <div
      className="bg-surface rounded-[14px] p-[12px_14px] border"
      style={{
        borderColor: roll.is_doubles ? "rgba(255,214,0,0.55)" : "#252525",
        boxShadow: roll.is_doubles ? "0 0 12px rgba(255,214,0,0.12)" : "none",
      }}
    >
      {/* Date row */}
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-text-primary text-[12px] font-medium">{dateStr}</span>
            <span className="font-display text-[10px] text-text-muted tracking-[0.10em]">#{roll.rollNumber}</span>
          </div>
          <p className="font-display text-[10px] text-text-muted mt-0.5">{timeStr}</p>
        </div>
        {roll.is_doubles && (
          <span
            className="font-display text-[9px] font-bold tracking-[0.18em] px-2 py-1 rounded-full border shrink-0"
            style={{
              color: "#FFD600",
              textShadow: "0 0 8px rgba(255,214,0,0.5)",
              borderColor: "#FFD600",
              background: roll.is_daily_double ? "rgba(255,214,0,0.25)" : "rgba(255,214,0,0.15)",
            }}
          >
            {roll.is_daily_double ? "DAILY DOUBLE!" : "DOUBLES!"}
          </span>
        )}
      </div>

      {/* Drink row */}
      <div className="flex items-center gap-2.5">
        <DrinkItem name={roll.red_drink_name} logo={redLogo} dieNum={roll.red_die_number} color="red" />
        <span className="text-text-muted text-sm shrink-0">+</span>
        <DrinkItem name={roll.white_drink_name} logo={whiteLogo} dieNum={roll.white_die_number} color="white" />
      </div>

      {/* Twinsies indicator */}
      {roll.twinPartners.length > 0 && (
        <div className="mt-2.5">
          <span
            className="inline-flex items-center gap-1 font-display text-[10px] tracking-[0.08em] px-2 py-1 rounded-full border"
            style={{
              color: "#FFD600",
              borderColor: "rgba(255,214,0,0.4)",
              background: "rgba(255,214,0,0.10)",
            }}
          >
            👯 TWINSIES with {formatPartners(roll.twinPartners)}
          </span>
        </div>
      )}

      {/* Achievement pills */}
      {roll.achievements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {roll.achievements.map((a) => (
            <span
              key={a.name}
              className="inline-flex items-center gap-1 font-display text-[10px] tracking-[0.08em] px-2 py-1 rounded-full border"
              style={{
                color: "#FFD600",
                borderColor: "rgba(255,214,0,0.4)",
                background: "rgba(255,214,0,0.10)",
              }}
            >
              {a.emoji} {a.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DrinkItem({ name, logo, dieNum, color }: {
  name: string; logo: string | null; dieNum: number; color: "red" | "white";
}) {
  const isRed = color === "red";
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div
        className="w-[34px] h-[34px] rounded-lg shrink-0 flex items-center justify-center"
        style={{
          background: isRed ? "#FF2D5512" : "#F5F5F508",
          border: `1px solid ${isRed ? "rgba(255,45,85,0.32)" : "#252525"}`,
          fontFamily: "var(--font-display, monospace)",
          fontSize: 14,
          fontWeight: 700,
          color: isRed ? "#FF2D55" : "#F5F5F5",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="w-5 h-5 object-contain" />
        ) : (
          dieNum
        )}
      </div>
      <div className="min-w-0">
        <p className="text-text-primary text-[12px] font-medium leading-snug truncate">{name}</p>
        <p
          className="font-display text-[9px] tracking-[0.12em] mt-0.5"
          style={{ color: isRed ? "rgba(255,45,85,0.75)" : "#555" }}
        >
          {isRed ? "BEER" : "SHOT"}
        </p>
      </div>
    </div>
  );
}
