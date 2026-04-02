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
  times_completed?: number;
}

interface AchievementWithProgress extends Achievement {
  progress: number;
  progress_detail: { red?: number[]; white?: number[]; numbers?: number[]; combos?: string[] } | null;
  completed_at: string | null;
  times_completed: number;
}

const PUNCH_CARD_KEYCAP: Record<number, string> = {
  2: "2️⃣", 3: "3️⃣", 4: "4️⃣", 5: "5️⃣",
  6: "6️⃣", 7: "7️⃣", 8: "8️⃣", 9: "9️⃣", 10: "🔟",
};

const CATEGORY_ORDER = [
  "youre_a_regular",
  "craps_table",
  "special_combos",
  "clocking_in",
  "danger_zone",
];

type FilterMode = "all" | "earned" | "unearned";

export default function AchievementsPage() {
  const supabase = createClient();
  const [achievements, setAchievements] = useState<AchievementWithProgress[]>([]);
  const [rarityMap, setRarityMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterMode>("all");

  function toggleCategory(cat: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

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

      const [{ data: allAchievements }, { data: userProgress }, { data: rarityData }] = await Promise.all([
        supabase.from("achievements").select("*").order("sort_order"),
        supabase
          .from("user_achievements")
          .select("achievement_id, progress, progress_detail, completed_at, times_completed")
          .eq("user_id", user.id),
        supabase.rpc("get_achievement_rarity"),
      ]);

      if (!allAchievements) return;

      const progressMap = new Map<string, UserAchievement>(
        (userProgress || []).map((ua) => [ua.achievement_id, ua])
      );

      const rarityMap = new Map<string, number>(
        (rarityData || []).map((r: { achievement_id: string; unlock_count: number | string }) => [r.achievement_id, Number(r.unlock_count)])
      );

      const merged: AchievementWithProgress[] = allAchievements.map((a) => {
        const ua = progressMap.get(a.id);
        const timesCompleted = ua?.times_completed ?? 0;
        return {
          ...a,
          progress: ua?.progress ?? 0,
          progress_detail: ua?.progress_detail ?? null,
          completed_at: ua?.completed_at ?? null,
          times_completed: timesCompleted,
          // Override emoji for repeated Punch Card completions
          emoji: a.id === "the_punch_card" && timesCompleted >= 2
            ? `${PUNCH_CARD_KEYCAP[timesCompleted] ?? timesCompleted}🎟️`
            : a.emoji,
        };
      });

      setAchievements(merged);
      setRarityMap(rarityMap);
      setLoading(false);
    }

    load();
  }, [supabase]);

  function isAchievementEarned(a: AchievementWithProgress): boolean {
    if (a.id === "the_punch_card") return a.times_completed > 0;
    return a.completed_at !== null;
  }

  const earned = achievements.filter(isAchievementEarned).length;
  const total = achievements.length;

  const filteredAchievements = achievements.filter((a) => {
    if (filter === "earned") return isAchievementEarned(a);
    if (filter === "unearned") return !isAchievementEarned(a);
    return true;
  });

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: filteredAchievements
      .filter((a) => a.category === cat)
      .sort((a, b) => {
        const ra = rarityMap.get(a.id) ?? 0;
        const rb = rarityMap.get(b.id) ?? 0;
        return ra !== rb ? ra - rb : a.sort_order - b.sort_order;
      }),
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

      {/* Filter toggle */}
      <div className="flex gap-1 bg-surface rounded-2xl p-1 border border-surface-2">
        {(["all", "earned", "unearned"] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold tracking-widest uppercase transition-colors ${
              filter === mode
                ? "bg-neon-pink text-background"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {mode === "all" ? "All" : mode === "earned" ? "Earned" : "Unearned"}
          </button>
        ))}
      </div>

      {/* Categories */}
      {byCategory.map(({ category, items }) => {
        const first = items[0];
        const isCollapsed = collapsed.has(category);
        const earnedInCat = items.filter(isAchievementEarned).length;
        return (
          <div key={category} className="space-y-2">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between group"
            >
              <h2 className="font-display text-lg tracking-widest text-text-secondary uppercase">
                {first.category_emoji} {first.category_name}
              </h2>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-text-secondary">
                  {earnedInCat}/{items.length}
                </span>
                <span
                  className={`text-text-secondary transition-transform duration-200 ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                >
                  ▾
                </span>
              </div>
            </button>
            {!isCollapsed && (
              <div className="space-y-2">
                {items.map((a) => (
                  <AchievementCard key={a.id} achievement={a} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AchievementCard({ achievement: a }: { achievement: AchievementWithProgress }) {
  const isEarned = a.id === "the_punch_card" ? a.times_completed > 0 : a.completed_at !== null;

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
              <span className="text-neon-green text-xs shrink-0">
                {a.id === "the_punch_card" && a.times_completed > 1
                  ? `✓ ×${a.times_completed}`
                  : "✓ Earned"}
              </span>
            )}
          </div>
          <p className="text-text-secondary text-xs mt-0.5">{a.description}</p>

          {/* Progress indicators */}
          {a.target_count !== null && (a.id === "the_punch_card" ? true : !isEarned) && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>{a.id === "the_punch_card" && isEarned ? `Next punch card` : "Progress"}</span>
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
          {a.id === "the_punch_card" && (a.progress_detail || isEarned) && (
            <PunchCardGrid detail={a.progress_detail ?? {}} />
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
