"use client";

import { Trophy, Crown } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────── */

export interface PodiumAchievement {
  id: string;
  emoji: string;
  name: string;
  sort_order: number;
}

export interface PodiumRoller {
  user_id: string;
  username: string;
  rolls: number;
  /** sort_order values of earned achievements from this section's catalogue */
  earned_sort_orders: number[];
  /** stamped true when this row belongs to the current user */
  you: boolean;
}

export interface PodiumLeaderboardData {
  total_rollers: number;
  achievements: PodiumAchievement[];
  rollers: PodiumRoller[];
}

interface Props {
  data: PodiumLeaderboardData;
  onUserTap?: (username: string) => void;
}

/* ── Theme constants ─────────────────────────────────────────────── */

const T = {
  surface:  "#1A1A1A",
  border:   "#252525",
  pink:     "#FF2D55",
  gold:     "#FFD600",
  text:     "#F5F5F5",
  textDim:  "#999999",
  textMute: "#555555",
} as const;

const RANK_COLOR: Record<number, string> = {
  1: "#FFD600",   // gold
  2: "#C9C9C9",   // silver
  3: "#E08A4A",   // bronze
};

function rankColor(rank: number): string {
  return RANK_COLOR[rank] ?? T.textDim;
}

/* ── Emoji badge — circular, used in podium wall ────────────────── */

function EmojiBadge({
  ach,
  size,
  accent,
}: {
  ach: PodiumAchievement;
  size: number;
  accent: string;
}) {
  return (
    <span
      role="img"
      aria-label={ach.name}
      title={ach.name}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#0D0D0D",
        border: `1.2px solid ${accent}`,
        boxShadow: `0 0 6px ${accent}80, inset 0 0 4px ${accent}30`,
        fontSize: Math.round(size * 0.55),
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {ach.emoji}
    </span>
  );
}

/* ── Empty badge — dashed circle for unearned slots ────────────── */

function EmptyBadge({ size }: { size: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `1px dashed ${T.border}`,
        opacity: 0.5,
        flexShrink: 0,
      }}
    />
  );
}

/* ── Emoji stamp — rounded square, used in tail rows ───────────── */

function EmojiStamp({
  ach,
  accent,
}: {
  ach: PodiumAchievement;
  accent: string;
}) {
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

/* ── Podium pillar ───────────────────────────────────────────────── */

const PILLAR_HEIGHT: Record<number, number> = { 1: 90, 2: 64, 3: 48 };
const AVATAR_SIZE: Record<number, number>   = { 1: 50, 2: 42, 3: 42 };
const BADGE_SIZE: Record<number, number>    = { 1: 22, 2: 20, 3: 20 };
const ROLL_FONT: Record<number, number>     = { 1: 30, 2: 22, 3: 22 };
const INIT_FONT: Record<number, number>     = { 1: 16, 2: 13, 3: 13 };

function PodiumStep({
  m,
  achievements,
  achTotal,
  onTap,
}: {
  m: PodiumRoller & { rank: number };
  achievements: PodiumAchievement[];
  achTotal: number;
  onTap?: () => void;
}) {
  const c         = rankColor(m.rank);
  const height    = PILLAR_HEIGHT[m.rank];
  const avatarSz  = AVATAR_SIZE[m.rank];
  const badgeSz   = BADGE_SIZE[m.rank];
  const rollFont  = ROLL_FONT[m.rank];
  const initFont  = INIT_FONT[m.rank];

  // Map sort_orders → achievement objects, preserving canonical order
  const sortSet   = new Set(m.earned_sort_orders);
  const earnedAch = achievements.filter((a) => sortSet.has(a.sort_order));
  const emptySlots = Math.max(0, achTotal - earnedAch.length);

  const initials  = m.username.slice(0, 2).toUpperCase();
  const label     = m.username.length > 9
    ? `@${m.username.slice(0, 8)}…`
    : `@${m.username}`;

  return (
    <button
      onClick={onTap}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        minWidth: 0,
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: onTap ? "pointer" : "default",
      }}
    >
      {/* Avatar */}
      <div style={{ position: "relative" }}>
        {m.rank === 1 && (
          <div
            style={{
              position: "absolute",
              top: -14,
              left: "50%",
              transform: "translateX(-50%)",
              filter: "drop-shadow(0 0 6px rgba(255,214,0,0.8))",
            }}
          >
            <Crown size={18} fill="#FFD600" color="#FFD600" strokeWidth={0} />
          </div>
        )}
        <div
          style={{
            width: avatarSz,
            height: avatarSz,
            borderRadius: "50%",
            background: "#0D0D0D",
            border: `2px solid ${c}`,
            boxShadow: m.rank === 1
              ? `0 0 16px rgba(255, 214, 0, 0.56)`
              : `0 0 8px ${c}55`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Space Mono, monospace",
            fontWeight: 700,
            fontSize: initFont,
            color: c,
          }}
        >
          {initials}
        </div>
      </div>

      {/* Username */}
      <span
        style={{
          fontFamily: "Space Mono, monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: m.you ? T.pink : T.text,
          textShadow: m.you ? "0 0 6px rgba(255,45,85,0.38)" : "none",
          maxWidth: "100%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>

      {/* Podium block — hero roll number */}
      <div
        style={{
          width: "100%",
          height,
          background: `linear-gradient(180deg, ${c}30, ${c}08)`,
          border: `1px solid ${c}60`,
          borderBottom: "none",
          borderRadius: "10px 10px 0 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 10,
          gap: 3,
          ...(m.rank === 1 && {
            boxShadow: `inset 0 -22px 28px rgba(255, 214, 0, 0.09)`,
            animation: "goldShimmer 2.6s ease-in-out infinite",
          }),
        }}
      >
        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.2em",
            color: c,
          }}
        >
          #{m.rank}
        </span>
        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: rollFont,
            fontWeight: 700,
            color: c,
            lineHeight: 1,
            textShadow: `0 0 10px ${c}60`,
          }}
        >
          {m.rolls}
        </span>
        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: T.textMute,
          }}
        >
          ROLLS
        </span>
      </div>

      {/* Emoji wall */}
      <div
        style={{
          width: "100%",
          background: `linear-gradient(180deg, ${c}10, transparent)`,
          border: `1px solid ${c}40`,
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          padding: "8px 6px 9px",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 5,
          justifyItems: "center",
        }}
      >
        {earnedAch.map((a) => (
          <EmojiBadge key={a.id} ach={a} size={badgeSz} accent={c} />
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <EmptyBadge key={`empty-${i}`} size={badgeSz} />
        ))}
      </div>

      {/* X/N EARNED */}
      <span
        style={{
          fontFamily: "Space Mono, monospace",
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.2em",
          color: c,
          marginTop: -2,
        }}
      >
        {earnedAch.length}/{achTotal} EARNED
      </span>
    </button>
  );
}

/* ── Tail row — ranks #4–#8 ─────────────────────────────────────── */

function TailRow({
  m,
  achievements,
  onTap,
}: {
  m: PodiumRoller & { rank: number };
  achievements: PodiumAchievement[];
  onTap?: () => void;
}) {
  const isYou   = m.you;
  const accent  = isYou ? T.pink : T.gold;

  const sortSet  = new Set(m.earned_sort_orders);
  const earnedAch = achievements.filter((a) => sortSet.has(a.sort_order));

  return (
    <button
      onClick={onTap}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: onTap ? "pointer" : "default",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: isYou ? "7px 8px" : "4px 0",
          margin: isYou ? "-3px -8px" : 0,
          background: isYou
            ? `linear-gradient(90deg, rgba(255,45,85,0.11), rgba(255,45,85,0.02) 70%, transparent)`
            : "transparent",
          border: isYou ? `1px solid rgba(255,45,85,0.31)` : "none",
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
            width: 22,
            textAlign: "center",
            color: T.textMute,
            flexShrink: 0,
          }}
        >
          #{m.rank}
        </span>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span
            style={{
              fontFamily: "Space Grotesk, sans-serif",
              fontWeight: isYou ? 700 : 500,
              fontSize: 12,
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

          {/* Emoji strip */}
          {earnedAch.length > 0 && (
            <div style={{ display: "flex", gap: 3, flexWrap: "nowrap", overflow: "hidden" }}>
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
            fontSize: 14,
            color: isYou ? T.pink : T.text,
            textShadow: isYou ? "0 0 6px rgba(255,45,85,0.38)" : "none",
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

/* ── PodiumLeaderboard ────────────────────────────────────────────── */

export function PodiumLeaderboard({ data, onUserTap }: Props) {
  const { total_rollers, achievements, rollers } = data;
  if (rollers.length === 0) return null;

  const ranked = rollers.map((r, i) => ({ ...r, rank: i + 1 }));
  const top3   = ranked.slice(0, 3);
  const tail   = ranked.slice(3);
  // Classic podium silhouette: 2nd left · 1st center · 3rd right
  const podium = [top3[1], top3[0], top3[2]].filter(Boolean);
  const achTotal = achievements.length;

  return (
    <>
      {/* Section heading */}
      <div style={{ marginTop: 4, marginBottom: 2 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Trophy size={14} color="#FFD600" strokeWidth={2} />
            <span
              style={{
                fontFamily: "Space Mono, monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: "#F5F5F5",
              }}
            >
              ALL ROLLERS
            </span>
          </div>
          <span
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: T.textDim,
            }}
          >
            {total_rollers} ACTIVE
          </span>
        </div>
        <p
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.18em",
            color: T.textMute,
            marginTop: 4,
            marginBottom: 0,
          }}
        >
          LIFETIME ROLLS · TROPHY WALL
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: T.surface,
          border: `1px solid rgba(255, 214, 0, 0.25)`,
          borderRadius: 16,
          padding: "22px 12px 14px",
          boxShadow: "0 0 18px rgba(255, 214, 0, 0.08)",
        }}
      >
        {/* Podium row */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
            paddingTop: 4,
          }}
        >
          {podium.map((m) => (
            <PodiumStep
              key={m.user_id}
              m={m}
              achievements={achievements}
              achTotal={achTotal}
              onTap={onUserTap ? () => onUserTap(m.username) : undefined}
            />
          ))}
        </div>

        {/* Caption strip */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 14,
            fontFamily: "Space Mono, monospace",
            fontSize: 8,
            letterSpacing: "0.3em",
            color: T.textMute,
            paddingTop: 14,
            paddingBottom: 10,
            borderBottom: `1px dashed ${T.border}`,
          }}
        >
          <span>↑ ROLLS</span>
          <span style={{ color: "#FFD600aa" }}>● TROPHY WALL</span>
        </div>

        {/* Tail list */}
        {tail.length > 0 && (
          <div
            style={{
              paddingTop: 10,
              display: "flex",
              flexDirection: "column",
              gap: 5,
            }}
          >
            {tail.map((m) => (
              <TailRow
                key={m.user_id}
                m={m}
                achievements={achievements}
                onTap={onUserTap ? () => onUserTap(m.username) : undefined}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: `1px dashed ${T.border}`,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "Space Mono, monospace",
            fontSize: 9,
            letterSpacing: "0.16em",
            color: T.textMute,
          }}
        >
          <span>+ {Math.max(0, total_rollers - rollers.length)} MORE ROLLERS</span>
          <span style={{ color: T.pink, cursor: "pointer" }}>SEE ALL ›</span>
        </div>
      </div>
    </>
  );
}
