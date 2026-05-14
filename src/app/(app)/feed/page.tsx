"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import UserProfileModal from "@/components/UserProfileModal";
import { Dice6 } from "lucide-react";
import { formatPartners } from "@/lib/twinsies";

const PAGE_SIZE = 50;

interface EarnedAchievement {
  name: string;
  emoji: string;
  category_emoji: string;
  category_name: string;
}

interface FeedRoll {
  id: number;
  roll_time: string;
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  red_drink_logo: string | null;
  white_drink_logo: string | null;
  is_doubles: boolean;
  is_daily_double: boolean;
  user_id: string;
  username: string;
  likeCount: number;
  likedByMe: boolean;
  achievements: EarnedAchievement[];
  twinPartners: string[];
}

export default function FeedPage() {
  const supabase = createClient();
  const [rolls, setRolls] = useState<FeedRoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [dailyDoubleLogo, setDailyDoubleLogo] = useState<{ beer: string | null; shot: string | null }>({ beer: null, shot: null });
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  // Tracks the roll_time of the last roll in `rolls` for keyset pagination.
  // Refs keep loadPage stable across re-renders so the observer doesn't churn.
  const lastTimeRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const inFlightRef = useRef(false);

  const loadPage = useCallback(async () => {
    if (inFlightRef.current || !hasMoreRef.current) return;
    inFlightRef.current = true;
    const isFirstPage = lastTimeRef.current === null;
    if (!isFirstPage) setLoadingMore(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (isFirstPage && user) setMyUserId(user.id);

    let query = supabase
      .from("rolls")
      .select(`
        id, roll_time, red_die_number, white_die_number,
        red_drink_name, white_drink_name, red_drink_logo, white_drink_logo,
        is_doubles, is_daily_double, user_id,
        profiles!inner(username),
        roll_likes(user_id)
      `)
      .order("roll_time", { ascending: false })
      .limit(PAGE_SIZE);
    if (lastTimeRef.current) query = query.lt("roll_time", lastTimeRef.current);
    const { data: rollData } = await query;

    if (!rollData || rollData.length === 0) {
      hasMoreRef.current = false;
      setHasMore(false);
      if (isFirstPage) setLoading(false);
      setLoadingMore(false);
      inFlightRef.current = false;
      return;
    }

    const rollIds = rollData.map((r: { id: number }) => r.id);
    const [
      { data: achievementData },
      { data: punchCardData },
      { data: twinData },
    ] = await Promise.all([
      supabase
        .from("user_achievements")
        .select("earned_on_roll_id, achievements(id, name, emoji, category_emoji, category_name)")
        .in("earned_on_roll_id", rollIds)
        .not("completed_at", "is", null),
      supabase
        .from("punch_card_completions")
        .select("earned_on_roll_id, completion_number")
        .in("earned_on_roll_id", rollIds),
      supabase
        .from("rolls_with_twins")
        .select("id, twin_partners")
        .in("id", rollIds),
    ]);

    const twinsByRoll: Record<number, string[]> = {};
    for (const row of (twinData ?? []) as Array<{ id: number; twin_partners: string[] | null }>) {
      if (row.twin_partners && row.twin_partners.length > 0) {
        twinsByRoll[row.id] = row.twin_partners;
      }
    }

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
    for (const pc of punchCardData ?? []) {
      if (!pc.earned_on_roll_id) continue;
      const emoji = "👊";
      if (!achievementsByRoll[pc.earned_on_roll_id]) achievementsByRoll[pc.earned_on_roll_id] = [];
      achievementsByRoll[pc.earned_on_roll_id].push({
        name: "The Punch Card", emoji,
        category_emoji: "💎", category_name: "You're a Regular",
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: FeedRoll[] = rollData.map((r: any) => ({
      id: r.id,
      roll_time: r.roll_time,
      red_die_number: r.red_die_number,
      white_die_number: r.white_die_number,
      red_drink_name: r.red_drink_name,
      white_drink_name: r.white_drink_name,
      red_drink_logo: r.red_drink_logo,
      white_drink_logo: r.white_drink_logo,
      is_doubles: r.is_doubles,
      is_daily_double: r.is_daily_double ?? false,
      user_id: r.user_id,
      username: r.profiles?.username ?? "anonymous",
      likeCount: r.roll_likes?.length ?? 0,
      likedByMe: r.roll_likes?.some((l: { user_id: string }) => l.user_id === user?.id) ?? false,
      achievements: achievementsByRoll[r.id] ?? [],
      twinPartners: twinsByRoll[r.id] ?? [],
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
  }, [supabase]);

  // Initial load: daily-double logos + first page of rolls
  useEffect(() => {
    async function loadOnce() {
      const { data: ddItems } = await supabase
        .from("menu_items")
        .select("die_number, logo_url")
        .eq("die_color", "daily_double");
      if (ddItems) {
        const beer = ddItems.find((i) => i.die_number === 1)?.logo_url ?? null;
        const shot = ddItems.find((i) => i.die_number === 2)?.logo_url ?? null;
        setDailyDoubleLogo({ beer, shot });
      }
      await loadPage();
    }
    loadOnce();
  }, [supabase, loadPage]);

  // IntersectionObserver sentinel: when the bottom sentinel scrolls into
  // view, kick off the next page. The observer ref is set by the <div>
  // ref callback below.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadPage();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadPage, hasMore, loading]);

  async function toggleLike(rollId: number, likedByMe: boolean) {
    if (!myUserId) return;
    setRolls((prev) =>
      prev.map((r) =>
        r.id === rollId
          ? { ...r, likedByMe: !likedByMe, likeCount: likedByMe ? r.likeCount - 1 : r.likeCount + 1 }
          : r
      )
    );
    if (likedByMe) {
      await supabase.from("roll_likes").delete().eq("roll_id", rollId).eq("user_id", myUserId);
    } else {
      await supabase.from("roll_likes").insert({ roll_id: rollId, user_id: myUserId });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3.5 shrink-0">
        <div className="w-8" />
        <div className="text-center">
          <h1 className="neon-title font-display text-[38px] tracking-[0.32em] leading-none">FEED</h1>
          <p className="font-display text-[11px] tracking-[0.14em] text-text-muted mt-1">
            WHAT&apos;S ROLLING AT JACKIE LEE&apos;S
          </p>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-[18px] pb-[84px]">
        {loading ? (
          <div className="text-center text-text-secondary py-12">Loading...</div>
        ) : rolls.length === 0 ? (
          <div className="text-center py-12 text-text-secondary">
            <p className="text-5xl mb-4">🎲</p>
            <p>No public rolls yet.</p>
            <p className="text-sm mt-2">Make your profile public in Settings to appear here!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rolls.map((roll) => (
              <FeedCard
                key={roll.id}
                roll={roll}
                myUserId={myUserId}
                onToggleLike={toggleLike}
                dailyDoubleLogo={dailyDoubleLogo}
                onUserClick={setSelectedUser}
              />
            ))}
            <div ref={sentinelRef} className="h-1" aria-hidden />
            {loadingMore && (
              <div className="text-center text-text-secondary py-4 font-display text-[11px] tracking-[0.18em]">
                LOADING MORE…
              </div>
            )}
            {!hasMore && !loadingMore && rolls.length > 0 && (
              <div className="text-center text-text-muted py-6 font-display text-[10px] tracking-[0.22em]">
                · END OF THE LINE ·
              </div>
            )}
          </div>
        )}
      </div>

      {selectedUser && (
        <UserProfileModal username={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}

function FeedCard({
  roll, onToggleLike, dailyDoubleLogo, onUserClick,
}: {
  roll: FeedRoll;
  myUserId: string | null;
  onToggleLike: (id: number, likedByMe: boolean) => void;
  dailyDoubleLogo: { beer: string | null; shot: string | null };
  onUserClick: (username: string) => void;
}) {
  const [bouncing, setBouncing] = useState(false);

  function handleLike() {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 400);
    onToggleLike(roll.id, roll.likedByMe);
  }

  const timeAgo = formatTimeAgo(roll.roll_time);
  const timestamp = new Date(roll.roll_time).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });

  const redLogo = roll.is_daily_double ? dailyDoubleLogo.beer : roll.red_drink_logo;
  const whiteLogo = roll.is_daily_double ? dailyDoubleLogo.shot : roll.white_drink_logo;

  return (
    <div
      className="bg-surface rounded-2xl p-[12px_14px] border"
      style={{
        borderColor: roll.is_doubles ? "rgba(255,214,0,0.55)" : "#252525",
        boxShadow: roll.is_doubles ? "0 0 16px rgba(255,214,0,0.12)" : "none",
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <button
            onClick={() => onUserClick(roll.username)}
            className="text-text-primary text-[13px] font-semibold hover:text-neon-pink transition-colors"
          >
            {roll.username}
          </button>
          <p className="font-display text-[10px] tracking-[0.08em] text-text-muted mt-0.5">
            {timeAgo} · {timestamp}
          </p>
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
      <div className="flex items-center gap-2.5 mb-2.5">
        <MiniDrink name={roll.red_drink_name} logo={redLogo} dieNum={roll.red_die_number} color="red" />
        <span className="text-text-muted text-sm shrink-0">+</span>
        <MiniDrink name={roll.white_drink_name} logo={whiteLogo} dieNum={roll.white_die_number} color="white" />
      </div>

      {/* Twinsies indicator */}
      {roll.twinPartners.length > 0 && (
        <div className="mb-2.5">
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
        <div className="flex flex-wrap gap-1.5 mb-2.5">
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

      {/* Like row */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-surface-2">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 transition-all"
          style={{
            color: roll.likedByMe ? "#FF2D55" : "#555",
            transform: bouncing ? "scale(1.25)" : "scale(1)",
            transition: "transform 0.18s, color 0.15s",
          }}
        >
          <Dice6
            className="w-4 h-4"
            strokeWidth={roll.likedByMe ? 2.5 : 1.5}
          />
          <span className="font-display text-[11px]">{roll.likeCount}</span>
        </button>
      </div>
    </div>
  );
}

function MiniDrink({ name, logo, dieNum, color }: {
  name: string;
  logo: string | null;
  dieNum: number;
  color: "red" | "white";
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
        <p className="text-text-primary text-[12px] leading-snug truncate">{name}</p>
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

function formatTimeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
