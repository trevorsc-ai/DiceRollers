"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";

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
  hidden: boolean;
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
  "holiday",
];

type FilterMode = "all" | "earned" | "locked";

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
    try { localStorage.removeItem("new_achievements"); } catch { /* ignore */ }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
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
      const rarityMapData = new Map<string, number>(
        (rarityData || []).map((r: { achievement_id: string; unlock_count: number | string }) => [
          r.achievement_id, Number(r.unlock_count),
        ])
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
          emoji:
            a.id === "the_punch_card" && timesCompleted >= 2
              ? `${PUNCH_CARD_KEYCAP[timesCompleted] ?? timesCompleted}🎟️`
              : a.emoji,
        };
      });

      setAchievements(merged);
      setRarityMap(rarityMapData);
      setLoading(false);
    }

    load();
  }, [supabase]);

  function isEarned(a: AchievementWithProgress): boolean {
    if (a.id === "the_punch_card") return a.times_completed > 0;
    return a.completed_at !== null;
  }

  const visibleAchievements = achievements.filter((a) => !a.hidden || isEarned(a));
  const earned = visibleAchievements.filter(isEarned).length;
  const total = visibleAchievements.length;

  const filteredAchievements = achievements.filter((a) => {
    if (a.hidden && !isEarned(a)) return false;
    if (filter === "earned") return isEarned(a);
    if (filter === "locked") return !isEarned(a);
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="neon-title font-display text-[32px] tracking-[0.32em] leading-none">ACHIEVEMENTS</h1>
          <p className="font-display text-[11px] tracking-[0.14em] text-text-muted mt-1">
            {earned}/{total} EARNED
          </p>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-[18px] pb-[84px] flex flex-col gap-4">
        {/* Overall progress card */}
        <div className="bg-surface border border-surface-2 rounded-[18px] p-[12px_14px]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-display text-[10px] tracking-[0.18em] text-text-secondary">OVERALL</span>
            <span
              className="font-display text-[13px] font-bold"
              style={{ color: "#FFD600", textShadow: "0 0 10px rgba(255,214,0,0.5)" }}
            >
              {earned}/{total}
            </span>
          </div>
          <div className="h-2 bg-background rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${total > 0 ? (earned / total) * 100 : 0}%`,
                background: "#FFD600",
                boxShadow: "0 0 8px rgba(255,214,0,0.5)",
              }}
            />
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex bg-surface border border-surface-2 rounded-xl p-[3px] gap-0.5">
          {(["all", "earned", "locked"] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`flex-1 py-[7px] rounded-[9px] font-display text-[10px] tracking-[0.20em] font-bold transition-all ${
                filter === m ? "bg-neon-pink text-background" : "bg-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              {m === "all" ? "ALL" : m === "earned" ? "EARNED" : "LOCKED"}
            </button>
          ))}
        </div>

        {/* Categories */}
        {byCategory.map(({ category, items }) => {
          const first = items[0];
          const isCollapsed = collapsed.has(category);
          const earnedInCat = items.filter(isEarned).length;
          return (
            <div key={category} className="space-y-2">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between py-1"
              >
                <h2 className="font-display text-[11px] tracking-[0.22em] font-bold text-text-primary">
                  {first.category_emoji} {first.category_name.toUpperCase()}
                </h2>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-display text-[10px] text-text-secondary">
                    {earnedInCat}/{items.length}
                  </span>
                  <ChevronDown
                    className="w-3.5 h-3.5 text-text-secondary transition-transform duration-200"
                    strokeWidth={2}
                    style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                  />
                </div>
              </button>

              {!isCollapsed && (
                <div className="space-y-2">
                  {items.map((a) => (
                    <AchievementCard key={a.id} achievement={a} earned={isEarned(a)} rarityCount={rarityMap.get(a.id)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AchievementCard({
  achievement: a,
  earned,
  rarityCount,
}: {
  achievement: AchievementWithProgress;
  earned: boolean;
  rarityCount?: number;
}) {
  return (
    <div
      className="bg-surface rounded-2xl p-3 border transition-colors"
      style={{
        borderColor: earned ? "rgba(255,214,0,0.4)" : "#252525",
        boxShadow: earned ? "0 0 16px rgba(255,214,0,0.08)" : "none",
      }}
    >
      <div className="flex items-start gap-3">
        {/* Badge */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 mt-0.5"
          style={
            earned
              ? { background: "rgba(255,214,0,0.15)", border: "1px solid rgba(255,214,0,0.6)" }
              : { background: "#0D0D0D", border: "1px solid #252525", filter: "grayscale(1) opacity(0.4)" }
          }
        >
          {a.hidden && !earned ? "?" : a.emoji}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={`font-semibold text-[13px] truncate ${earned ? "text-text-primary" : "text-text-secondary"}`}>
                {a.name}
              </p>
              {a.hidden && earned && (
                <span className="font-display text-[8px] font-bold tracking-widest text-neon-gold border border-neon-gold/50 rounded px-1 py-0.5 leading-none shrink-0">
                  SECRET
                </span>
              )}
            </div>
            {earned ? (
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className="font-display text-[10px] text-neon-green">
                  {a.id === "the_punch_card" && a.times_completed > 1
                    ? `✓ ×${a.times_completed}`
                    : "✓ EARNED"}
                </span>
                {rarityCount !== undefined && (
                  <span className="font-display text-[9px] text-text-muted">
                    {rarityCount} earned
                  </span>
                )}
              </div>
            ) : (
              rarityCount !== undefined && (
                <span className="font-display text-[9px] text-text-muted shrink-0">
                  {rarityCount} earned
                </span>
              )
            )}
          </div>

          {/* Description */}
          <p className="text-text-secondary text-[11px] mt-0.5 leading-[1.4]">{a.description}</p>

          {/* Progress bar */}
          {a.target_count !== null && (a.id === "the_punch_card" ? true : !earned) && (
            <div className="mt-2">
              <div className="flex justify-between font-display text-[9px] text-text-secondary mb-1">
                <span>{a.id === "the_punch_card" && earned ? "Next punch card" : "Progress"}</span>
                <span>{a.progress}/{a.target_count}</span>
              </div>
              <div className="h-[5px] bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (a.progress / a.target_count) * 100)}%`,
                    background: "#FF2D55",
                    boxShadow: "0 0 6px rgba(255,45,85,0.5)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Punch Card grid */}
          {a.id === "the_punch_card" && (a.progress_detail || earned) && (
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
    <div className="mt-2 flex items-center gap-1">
      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className="w-[22px] h-[22px] rounded text-[10px] flex items-center justify-center font-display"
          style={
            hit.has(n)
              ? { background: "#FF2D55", color: "#0D0D0D", boxShadow: "0 0 6px rgba(255,45,85,0.5)" }
              : { background: "#0D0D0D", border: "1px solid #252525", color: "#555" }
          }
        >
          {n}
        </div>
      ))}
    </div>
  );
}

function AroundTheWorldGrid({ combos }: { combos: string[] }) {
  const hit = new Set(combos);
  return (
    <div className="mt-2 overflow-x-auto">
      <div className="inline-block">
        <div className="flex gap-0.5 mb-0.5 pl-5">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((w) => (
            <div key={w} className="w-4 h-4 text-[8px] text-text-secondary flex items-center justify-center">{w}</div>
          ))}
        </div>
        {Array.from({ length: 8 }, (_, ri) => ri + 1).map((r) => (
          <div key={r} className="flex gap-0.5 mb-0.5">
            <div className="w-4 h-4 text-[8px] text-neon-pink flex items-center justify-center shrink-0">{r}</div>
            {Array.from({ length: 8 }, (_, wi) => wi + 1).map((w) => (
              <div
                key={w}
                className="w-4 h-4 rounded-sm"
                style={hit.has(`${r}-${w}`) ? { background: "#FFD600" } : { background: "#252525" }}
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

function PunchCardGrid({ detail }: { detail: { red?: number[]; white?: number[] } }) {
  const red = detail.red ?? [];
  const white = detail.white ?? [];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-neon-pink text-[10px] w-8 font-display">Red</span>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className="w-5 h-5 rounded text-[10px] flex items-center justify-center font-display"
            style={
              red.includes(n)
                ? { background: "#FF2D55", color: "#0D0D0D", boxShadow: "0 0 5px rgba(255,45,85,0.5)" }
                : { background: "#0D0D0D", border: "1px solid #252525", color: "#555" }
            }
          >
            {n}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-text-secondary text-[10px] w-8 font-display">White</span>
        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className="w-5 h-5 rounded text-[10px] flex items-center justify-center font-display"
            style={
              white.includes(n)
                ? { background: "#F5F5F5", color: "#0D0D0D" }
                : { background: "#0D0D0D", border: "1px solid #252525", color: "#555" }
            }
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
