"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  user_id: string;
  username: string;
  likeCount: number;
  likedByMe: boolean;
}

export default function FeedPage() {
  const supabase = createClient();
  const [rolls, setRolls] = useState<FeedRoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setMyUserId(user.id);

      // Fetch public rolls joined with profiles
      const { data: rollData } = await supabase
        .from("rolls")
        .select(`
          id, roll_time, red_die_number, white_die_number,
          red_drink_name, white_drink_name, red_drink_logo, white_drink_logo,
          is_doubles, user_id,
          profiles!inner(username, is_public),
          roll_likes(user_id)
        `)
        .filter("profiles.is_public", "eq", true)
        .order("roll_time", { ascending: false })
        .limit(50);

      if (rollData) {
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
          user_id: r.user_id,
          username: r.profiles?.username ?? "anonymous",
          likeCount: r.roll_likes?.length ?? 0,
          likedByMe: r.roll_likes?.some((l: { user_id: string }) => l.user_id === user?.id) ?? false,
        }));
        setRolls(mapped);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  async function toggleLike(rollId: number, likedByMe: boolean) {
    if (!myUserId) return;

    // Optimistic update
    setRolls((prev) =>
      prev.map((r) =>
        r.id === rollId
          ? {
              ...r,
              likedByMe: !likedByMe,
              likeCount: likedByMe ? r.likeCount - 1 : r.likeCount + 1,
            }
          : r
      )
    );

    if (likedByMe) {
      await supabase
        .from("roll_likes")
        .delete()
        .eq("roll_id", rollId)
        .eq("user_id", myUserId);
    } else {
      await supabase.from("roll_likes").insert({ roll_id: rollId, user_id: myUserId });
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="text-center mb-6">
        <h1 className="font-display text-4xl neon-text-pink tracking-widest">FEED</h1>
        <p className="text-text-secondary text-xs mt-1 tracking-widest">What&apos;s rolling at Jackie Lee&apos;s</p>
      </div>

      {loading ? (
        <div className="text-center text-text-secondary py-12">Loading...</div>
      ) : rolls.length === 0 ? (
        <div className="text-center py-12 text-text-secondary">
          <p className="text-5xl mb-4">🎲</p>
          <p>No public rolls yet.</p>
          <p className="text-sm mt-2">Make your profile public in Settings to appear here!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rolls.map((roll) => (
            <FeedCard
              key={roll.id}
              roll={roll}
              myUserId={myUserId}
              onToggleLike={toggleLike}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedCard({
  roll, onToggleLike,
}: {
  roll: FeedRoll;
  myUserId: string | null;
  onToggleLike: (id: number, likedByMe: boolean) => void;
}) {
  const [bouncing, setBouncing] = useState(false);

  function handleLike() {
    setBouncing(true);
    setTimeout(() => setBouncing(false), 400);
    onToggleLike(roll.id, roll.likedByMe);
  }

  const timeAgo = formatTimeAgo(roll.roll_time);

  return (
    <div className={`bg-surface rounded-2xl p-4 border ${roll.is_doubles ? "border-neon-gold/40" : "border-surface-2"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-text-primary text-sm font-semibold">{roll.username}</span>
          <p className="text-text-secondary text-xs">{timeAgo}</p>
        </div>
        {roll.is_doubles && (
          <span className="bg-neon-gold/20 border border-neon-gold text-neon-gold text-xs px-2 py-0.5 rounded-full font-display tracking-wider">
            DOUBLES!
          </span>
        )}
      </div>

      {/* Drinks */}
      <div className="flex items-center gap-3 mb-3">
        <MiniDrink
          name={roll.red_drink_name}
          logo={roll.red_drink_logo}
          dieNum={roll.red_die_number}
          color="red"
        />
        <span className="text-text-secondary">+</span>
        <MiniDrink
          name={roll.white_drink_name}
          logo={roll.white_drink_logo}
          dieNum={roll.white_die_number}
          color="white"
        />
      </div>

      {/* Like button */}
      <div className="flex items-center gap-2 pt-2 border-t border-surface-2">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 transition-all ${
            bouncing ? "scale-125" : "scale-100"
          } ${roll.likedByMe ? "text-neon-pink" : "text-text-secondary hover:text-neon-pink"}`}
        >
          <span className="text-lg">🎲</span>
          <span className="text-sm font-medium">{roll.likeCount}</span>
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
    <div className="flex items-center gap-1.5 flex-1">
      <div className={`w-7 h-7 rounded shrink-0 flex items-center justify-center ${
        isRed ? "bg-neon-pink/10" : "bg-surface-2"
      }`}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={name} className="w-5 h-5 object-contain" />
        ) : (
          <span className={`font-display text-xs ${isRed ? "text-neon-pink" : "text-text-primary"}`}>
            {dieNum}
          </span>
        )}
      </div>
      <span className="text-text-primary text-xs truncate">{name}</span>
    </div>
  );
}

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
