"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import UserProfileModal from "@/components/UserProfileModal";
import { type PodiumAchievement, type PodiumRoller } from "@/components/PodiumLeaderboard";
import { ChevronLeft, Trophy } from "lucide-react";

const T = {
  surface:  "#1A1A1A",
  border:   "#252525",
  pink:     "#FF2D55",
  gold:     "#FFD600",
  text:     "#F5F5F5",
  textDim:  "#999999",
  textMute: "#555555",
} as const;

const RANK_COLOR: Record<number, string> = { 1: "#FFD600", 2: "#C9C9C9", 3: "#E08A4A" };
function rankColor(rank: number) { return RANK_COLOR[rank] ?? T.textMute; }

interface RollerRow extends PodiumRoller {
  rank: number;
}

function EmojiStamp({ ach, accent }: { ach: PodiumAchievement; accent: string }) {
  return (
    <span
      role="img"
      aria-label={ach.name}
      title={ach.name}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 16,
        height: 16,
        borderRadius: 5,
        background: `${accent}14`,
        border: `1px solid ${accent}50`,
        boxShadow: `0 0 4px ${accent}30`,
        fontSize: 10,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {ach.emoji}
    </span>
  );
}

function LeaderRow({
  m,
  achievements,
  onTap,
}: {
  m: RollerRow;
  achievements: PodiumAchievement[];
  onTap: () => void;
}) {
  const isYou  = m.you;
  const rc     = rankColor(m.rank);
  const accent = isYou ? T.pink : m.rank <= 3 ? rc : T.gold;

  const sortSet   = new Set(m.earned_sort_orders);
  const earnedAch = achievements.filter((a) => sortSet.has(a.sort_order));

  return (
    <button
      onClick={onTap}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: isYou ? "8px 10px" : "6px 0",
          margin: isYou ? "-4px -10px" : 0,
          background: isYou
            ? "linear-gradient(90deg, rgba(255,45,85,0.11), rgba(255,45,85,0.02) 70%, transparent)"
            : "transparent",
          border: isYou ? "1px solid rgba(255,45,85,0.31)" : "none",
          borderRadius: isYou ? 8 : 0,
          boxShadow: isYou ? "0 0 12px rgba(255,45,85,0.15)" : "none",
        }}
      >
        {/* Rank */}
        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: 11,
            fontWeight: 700,
            width: 26,
            textAlign: "right",
            flexShrink: 0,
            color: m.rank <= 3 ? rc : T.textMute,
            textShadow: m.rank === 1 ? `0 0 6px ${rc}80` : "none",
          }}
        >
          #{m.rank}
        </span>

        {/* Avatar chip */}
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#0D0D0D",
            border: `1.5px solid ${m.rank <= 3 ? rc : isYou ? T.pink : T.border}`,
            boxShadow: m.rank <= 3 ? `0 0 6px ${rc}55` : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Space Mono, monospace",
            fontWeight: 700,
            fontSize: 11,
            color: m.rank <= 3 ? rc : isYou ? T.pink : T.textDim,
            flexShrink: 0,
          }}
        >
          {m.username.slice(0, 2).toUpperCase()}
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: isYou ? 700 : 500,
              fontSize: 13,
              color: isYou ? T.pink : T.text,
              textShadow: isYou ? "0 0 6px rgba(255,45,85,0.38)" : "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            @{m.username}
            {isYou && (
              <span
                style={{
                  color: T.textDim,
                  marginLeft: 5,
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  fontWeight: 400,
                  fontFamily: "Space Mono, monospace",
                }}
              >
                YOU
              </span>
            )}
          </span>

          {earnedAch.length > 0 && (
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {earnedAch.map((a) => (
                <EmojiStamp key={a.id} ach={a} accent={accent} />
              ))}
            </div>
          )}
        </div>

        {/* Roll count */}
        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontWeight: 700,
            fontSize: 15,
            color: isYou ? T.pink : m.rank <= 3 ? rc : T.text,
            textShadow:
              m.rank === 1
                ? `0 0 10px ${rc}60`
                : isYou
                ? "0 0 6px rgba(255,45,85,0.38)"
                : "none",
            flexShrink: 0,
            textAlign: "right",
          }}
        >
          {m.rolls}
          <span
            style={{
              color: T.textDim,
              marginLeft: 3,
              fontWeight: 400,
              fontSize: 9,
              letterSpacing: "0.14em",
            }}
          >
            RLS
          </span>
        </span>
      </div>
    </button>
  );
}

export default function FullLeaderboardPage() {
  const supabase = createClient();
  const router   = useRouter();

  const [achievements, setAchievements] = useState<PodiumAchievement[]>([]);
  const [rollers, setRollers]           = useState<RollerRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.rpc("get_full_leaderboard");
      if (data) {
        const raw = data as {
          achievements: PodiumAchievement[];
          rollers: (PodiumRoller & { user_id: string })[];
        };
        setAchievements(raw.achievements);
        setRollers(
          raw.rollers.map((r, i) => ({
            ...r,
            rank: i + 1,
            you: r.user_id === user?.id,
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 20px 14px",
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: T.textDim,
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: 0,
          }}
        >
          <ChevronLeft size={18} />
          <span
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.14em",
            }}
          >
            BACK
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Trophy size={14} color={T.gold} strokeWidth={2} />
          <h1
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: T.text,
              margin: 0,
            }}
          >
            ALL ROLLERS
          </h1>
        </div>

        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.14em",
            color: T.textMute,
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {rollers.length > 0 ? `${rollers.length} TOTAL` : ""}
        </span>
      </div>

      <div style={{ padding: "0 18px 84px" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: 80,
            }}
          >
            <p
              style={{
                fontFamily: "Space Mono, monospace",
                fontSize: 11,
                color: T.textMute,
                letterSpacing: "0.14em",
              }}
            >
              LOADING...
            </p>
          </div>
        ) : (
          <div
            style={{
              background: T.surface,
              border: `1px solid rgba(255, 214, 0, 0.25)`,
              borderRadius: 16,
              padding: "14px 14px",
              boxShadow: "0 0 18px rgba(255, 214, 0, 0.08)",
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontFamily: "Space Mono, monospace",
                fontSize: 8,
                letterSpacing: "0.2em",
                color: T.textMute,
                fontWeight: 700,
                paddingBottom: 10,
                marginBottom: 4,
                borderBottom: `1px dashed ${T.border}`,
              }}
            >
              <span style={{ width: 26, textAlign: "right" }}>#</span>
              <span style={{ width: 30, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>ROLLER</span>
              <span>ROLLS</span>
            </div>

            {/* Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {rollers.map((m) => (
                <LeaderRow
                  key={m.user_id}
                  m={m}
                  achievements={achievements}
                  onTap={() => setSelectedUser(m.username)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserProfileModal username={selectedUser} onClose={() => setSelectedUser(null)} />
      )}
    </div>
  );
}
