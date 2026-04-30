"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Shield, Users, TrendingUp, Zap, Dice6, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface DashboardStats {
  total_users: number;
  public_users: number;
  oath_users: number;
  dau: number;
  wau: number;
  mau: number;
  total_rolls: number;
  rolls_last_7d: number;
  rolls_last_30d: number;
  signups_by_day: { day: string; count: number }[];
  dau_by_day: { day: string; count: number }[];
  rolls_by_day: { day: string; count: number }[];
  user_growth_by_week: { week: string; new_users: number; cumulative: number }[];
  top_users_30d: { username: string; rolls: number }[];
}

// Fill date gaps so charts show every day in range
function fillDateRange(
  data: { day: string; count: number }[],
  days: number
): { day: string; count: number }[] {
  const map = Object.fromEntries(data.map((d) => [d.day, d.count]));
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ day: formatDay(key), count: map[key] ?? 0 });
  }
  return result;
}

function formatDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function formatWeek(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

const CHART_STYLE = {
  cartesian: { stroke: "#252525", strokeDasharray: "3 3" },
  axis: { fill: "#999999", fontSize: 11 },
  tooltip: {
    contentStyle: {
      background: "#1A1A1A",
      border: "1px solid #252525",
      borderRadius: 8,
      color: "#F5F5F5",
      fontSize: 12,
    },
    cursor: { fill: "rgba(255,255,255,0.04)" },
  },
};

function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-surface-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-text-secondary text-xs uppercase tracking-widest">{label}</p>
        <span className={accent}>{icon}</span>
      </div>
      <p className={`font-display text-3xl tracking-wider ${accent}`}>{value}</p>
      {sub && <p className="text-text-secondary text-xs">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-surface-2">
      <p className="text-text-secondary text-xs uppercase tracking-widest mb-4">{title}</p>
      {children}
    </div>
  );
}

export default function UsersDashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);

      const { data, error } = await supabase.rpc("get_admin_dashboard_stats");
      if (!error && data) setStats(data as DashboardStats);
      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <Shield className="w-12 h-12 text-neon-pink mx-auto mb-4" />
          <p className="text-text-primary font-display text-2xl">ACCESS DENIED</p>
          <p className="text-text-secondary text-sm mt-2">Admin only</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-secondary">No data available</p>
      </div>
    );
  }

  const signupsData = fillDateRange(stats.signups_by_day, 30);
  const dauData = fillDateRange(stats.dau_by_day, 30);
  const rollsData = fillDateRange(stats.rolls_by_day, 30);
  const growthData = stats.user_growth_by_week.map((w) => ({
    ...w,
    week: formatWeek(w.week),
  }));

  // Merge DAU and rolls into one dataset for the activity chart
  const activityData = dauData.map((d, i) => ({
    day: d.day,
    activeUsers: d.count,
    rolls: rollsData[i]?.count ?? 0,
  }));

  const dauPct =
    stats.total_users > 0 ? Math.round((stats.dau / stats.total_users) * 100) : 0;
  const wauPct =
    stats.total_users > 0 ? Math.round((stats.wau / stats.total_users) * 100) : 0;
  const mauPct =
    stats.total_users > 0 ? Math.round((stats.mau / stats.total_users) * 100) : 0;

  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-text-secondary text-xs mb-4 hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Admin
        </Link>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-neon-green" />
          <h1 className="font-display text-3xl neon-text-green tracking-widest">
            USER STATS
          </h1>
        </div>
        <p className="text-text-secondary text-xs mt-1">Last updated just now</p>
      </div>

      {/* Stat cards — Users */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Total Users"
          value={stats.total_users}
          sub={`${stats.public_users} public · ${stats.oath_users} oath`}
          accent="text-neon-pink"
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Total Rolls"
          value={stats.total_rolls.toLocaleString()}
          sub={`${stats.rolls_last_30d} last 30d`}
          accent="text-neon-gold"
          icon={<Dice6 className="w-4 h-4" />}
        />
      </div>

      {/* Active users — DAU / WAU / MAU */}
      <div className="bg-surface rounded-2xl p-4 border border-surface-2 mb-6">
        <p className="text-text-secondary text-xs uppercase tracking-widest mb-4">
          Active Users
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "DAU", value: stats.dau, pct: dauPct, sub: "24 hours" },
            { label: "WAU", value: stats.wau, pct: wauPct, sub: "7 days" },
            { label: "MAU", value: stats.mau, pct: mauPct, sub: "30 days" },
          ].map(({ label, value, pct, sub }) => (
            <div key={label} className="text-center">
              <p className="text-text-secondary text-xs mb-1">{label}</p>
              <p className="font-display text-2xl text-neon-green">{value}</p>
              <p className="text-text-secondary text-xs">{pct}% of users</p>
              <p className="text-text-secondary text-[10px]">{sub}</p>
            </div>
          ))}
        </div>
        {/* DAU/MAU ratio — industry health indicator */}
        <div className="mt-4 pt-3 border-t border-surface-2">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-text-secondary">DAU/MAU Ratio</span>
            <span className="text-neon-green font-medium">
              {stats.mau > 0 ? Math.round((stats.dau / stats.mau) * 100) : 0}%
            </span>
          </div>
          <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-neon-green rounded-full transition-all"
              style={{
                width: `${stats.mau > 0 ? Math.min((stats.dau / stats.mau) * 100, 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-text-secondary text-[10px] mt-1">
            {stats.mau > 0 && stats.dau / stats.mau >= 0.2
              ? "Strong engagement"
              : "Growing — typical for social apps"}
          </p>
        </div>
      </div>

      {/* Daily activity chart (DAU + rolls) */}
      <ChartCard title="Daily Activity — Last 30 Days">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={activityData}>
            <CartesianGrid {...CHART_STYLE.cartesian} />
            <XAxis
              dataKey="day"
              tick={CHART_STYLE.axis}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              tick={CHART_STYLE.axis}
              tickLine={false}
              axisLine={false}
              width={24}
            />
            <Tooltip {...CHART_STYLE.tooltip} />
            <Line
              type="monotone"
              dataKey="activeUsers"
              name="Active Users"
              stroke="#00FF88"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#00FF88" }}
            />
            <Line
              type="monotone"
              dataKey="rolls"
              name="Rolls"
              stroke="#FFD600"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#FFD600" }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 justify-end">
          <span className="text-[10px] text-neon-green flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-neon-green" /> Active Users
          </span>
          <span className="text-[10px] text-neon-gold flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-neon-gold" /> Rolls
          </span>
        </div>
      </ChartCard>

      {/* New signups chart */}
      <div className="mt-3">
        <ChartCard title="New Signups — Last 30 Days">
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={signupsData}>
              <defs>
                <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF2D55" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF2D55" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_STYLE.cartesian} />
              <XAxis
                dataKey="day"
                tick={CHART_STYLE.axis}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                tick={CHART_STYLE.axis}
                tickLine={false}
                axisLine={false}
                width={24}
                allowDecimals={false}
              />
              <Tooltip {...CHART_STYLE.tooltip} />
              <Area
                type="monotone"
                dataKey="count"
                name="New Users"
                stroke="#FF2D55"
                strokeWidth={2}
                fill="url(#signupGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#FF2D55" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Cumulative user growth */}
      {growthData.length > 0 && (
        <div className="mt-3">
          <ChartCard title="User Growth — All Time">
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD600" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FFD600" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_STYLE.cartesian} />
                <XAxis
                  dataKey="week"
                  tick={CHART_STYLE.axis}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(1, Math.floor(growthData.length / 6))}
                />
                <YAxis
                  tick={CHART_STYLE.axis}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip {...CHART_STYLE.tooltip} />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Total Users"
                  stroke="#FFD600"
                  strokeWidth={2}
                  fill="url(#growthGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#FFD600" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Top users this month */}
      {stats.top_users_30d.length > 0 && (
        <div className="mt-3">
          <ChartCard title="Most Active — Last 30 Days">
            <ResponsiveContainer width="100%" height={Math.min(stats.top_users_30d.length * 32, 280)}>
              <BarChart
                data={stats.top_users_30d}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
                <XAxis type="number" tick={CHART_STYLE.axis} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="username"
                  tick={CHART_STYLE.axis}
                  tickLine={false}
                  axisLine={false}
                  width={72}
                />
                <Tooltip {...CHART_STYLE.tooltip} />
                <Bar dataKey="rolls" name="Rolls" fill="#FF2D55" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Quick stats row */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div className="bg-surface rounded-2xl p-3 border border-surface-2 text-center">
          <Zap className="w-4 h-4 text-neon-gold mx-auto mb-1" />
          <p className="font-display text-xl text-neon-gold">{stats.rolls_last_7d}</p>
          <p className="text-text-secondary text-[10px]">Rolls this week</p>
        </div>
        <div className="bg-surface rounded-2xl p-3 border border-surface-2 text-center">
          <Users className="w-4 h-4 text-neon-pink mx-auto mb-1" />
          <p className="font-display text-xl text-neon-pink">{stats.public_users}</p>
          <p className="text-text-secondary text-[10px]">Public profiles</p>
        </div>
        <div className="bg-surface rounded-2xl p-3 border border-surface-2 text-center">
          <Shield className="w-4 h-4 text-neon-green mx-auto mb-1" />
          <p className="font-display text-xl text-neon-green">{stats.oath_users}</p>
          <p className="text-text-secondary text-[10px]">Oath takers</p>
        </div>
      </div>
    </div>
  );
}
