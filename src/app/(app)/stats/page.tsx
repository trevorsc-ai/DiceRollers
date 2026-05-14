"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import UserProfileModal from "@/components/UserProfileModal";
import { Flame } from "lucide-react";
import { PunchCardClubSection } from "@/components/PunchCardClubSection";

interface Roll {
  id: number;
  roll_date: string;
  roll_time: string;
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  is_doubles: boolean;
}

interface GlobalStats {
  total_rolls: number;
  total_doubles: number;
  red_die_freq: Record<string, number>;
  white_die_freq: Record<string, number>;
  top_beers: { drink_name: string; count: number }[];
  top_shots: { drink_name: string; count: number }[];
  day_of_week: { day_num: number; count: number }[];
  leaderboard: { username: string; count: number; flair: string[] }[];
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const NEON_COLORS = ["#FF2D55", "#FFD600", "#00FF88", "#FF6B9D", "#FFF066", "#66FFB3", "#FF9966", "#AA66FF"];

function drinkColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return NEON_COLORS[h % NEON_COLORS.length];
}

/* ── Custom chart primitives ── */

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

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-surface-2 rounded-[18px] p-[14px_14px_12px]">
      <p className="font-display text-[9px] tracking-[0.22em] text-text-secondary mb-2.5">{title}</p>
      {children}
    </div>
  );
}

function StatHero({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-surface rounded-2xl border border-surface-2 p-[14px_8px] text-center">
      <p
        className="font-display text-[28px] leading-none"
        style={{ color, textShadow: `0 0 10px ${color}80, 0 0 22px ${color}40` }}
      >
        {value}
      </p>
      <p className="font-display text-[9px] tracking-[0.18em] text-text-secondary mt-1.5">{label}</p>
    </div>
  );
}

export default function StatsPage() {
  const supabase = createClient();

  const [mode, setMode] = useState<"personal" | "global">("personal");
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalFetched, setGlobalFetched] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [clubMembers, setClubMembers] = useState<{ rank: number; user: string; cardNumber: number; rolls: number; you: boolean }[]>([]);
  const [clubTotal, setClubTotal] = useState(0);
  const [clubCompletions, setClubCompletions] = useState(0);

  useEffect(() => {
    async function loadPersonal() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: rollData } = await supabase
        .from("rolls")
        .select("*")
        .eq("user_id", user.id)
        .order("roll_time", { ascending: true });
      if (rollData) setRolls(rollData);
      setPersonalLoading(false);
    }
    loadPersonal();
  }, [supabase]);

  useEffect(() => {
    if (mode !== "global" || globalFetched) return;
    async function loadGlobal() {
      setGlobalLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data, error }, { data: clubData }] = await Promise.all([
        supabase.rpc("get_global_stats"),
        supabase.rpc("get_punch_card_club"),
      ]);
      if (!error && data) setGlobalStats(data as GlobalStats);
      if (clubData && clubData.length > 0) {
        const typed = clubData as { user_id: string; username: string; completion_number: number; best_rolls: number; earned_at: string; total_members: number; total_completions: number }[];
        setClubTotal(Number(typed[0].total_members));
        setClubCompletions(Number(typed[0].total_completions));
        setClubMembers(
          typed.map((row, idx) => ({
            rank: idx + 1,
            user: row.username,
            cardNumber: row.completion_number,
            rolls: row.best_rolls,
            you: row.user_id === user?.id,
          }))
        );
      }
      setGlobalLoading(false);
      setGlobalFetched(true);
    }
    loadGlobal();
  }, [mode, globalFetched, supabase]);

  const loading = mode === "personal" ? personalLoading : globalLoading;

  const totalRolls = mode === "personal" ? rolls.length : (globalStats?.total_rolls ?? 0);
  const totalDoubles = mode === "personal"
    ? rolls.filter((r) => r.is_doubles).length
    : (globalStats?.total_doubles ?? 0);
  const doublesPercent = totalRolls > 0 ? ((totalDoubles / totalRolls) * 100).toFixed(1) : "0";

  const redFreq = Array.from({ length: 8 }, (_, i) => ({
    label: `${i + 1}`,
    count: mode === "personal"
      ? rolls.filter((r) => r.red_die_number === i + 1).length
      : (globalStats?.red_die_freq?.[i + 1] ?? 0),
  }));

  const whiteFreq = Array.from({ length: 8 }, (_, i) => ({
    label: `${i + 1}`,
    count: mode === "personal"
      ? rolls.filter((r) => r.white_die_number === i + 1).length
      : (globalStats?.white_die_freq?.[i + 1] ?? 0),
  }));

  const truncate = (name: string) => name.length > 10 ? name.slice(0, 10) + "…" : name;

  const topBeers = (() => {
    if (mode === "personal") {
      const counts: Record<string, number> = {};
      rolls.forEach((r) => { counts[r.red_drink_name] = (counts[r.red_drink_name] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name: truncate(name), color: drinkColor(name), count }));
    }
    return (globalStats?.top_beers ?? []).slice(0, 5).map(({ drink_name, count }) => ({
      name: truncate(drink_name), color: drinkColor(drink_name), count,
    }));
  })();

  const topShots = (() => {
    if (mode === "personal") {
      const counts: Record<string, number> = {};
      rolls.forEach((r) => { counts[r.white_drink_name] = (counts[r.white_drink_name] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name: truncate(name), color: drinkColor(name), count }));
    }
    return (globalStats?.top_shots ?? []).slice(0, 5).map(({ drink_name, count }) => ({
      name: truncate(drink_name), color: drinkColor(drink_name), count,
    }));
  })();

  const dayFreq = DAYS.map((day, i) => ({
    label: day,
    count: mode === "personal"
      ? rolls.filter((r) => new Date(r.roll_time).getDay() === i).length
      : (globalStats?.day_of_week?.find((d) => d.day_num === i)?.count ?? 0),
  }));

  const streak = (() => {
    const uniqueDays = Array.from(new Set(rolls.map((r) => r.roll_date))).sort();
    let s = 0;
    if (uniqueDays.length > 0) {
      const checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);
      for (let i = 0; i < 365; i++) {
        const ds = checkDate.toISOString().split("T")[0];
        if (uniqueDays.includes(ds)) {
          s++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }
    }
    return s;
  })();

  const leaderboard = globalStats?.leaderboard ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="neon-title font-display text-[38px] tracking-[0.32em] leading-none">STATS</h1>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-[18px] pb-[84px] flex flex-col gap-3">
        {/* Mode toggle */}
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
            {/* Hero stats */}
            <div className="grid grid-cols-3 gap-2">
              <StatHero label="TOTAL ROLLS" value={totalRolls.toString()} color="#FF2D55" />
              <StatHero label="DOUBLES" value={totalDoubles.toString()} color="#FFD600" />
              <StatHero label="DBL %" value={`${doublesPercent}`} color="#00FF88" />
            </div>

            {/* Streak — personal only */}
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

            {/* Leaderboard — global only */}
            {mode === "global" && leaderboard.length > 0 && (
              <div className="bg-surface rounded-2xl p-4 border border-surface-2">
                <h2 className="font-display text-base neon-text-gold tracking-widest mb-3">🏆 LEADERBOARD</h2>
                <div className="space-y-1.5">
                  {leaderboard.map((entry, i) => (
                    <button
                      key={entry.username}
                      className="flex items-center gap-3 w-full text-left rounded-xl px-2 py-1 -mx-2 hover:bg-surface-2 transition-colors"
                      onClick={() => setSelectedUser(entry.username)}
                    >
                      <span className={`font-display text-base w-6 shrink-0 ${
                        i === 0 ? "text-neon-gold" : i === 1 ? "text-text-secondary" : i === 2 ? "text-neon-pink/60" : "text-text-secondary"
                      }`}>{i + 1}</span>
                      <span className="text-text-primary text-sm">{entry.username}</span>
                      {entry.flair && entry.flair.length > 0 && (
                        <span className="text-sm leading-none">{entry.flair.join("")}</span>
                      )}
                      <span className="ml-auto text-text-secondary text-sm shrink-0">{entry.count} rolls</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Punch Card Club — global only, below leaderboard */}
            {mode === "global" && (
              <PunchCardClubSection members={clubMembers} totalMembers={clubTotal} totalCompletions={clubCompletions} />
            )}

            {totalRolls > 0 && (
              <>
                <ChartCard title="● RED DIE FREQUENCY">
                  <VerticalBarChart data={redFreq} color="#FF2D55" />
                </ChartCard>

                <ChartCard title="○ WHITE DIE FREQUENCY">
                  <VerticalBarChart data={whiteFreq} color="#F5F5F5" />
                </ChartCard>

                {topBeers.length > 0 && (
                  <ChartCard title="🍺 TOP BEERS">
                    {topBeers.map((b, i) => (
                      <HBarRow key={i} label={b.name} count={b.count} max={topBeers[0].count} color={b.color} />
                    ))}
                  </ChartCard>
                )}

                {topShots.length > 0 && (
                  <ChartCard title="🥃 TOP SHOTS">
                    {topShots.map((s, i) => (
                      <HBarRow key={i} label={s.name} count={s.count} max={topShots[0].count} color={s.color} />
                    ))}
                  </ChartCard>
                )}

                <ChartCard title="ROLLS BY DAY OF WEEK">
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
