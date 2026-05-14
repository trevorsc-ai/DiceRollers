"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Filter } from "lucide-react";
import { formatPartners } from "@/lib/twinsies";

interface EarnedAchievement {
  name: string;
  emoji: string;
  category_emoji: string;
  category_name: string;
}

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

export default function HistoryPage() {
  const supabase = createClient();
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [doublesOnly, setDoublesOnly] = useState(false);
  const [achievementsOnly, setAchievementsOnly] = useState(false);
  const [twinsiesOnly, setTwinsiesOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dailyDoubleLogo, setDailyDoubleLogo] = useState<{ beer: string | null; shot: string | null }>({ beer: null, shot: null });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ddItems } = await supabase
        .from("menu_items")
        .select("die_number, logo_url")
        .eq("die_color", "daily_double");
      if (ddItems) {
        const beer = ddItems.find((i) => i.die_number === 1)?.logo_url ?? null;
        const shot = ddItems.find((i) => i.die_number === 2)?.logo_url ?? null;
        setDailyDoubleLogo({ beer, shot });
      }

      const { data } = await supabase
        .from("rolls")
        .select("*")
        .eq("user_id", user.id)
        .order("roll_time", { ascending: false });

      if (data) {
        const rollIds = data.map((r: { id: number }) => r.id);
        const [{ data: achievementData }, { data: twinData }] = await Promise.all([
          supabase
            .from("user_achievements")
            .select("earned_on_roll_id, achievements(id, name, emoji, category_emoji, category_name)")
            .in("earned_on_roll_id", rollIds)
            .not("completed_at", "is", null),
          supabase
            .from("rolls_with_twins")
            .select("id, twin_partners")
            .in("id", rollIds),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const achievementsByRoll: Record<number, EarnedAchievement[]> = {};
        for (const ua of achievementData ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = (ua as any).achievements;
          if (!a || !ua.earned_on_roll_id) continue;
          // Twinsies has its own dedicated partner badge; suppress the generic pill.
          if (a.id === "twinsies") continue;
          if (!achievementsByRoll[ua.earned_on_roll_id]) achievementsByRoll[ua.earned_on_roll_id] = [];
          achievementsByRoll[ua.earned_on_roll_id].push({
            name: a.name, emoji: a.emoji,
            category_emoji: a.category_emoji, category_name: a.category_name,
          });
        }

        const twinsByRoll: Record<number, string[]> = {};
        for (const row of (twinData ?? []) as Array<{ id: number; twin_partners: string[] | null }>) {
          if (row.twin_partners && row.twin_partners.length > 0) {
            twinsByRoll[row.id] = row.twin_partners;
          }
        }

        const total = data.length;
        setRolls(data.map((r: Roll, i: number) => ({
          ...r,
          achievements: achievementsByRoll[r.id] ?? [],
          twinPartners: twinsByRoll[r.id] ?? [],
          rollNumber: total - i,
        })));
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const filtered = rolls.filter((r) => {
    if (doublesOnly && !r.is_doubles) return false;
    if (achievementsOnly && r.achievements.length === 0) return false;
    if (twinsiesOnly && r.twinPartners.length === 0) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.red_drink_name.toLowerCase().includes(q) && !r.white_drink_name.toLowerCase().includes(q)) return false;
    }
    if (dateFrom && r.roll_date < dateFrom) return false;
    if (dateTo && r.roll_date > dateTo) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="neon-title font-display text-[38px] tracking-[0.32em] leading-none">HISTORY</h1>
          <p className="font-display text-[11px] tracking-[0.14em] text-text-muted mt-1">
            {rolls.length} TOTAL ROLLS
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
        ) : filtered.length === 0 ? (
          <div className="text-center text-text-secondary py-12">
            <p className="text-4xl mb-3">🎲</p>
            <p>No rolls yet. Get rolling!</p>
          </div>
        ) : (
          filtered.map((roll) => (
            <RollCard key={roll.id} roll={roll} dailyDoubleLogo={dailyDoubleLogo} />
          ))
        )}
      </div>
    </div>
  );
}

function RollCard({ roll, dailyDoubleLogo }: { roll: Roll; dailyDoubleLogo: { beer: string | null; shot: string | null } }) {
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
