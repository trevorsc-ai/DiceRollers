"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

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
  leaderboard: { username: string; count: number }[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NEON_COLORS = ["#FF2D55", "#FFD600", "#00FF88", "#FF6B9D", "#FFF066", "#66FFB3", "#FF9966", "#AA66FF"];

export default function StatsPage() {
  const supabase = createClient();

  const [mode, setMode] = useState<"personal" | "global">("personal");

  // Personal
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);

  // Global
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalFetched, setGlobalFetched] = useState(false);

  // Load personal rolls once on mount
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

  // Load global stats lazily on first switch to global
  useEffect(() => {
    if (mode !== "global" || globalFetched) return;

    async function loadGlobal() {
      setGlobalLoading(true);
      const { data, error } = await supabase.rpc("get_global_stats");
      if (!error && data) setGlobalStats(data as GlobalStats);
      setGlobalLoading(false);
      setGlobalFetched(true);
    }
    loadGlobal();
  }, [mode, globalFetched, supabase]);

  const loading = mode === "personal" ? personalLoading : globalLoading;

  // ── Derive chart-ready arrays from either data source ──────────────────

  const totalRolls = mode === "personal"
    ? rolls.length
    : (globalStats?.total_rolls ?? 0);

  const totalDoubles = mode === "personal"
    ? rolls.filter((r) => r.is_doubles).length
    : (globalStats?.total_doubles ?? 0);

  const doublesPercent = totalRolls > 0
    ? ((totalDoubles / totalRolls) * 100).toFixed(1)
    : "0";

  const redFreq = Array.from({ length: 8 }, (_, i) => ({
    num: `${i + 1}`,
    count: mode === "personal"
      ? rolls.filter((r) => r.red_die_number === i + 1).length
      : (globalStats?.red_die_freq?.[i + 1] ?? 0),
  }));

  const whiteFreq = Array.from({ length: 8 }, (_, i) => ({
    num: `${i + 1}`,
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
        .slice(0, 8)
        .map(([name, count]) => ({ name: truncate(name), count }));
    }
    return (globalStats?.top_beers ?? []).map(({ drink_name, count }) => ({ name: truncate(drink_name), count }));
  })();

  const topShots = (() => {
    if (mode === "personal") {
      const counts: Record<string, number> = {};
      rolls.forEach((r) => { counts[r.white_drink_name] = (counts[r.white_drink_name] || 0) + 1; });
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name: truncate(name), count }));
    }
    return (globalStats?.top_shots ?? []).map(({ drink_name, count }) => ({ name: truncate(drink_name), count }));
  })();

  const dayFreq = DAYS.map((day, i) => ({
    day,
    count: mode === "personal"
      ? rolls.filter((r) => new Date(r.roll_time).getDay() === i).length
      : (globalStats?.day_of_week?.find((d) => d.day_num === i)?.count ?? 0),
  }));

  // Streak — personal only
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
        } else {
          break;
        }
      }
    }
    return s;
  })();

  const leaderboard = globalStats?.leaderboard ?? [];

  return (
    <div className="min-h-screen bg-background px-4 py-6 space-y-6">
      <div className="text-center mb-2">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">STATS</h1>
      </div>

      {/* Toggle */}
      <div className="flex rounded-full border border-surface-2 overflow-hidden">
        <button
          onClick={() => setMode("personal")}
          className={`flex-1 py-2 text-xs font-display tracking-widest transition-colors ${
            mode === "personal"
              ? "bg-neon-pink text-background"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          MY ROLLS
        </button>
        <button
          onClick={() => setMode("global")}
          className={`flex-1 py-2 text-xs font-display tracking-widest transition-colors ${
            mode === "global"
              ? "bg-neon-pink text-background"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          ALL ROLLERS
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-text-secondary">Loading stats...</p>
        </div>
      ) : (
        <>
          {/* Hero numbers */}
          <div className="grid grid-cols-3 gap-3">
            <StatHero label="TOTAL ROLLS" value={totalRolls.toString()} color="neon-pink" />
            <StatHero label="DOUBLES" value={totalDoubles.toString()} color="neon-gold" />
            <StatHero label="DBL %" value={`${doublesPercent}%`} color="neon-green" />
          </div>

          {/* Streak — personal only */}
          {mode === "personal" && (
            <StatHero label="CURRENT STREAK" value={`${streak} day${streak !== 1 ? "s" : ""}`} color="neon-pink" />
          )}

          {totalRolls > 0 && (
            <>
              <ChartCard title="🔴 Red Die Frequency">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={redFreq} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <XAxis dataKey="num" tick={{ fill: "#999", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#999", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1A1A1A", border: "1px solid #252525", borderRadius: 8 }}
                      labelStyle={{ color: "#F5F5F5" }}
                      itemStyle={{ color: "#FF2D55" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {redFreq.map((_, i) => (
                        <Cell key={i} fill="#FF2D55" opacity={0.7 + (i / 14)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="⚪ White Die Frequency">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={whiteFreq} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <XAxis dataKey="num" tick={{ fill: "#999", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#999", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1A1A1A", border: "1px solid #252525", borderRadius: 8 }}
                      labelStyle={{ color: "#F5F5F5" }}
                      itemStyle={{ color: "#F5F5F5" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {whiteFreq.map((_, i) => (
                        <Cell key={i} fill="#F5F5F5" opacity={0.4 + (i / 12)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {topBeers.length > 0 && (
                <ChartCard title="🍺 Most Rolled Beers">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={topBeers} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                      <XAxis type="number" tick={{ fill: "#999", fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#F5F5F5", fontSize: 10 }} width={80} />
                      <Tooltip
                        contentStyle={{ background: "#1A1A1A", border: "1px solid #252525", borderRadius: 8 }}
                        itemStyle={{ color: "#FF2D55" }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {topBeers.map((_, i) => (
                          <Cell key={i} fill="#FF2D55" opacity={0.5 + (i / (topBeers.length * 2))} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {topShots.length > 0 && (
                <ChartCard title="🥃 Most Rolled Shots">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={topShots} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                      <XAxis type="number" tick={{ fill: "#999", fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#F5F5F5", fontSize: 10 }} width={80} />
                      <Tooltip
                        contentStyle={{ background: "#1A1A1A", border: "1px solid #252525", borderRadius: 8 }}
                        itemStyle={{ color: "#F5F5F5" }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {topShots.map((_, i) => (
                          <Cell key={i} fill="#F5F5F5" opacity={0.35 + (i / (topShots.length * 2))} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              <ChartCard title="📅 Rolls by Day of Week">
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={dayFreq} margin={{ top: 5, right: 5, left: -30, bottom: 0 }}>
                    <XAxis dataKey="day" tick={{ fill: "#999", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#999", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#1A1A1A", border: "1px solid #252525", borderRadius: 8 }}
                      itemStyle={{ color: "#00FF88" }}
                    />
                    <Bar dataKey="count" fill="#00FF88" radius={[4, 4, 0, 0]} opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </>
          )}

          {totalRolls === 0 && (
            <div className="text-center py-12 text-text-secondary">
              <p className="text-5xl mb-4">🎲</p>
              <p>{mode === "personal" ? "No rolls yet — get out there!" : "No rolls recorded yet."}</p>
            </div>
          )}

          {/* Leaderboard — global only */}
          {mode === "global" && leaderboard.length > 0 && (
            <div className="bg-surface rounded-2xl p-4 border border-surface-2">
              <h2 className="font-display text-xl neon-text-gold tracking-widest mb-4">🏆 LEADERBOARD</h2>
              <div className="space-y-2">
                {leaderboard.map((entry, i) => (
                  <div key={entry.username} className="flex items-center gap-3">
                    <span className={`font-display text-lg w-6 ${i === 0 ? "text-neon-gold" : i === 1 ? "text-text-secondary" : i === 2 ? "text-neon-pink/60" : "text-text-secondary"}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-text-primary text-sm">{entry.username}</span>
                    <span className="text-text-secondary text-sm">{entry.count} rolls</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatHero({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    "neon-pink": "text-neon-pink",
    "neon-gold": "text-neon-gold",
    "neon-green": "text-neon-green",
  };
  return (
    <div className="bg-surface rounded-2xl p-4 border border-surface-2 text-center">
      <p className={`font-display text-3xl ${colorMap[color] ?? "text-text-primary"}`}>{value}</p>
      <p className="text-text-secondary text-xs uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-surface-2">
      <h3 className="text-text-secondary text-xs uppercase tracking-widest mb-3">{title}</h3>
      {children}
    </div>
  );
}
