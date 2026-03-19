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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const NEON_COLORS = ["#FF2D55", "#FFD600", "#00FF88", "#FF6B9D", "#FFF066", "#66FFB3", "#FF9966", "#AA66FF"];

export default function StatsPage() {
  const supabase = createClient();
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ username: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rollData } = await supabase
        .from("rolls")
        .select("*")
        .eq("user_id", user.id)
        .order("roll_time", { ascending: true });

      if (rollData) setRolls(rollData);

      // Public leaderboard
      const { data: pubRolls } = await supabase
        .from("rolls")
        .select("user_id, profiles!inner(username, is_public)")
        .filter("profiles.is_public", "eq", true);

      if (pubRolls) {
        const counts: Record<string, { username: string; count: number }> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pubRolls.forEach((r: any) => {
          const uid = r.user_id;
          const uname = r.profiles?.username ?? "unknown";
          if (!counts[uid]) counts[uid] = { username: uname, count: 0 };
          counts[uid].count++;
        });
        setLeaderboard(
          Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10)
        );
      }

      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-secondary">Loading stats...</p>
      </div>
    );
  }

  const totalRolls = rolls.length;
  const totalDoubles = rolls.filter((r) => r.is_doubles).length;
  const doublesPercent = totalRolls > 0 ? ((totalDoubles / totalRolls) * 100).toFixed(1) : "0";

  // Die frequency data
  const redFreq = Array.from({ length: 8 }, (_, i) => ({
    num: `${i + 1}`,
    count: rolls.filter((r) => r.red_die_number === i + 1).length,
  }));
  const whiteFreq = Array.from({ length: 8 }, (_, i) => ({
    num: `${i + 1}`,
    count: rolls.filter((r) => r.white_die_number === i + 1).length,
  }));

  // Drink frequency
  const drinkCounts: Record<string, number> = {};
  rolls.forEach((r) => {
    drinkCounts[r.red_drink_name] = (drinkCounts[r.red_drink_name] || 0) + 1;
    drinkCounts[r.white_drink_name] = (drinkCounts[r.white_drink_name] || 0) + 1;
  });
  const topDrinks = Object.entries(drinkCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name: name.length > 10 ? name.slice(0, 10) + "…" : name, count }));

  // Day of week
  const dayFreq = DAYS.map((day, i) => ({
    day,
    count: rolls.filter((r) => new Date(r.roll_time).getDay() === i).length,
  }));

  // Streak calculation
  const uniqueDays = Array.from(new Set(rolls.map((r) => r.roll_date))).sort();
  let streak = 0;
  if (uniqueDays.length > 0) {
    const checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const ds = checkDate.toISOString().split("T")[0];
      if (uniqueDays.includes(ds)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 space-y-6">
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">STATS</h1>
      </div>

      {/* Hero numbers */}
      <div className="grid grid-cols-3 gap-3">
        <StatHero label="TOTAL ROLLS" value={totalRolls.toString()} color="neon-pink" />
        <StatHero label="DOUBLES" value={totalDoubles.toString()} color="neon-gold" />
        <StatHero label="DBL %" value={`${doublesPercent}%`} color="neon-green" />
      </div>

      <StatHero label="CURRENT STREAK" value={`${streak} day${streak !== 1 ? "s" : ""}`} color="neon-pink" />

      {/* Red die frequency */}
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

          {/* White die frequency */}
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

          {/* Top drinks */}
          {topDrinks.length > 0 && (
            <ChartCard title="🍺 Most Rolled Drinks">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topDrinks} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: "#999", fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "#F5F5F5", fontSize: 10 }} width={80} />
                  <Tooltip
                    contentStyle={{ background: "#1A1A1A", border: "1px solid #252525", borderRadius: 8 }}
                    itemStyle={{ color: "#FFD600" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {topDrinks.map((_, i) => (
                      <Cell key={i} fill={NEON_COLORS[i % NEON_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Day of week */}
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
          <p>No rolls yet — get out there!</p>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
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
