"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Achievement {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: string;
  category_name: string;
  category_emoji: string;
  target_count: number | null;
  sort_order: number;
}

interface UserAchievement {
  achievement_id: string;
  progress: number;
  progress_detail: { red?: number[]; white?: number[]; numbers?: number[]; combos?: string[] } | null;
  completed_at: string | null;
}

interface AchievementWithProgress extends Achievement {
  progress: number;
  progress_detail: { red?: number[]; white?: number[]; numbers?: number[]; combos?: string[] } | null;
  completed_at: string | null;
}

const CATEGORY_ORDER = [
  "youre_a_regular",
  "craps_table",
  "special_combos",
  "clocking_in",
  "danger_zone",
];

export default function AchievementsPage() {
  const supabase = createClient();
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Clear new-achievement notification dot on visit
    try {
      localStorage.removeItem("new_achievements");
    } catch {
      // ignore
    }

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: allAchievements }, { data: userProgress }] = await Promise.all([
        supabase.from("achievements").select("*").order("sort_order"),
        supabase
          .from("user_achievements")
          .select("achievement_id, progress, progress_detail, completed_at")
          .eq("user_id", user.id),
      ]);

      if (!allAchievements) return;

      const progressMap = new Map<string, UserAchievement>(
        (userProgress || []).map((ua) => [ua.achievement_id, ua])
      );

      const merged: AchievementWithProgress[] = allAchievements.map((a) => {
        const ua = progressMap.get(a.id);
        return {
          ...a,
          progress: ua?.progress ?? 0,
          progress_detail: ua?.progress_detail ?? null,
          completed_at: ua?.completed_at ?? null,
        };
      });

      setAchievements(merged);
      setLoading(false);
    }

    load();
  }, [supabase]);

  const earned = achievements.filter((a) => a.completed_at !== null).length;
  const total = achievements.length;

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: achievements.filter((a) => a.category === cat),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 space-y-6">
      <div className="text-center mb-2">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">ACHIEVEMENTS</h1>
        <p className="text-text-secondary text-xs mt-1 tracking-widest">
          {earned}/{total} EARNED
        </p>
      </div>

      {/* Overall progress bar */}
      <div className="bg-surface rounded-2xl p-4 border border-surface-2">
        <div className="flex justify-between text-xs text-text-secondary mb-2">
          <span>Progress</span>
          <span className="text-neon-gold font-semibold">
            {earned}/{total}
          </span>
        </div>
        <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-neon-gold rounded-full transition-all duration-500"
            style={{ width: `${total > 0 ? (earned / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      {byCategory.map(({ category, items }) => {
        const first = items[0];
        return (
          <div key={category} className="space-y-2">
            <h2 className="font-display text-lg tracking-widest text-text-secondary uppercase">
              {first.category_emoji} {first.category_name}
            </h2>
            <div className="space-y-2">
              {items.map((a) => (
                <AchievementCard key={a.id} achievement={a} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AchievementCard({ achievement: a }: { achievement: AchievementWithProgress }) {
  const isEarned = a.completed_at !== null;

  return (
    <div
      className={`bg-surface rounded-2xl p-4 border transition-colors ${
        isEarned ? "border-neon-gold/40" : "border-surface-2"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Emoji — full color if earned, dim if locked */}
        <span
          className={`text-3xl leading-none mt-0.5 shrink-0 transition-all ${
            isEarned ? "" : "grayscale opacity-30"
          }`}
        >
          {a.emoji}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-semibold text-sm ${isEarned ? "text-text-primary" : "text-text-secondary"}`}>
              {a.name}
            </p>
            {isEarned && (
              <span className="text-neon-green text-xs shrink-0">✓ Earned</span>
            )}
          </div>
          <p className="text-text-secondary text-xs mt-0.5">{a.description}</p>

          {/* Progress indicators */}
          {a.target_count !== null && !isEarned && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Progress</span>
                <span>{a.progress}/{a.target_count}</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neon-pink rounded-full"
                  style={{
                    width: `${Math.min(100, (a.progress / a.target_count) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Punch Card grid */}
          {a.id === "the_punch_card" && a.progress_detail && (
            <PunchCardGrid detail={a.progress_detail} />
          )}

          {/* Double Trouble tracker */}
          {a.id === "double_trouble" && (
            <DoublesGrid numbers={a.progress_detail?.numbers ?? []} />
          )}

          {/* Around the World grid */}
          {a.id === "around_the_world" && (
            <AroundTheWorldGrid combos={a.progress_detail?.combos ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}

function DoublesGrid({ numbers }: { numbers: number[] }) {
  const hit = new Set(numbers);

  return (
    <div className="mt-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`w-5 h-5 rounded text-[10px] flex items-center justify-center font-display ${
              hit.has(n)
                ? "bg-neon-pink text-background"
                : "bg-surface-2 text-text-secondary"
            }`}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

function AroundTheWorldGrid({ combos }: { combos: string[] }) {
  const hit = new Set(combos);

  return (
    <div className="mt-2 overflow-x-auto">
      <div className="inline-block">
        {/* Column headers — white die */}
        <div className="flex gap-0.5 mb-0.5 pl-5">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((w) => (
            <div key={w} className="w-4 h-4 text-[8px] text-text-secondary flex items-center justify-center">
              {w}
            </div>
          ))}
        </div>
        {/* Rows — red die */}
        {Array.from({ length: 8 }, (_, ri) => ri + 1).map((r) => (
          <div key={r} className="flex gap-0.5 mb-0.5">
            <div className="w-4 h-4 text-[8px] text-neon-pink flex items-center justify-center shrink-0">
              {r}
            </div>
            {Array.from({ length: 8 }, (_, wi) => wi + 1).map((w) => (
              <div
                key={w}
                className={`w-4 h-4 rounded-sm ${
                  hit.has(`${r}-${w}`) ? "bg-neon-gold" : "bg-surface-2"
                }`}
              />
            ))}
          </div>
        ))}
        <div className="flex gap-1 mt-1">
          <span className="text-[8px] text-neon-pink w-5 shrink-0">Red</span>
          <span className="text-[8px] text-text-secondary">{hit.size}/64 combos hit</span>
        </div>
      </div>
    </div>
  );
}

function PunchCardGrid({
  detail,
}: {
  detail: { red?: number[]; white?: number[] };
}) {
  const red = detail.red ?? [];
  const white = detail.white ?? [];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-neon-pink text-[10px] w-8">Red</span>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`w-5 h-5 rounded text-[10px] flex items-center justify-center font-display ${
              red.includes(n)
                ? "bg-neon-pink text-background"
                : "bg-surface-2 text-text-secondary"
            }`}
          >
            {n}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-text-secondary text-[10px] w-8">White</span>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`w-5 h-5 rounded text-[10px] flex items-center justify-center font-display ${
              white.includes(n)
                ? "bg-text-primary text-background"
                : "bg-surface-2 text-text-secondary"
            }`}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
