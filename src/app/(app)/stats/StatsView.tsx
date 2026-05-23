"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import UserProfileModal from "@/components/UserProfileModal";
import { Flame } from "lucide-react";
import { PunchCardClubSection } from "@/components/PunchCardClubSection";
import { PodiumLeaderboard } from "@/components/PodiumLeaderboard";
import { ChartCard } from "@/components/ChartCard";
import { getDrinkColor, getNeonGlow } from "@/lib/format";
import {
  personalStatsQueryKey,
  globalStatsQueryKey,
  fetchPersonalStats,
  fetchGlobalStatsPage,
} from "@/lib/queries/stats";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function VerticalBarChart({
  data,
  color,
  height = 90,
}: {
  data: { label: string; count: number }[];
  color: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const barAreaH = height - 22;
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => {
        const barH = Math.max((d.count / max) * barAreaH, 2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="flex-1 w-full flex items-end">
              <div
                style={{
                  width: "100%",
                  height: barH,
                  background: color,
                  boxShadow: `0 0 8px ${color}80`,
                  borderRadius: "2px 2px 0 0",
                  transformOrigin: "bottom",
                  animation: `grow-bar 0.5s ${i * 0.05}s ease-out both`,
                }}
              />
            </div>
            <span className="font-display text-[10px] text-text-secondary">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function HBarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <div className="w-20 text-[11px] text-text-primary truncate">{label}</div>
      <div className="flex-1 h-2 bg-background rounded overflow-hidden">
        <div
          style={{
            width: `${(count / Math.max(max, 1)) * 100}%`,
            height: "100%",
            background: color,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
      </div>
      <div className="w-6 font-display text-[11px] text-text-secondary text-right">{count}</div>
    </div>
  );
}

function StatHero({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface rounded-2xl border border-surface-2 p-[14px_8px] text-center">
      <p
        className="font-display text-[28px] leading-none"
        style={{ color, textShadow: getNeonGlow(color) }}
      >
        {value}
      </p>
      <p className="font-display text-[9px] tracking-[0.18em] text-text-secondary mt-1.5">{label}</p>
    </div>
  );
}

export default function StatsView({ userId }: { userId: string }) {
  const supabase = createClient();

  const [mode, setMode] = useState<"personal" | "global">("personal");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const personal = useQuery({
    queryKey: personalStatsQueryKey(userId),
    staleTime: 60_000,
    queryFn: () => fetchPersonalStats(supabase, userId),
  });

  const global = useQuery({
    queryKey: globalStatsQueryKey,
    enabled: mode === "global",
    staleTime: 60_000,
    queryFn: () => fetchGlobalStatsPage(supabase, userId),
  });

  const stats = mode === "personal" ? personal.data ?? null : global.data?.stats ?? null;
  const loading = mode === "personal" ? personal.isLoading : global.isLoading;

  const totalRolls = stats?.total_rolls ?? 0;
  const totalDoubles = stats?.total_doubles ?? 0;
  const doublesPercent = totalRolls > 0 ? ((totalDoubles / totalRolls) * 100).toFixed(1) : "0";

  const redFreq = Array.from({ length: 8 }, (_, i) => ({
    label: `${i + 1}`,
    count: stats?.red_die_freq?.[i + 1] ?? 0,
  }));

  const whiteFreq = Array.from({ length: 8 }, (_, i) => ({
    label: `${i + 1}`,
    count: stats?.white_die_freq?.[i + 1] ?? 0,
  }));

  const truncate = (name: string) => (name.length > 10 ? name.slice(0, 10) + "…" : name);

  const topBeers = (stats?.top_beers ?? []).slice(0, 5).map(({ drink_name, count }) => ({
    name: truncate(drink_name),
    color: getDrinkColor(drink_name),
    count,
  }));

  const topShots = (stats?.top_shots ?? []).slice(0, 5).map(({ drink_name, count }) => ({
    name: truncate(drink_name),
    color: getDrinkColor(drink_name),
    count,
  }));

  const dayFreq = DAYS.map((day, i) => ({
    label: day,
    count: stats?.day_of_week?.find((d) => d.day_num === i)?.count ?? 0,
  }));

  const streak = personal.data?.current_streak ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="neon-title font-display text-[38px] tracking-[0.32em] leading-none">STATS</h1>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-[18px] pb-[84px] flex flex-col gap-3">
        <div className="flex rounded-full border border-surface-2 overflow-hidden">
          {(["personal", "global"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-[9px] font-display text-[10px] tracking-[0.22em] font-bold transition-all ${
                mode === m ? "bg-neon-pink text-background" : "bg-transparent text-text-secondary"
              }`}
            >
              {m === "personal" ? "MY ROLLS" : "ALL ROLLERS"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-text-secondary">Loading stats...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatHero label="TOTAL ROLLS" value={totalRolls.toString()} color="#FF2D55" />
              <StatHero label="DOUBLES" value={totalDoubles.toString()} color="#FFD600" />
              <StatHero label="DBL %" value={`${doublesPercent}`} color="#00FF88" />
            </div>

            {mode === "personal" && (
              <div className="bg-surface border border-surface-2 rounded-[18px] p-[14px_16px] flex items-center gap-3.5">
                <div
                  className="w-[46px] h-[46px] rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "#FF2D5510",
                    border: "1px solid rgba(255,45,85,0.5)",
                    boxShadow: "0 0 12px rgba(255,45,85,0.4)",
                  }}
                >
                  <Flame className="w-[22px] h-[22px] text-neon-pink" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-[9px] tracking-[0.22em] text-text-secondary">CURRENT STREAK</p>
                  <p
                    className="font-display text-[22px] leading-tight mt-0.5"
                    style={{ color: "#FF2D55", textShadow: "0 0 10px rgba(255,45,85,0.5)" }}
                  >
                    {streak} {streak === 1 ? "DAY" : "DAYS"}
                  </p>
                </div>
                <Link
                  href="/history"
                  className="font-display text-[9px] tracking-[0.18em] text-text-secondary border border-surface-2 rounded-lg px-2.5 py-1.5 hover:text-text-primary transition-colors shrink-0"
                >
                  HISTORY →
                </Link>
              </div>
            )}

            {mode === "global" && global.data?.podium && (
              <PodiumLeaderboard
                data={global.data.podium}
                onUserTap={(username) => setSelectedUser(username)}
              />
            )}

            {mode === "global" && global.data && (
              <PunchCardClubSection
                members={global.data.club.members}
                totalMembers={global.data.club.total}
                totalCompletions={global.data.club.completions}
              />
            )}

            {totalRolls > 0 && (
              <>
                <ChartCard variant="stats" title="● RED DIE FREQUENCY">
                  <VerticalBarChart data={redFreq} color="#FF2D55" />
                </ChartCard>

                <ChartCard variant="stats" title="○ WHITE DIE FREQUENCY">
                  <VerticalBarChart data={whiteFreq} color="#F5F5F5" />
                </ChartCard>

                {topBeers.length > 0 && (
                  <ChartCard variant="stats" title="🍺 TOP BEERS">
                    {topBeers.map((b, i) => (
                      <HBarRow key={i} label={b.name} count={b.count} max={topBeers[0].count} color={b.color} />
                    ))}
                  </ChartCard>
                )}

                {topShots.length > 0 && (
                  <ChartCard variant="stats" title="🥃 TOP SHOTS">
                    {topShots.map((s, i) => (
                      <HBarRow key={i} label={s.name} count={s.count} max={topShots[0].count} color={s.color} />
                    ))}
                  </ChartCard>
                )}

                <ChartCard variant="stats" title="ROLLS BY DAY OF WEEK">
                  <VerticalBarChart data={dayFreq} color="#00FF88" height={80} />
                </ChartCard>
              </>
            )}

            {totalRolls === 0 && (
              <div className="text-center py-12 text-text-secondary">
                <p className="text-5xl mb-4">🎲</p>
                <p>{mode === "personal" ? "No rolls yet — get out there!" : "No rolls recorded yet."}</p>
              </div>
            )}
          </>
        )}
      </div>

      {selectedUser && (
        <UserProfileModal username={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
