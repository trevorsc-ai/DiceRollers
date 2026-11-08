"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPunchCardClubRoster,
  punchCardClubRosterQueryKey,
} from "@/lib/queries/stats";

interface ClubMember {
  rank: number;
  user: string;
  cardNumber: number;
  rolls: number;
  you: boolean;
}

const T = {
  surface:  "#1A1A1A",
  border:   "#252525",
  pink:     "#FF2D55",
  gold:     "#FFD600",
  text:     "#F5F5F5",
  textDim:  "#999999",
  textMute: "#555555",
} as const;

function rankColor(rank: number): string {
  if (rank === 1) return T.gold;
  if (rank === 2) return T.text;
  if (rank === 3) return T.pink;
  return T.textDim;
}

interface RosterRowProps {
  rank: number;
  user: string;
  you: boolean;
  /** Small dim label after the username, e.g. "CARD #2" or "3 CARDS". */
  tag: string;
  value: number;
  unit: string;
}

function RosterRow({ m }: { m: RosterRowProps }) {
  const c = rankColor(m.rank);
  const isYou = m.you;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "Space Mono, monospace",
        fontSize: 11,
        padding: isYou ? "5px 7px" : "2px 0",
        margin: isYou ? "-3px -7px" : 0,
        background: isYou
          ? `linear-gradient(90deg, ${T.pink}18, ${T.pink}05 70%, transparent)`
          : "transparent",
        border: isYou ? `1px solid ${T.pink}40` : "none",
        borderRadius: isYou ? 5 : 0,
      }}
    >
      {/* Rank */}
      <span
        style={{
          minWidth: 18,
          fontWeight: 700,
          color: m.rank <= 3 ? c : T.textMute,
          textShadow: m.rank === 1 ? "0 0 6px #FFD60080" : "none",
          letterSpacing: "0.04em",
        }}
      >
        {String(m.rank).padStart(2, "0")}
      </span>

      {/* Username + card number */}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontWeight: isYou ? 700 : 400,
          color: isYou ? T.pink : m.rank <= 3 ? c : T.text,
          textShadow: isYou ? "0 0 6px #FF2D5560" : "none",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        @{m.user}
        <span
          style={{
            color: isYou ? T.pink + "bb" : T.textMute,
            marginLeft: 6,
            fontSize: 9,
            letterSpacing: "0.14em",
            fontWeight: 400,
          }}
        >
          {m.tag}
        </span>
        {isYou && (
          <span
            style={{
              color: T.textDim,
              marginLeft: 6,
              fontSize: 9,
              letterSpacing: "0.14em",
              fontWeight: 400,
            }}
          >
            YOU
          </span>
        )}
      </span>

      {/* Leader dots */}
      <span
        style={{
          flex: "0 0 38px",
          height: 1,
          alignSelf: "center",
          backgroundImage: `radial-gradient(circle, ${m.rank === 1 ? T.gold + "70" : T.border} 1px, transparent 1.2px)`,
          backgroundSize: "4px 1px",
          backgroundRepeat: "repeat-x",
        }}
      />

      {/* Rolls */}
      <span
        style={{
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: m.rank === 1 ? T.gold : isYou ? T.pink : T.text,
        }}
      >
        {m.value}
        <span
          style={{
            color: m.rank === 1 ? T.gold + "aa" : T.textDim,
            fontWeight: 400,
            marginLeft: 4,
            fontSize: 9,
            letterSpacing: "0.14em",
          }}
        >
          {m.unit}
        </span>
      </span>
    </div>
  );
}


type RosterTab = "members" | "completions";

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        fontFamily: "Space Mono, monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        padding: "8px 0",
        borderRadius: 8,
        cursor: "pointer",
        border: `1px solid ${active ? T.pink + "80" : T.border}`,
        background: active ? `${T.pink}18` : "transparent",
        color: active ? T.pink : T.textDim,
      }}
    >
      {label}
    </button>
  );
}

function PunchCardClubModal({
  initialTab,
  currentUserId,
  onClose,
}: {
  initialTab: RosterTab;
  currentUserId: string | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<RosterTab>(initialTab);

  const roster = useQuery({
    queryKey: punchCardClubRosterQueryKey,
    queryFn: () => fetchPunchCardClubRoster(supabase),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: RosterRowProps[] =
    tab === "members"
      ? (roster.data?.members ?? []).map((m, i) => ({
          rank: i + 1,
          user: m.username,
          you: m.userId === currentUserId,
          tag: `${m.completions} ${m.completions === 1 ? "CARD" : "CARDS"}`,
          value: m.bestRolls,
          unit: "BEST",
        }))
      : (roster.data?.completions ?? []).map((c, i) => ({
          rank: i + 1,
          user: c.username,
          you: c.userId === currentUserId,
          tag: `CARD #${c.cardNumber}`,
          value: c.rolls,
          unit: "ROLLS",
        }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Punch Card Club roster"
        className="bg-surface border border-surface-2 rounded-3xl p-5 w-full max-w-sm animate-scale-in shadow-2xl flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, lineHeight: "1" }}>👊</span>
            <span
              style={{
                fontFamily: "Space Mono, monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: T.text,
              }}
            >
              PUNCH CARD CLUB
            </span>
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-text-secondary hover:text-text-primary transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }} className="shrink-0">
          <TabButton
            active={tab === "members"}
            label={`MEMBERS${roster.data ? ` · ${roster.data.members.length}` : ""}`}
            onClick={() => setTab("members")}
          />
          <TabButton
            active={tab === "completions"}
            label={`COMPLETIONS${roster.data ? ` · ${roster.data.completions.length}` : ""}`}
            onClick={() => setTab("completions")}
          />
        </div>

        {/* Column header */}
        <div
          className="shrink-0"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "Space Mono, monospace",
            fontSize: 8,
            letterSpacing: "0.2em",
            color: T.textMute,
            fontWeight: 700,
            paddingBottom: 8,
            marginBottom: 8,
            borderBottom: `1px dashed ${T.border}`,
          }}
        >
          <span style={{ minWidth: 18 }}>#</span>
          <span style={{ flex: 1 }}>MEMBER</span>
          <span>{tab === "members" ? "FASTEST" : "ROLLS"}</span>
        </div>

        {/* List */}
        <div className="overflow-y-auto" style={{ padding: "4px 8px", margin: "0 -8px" }}>
          {roster.isPending ? (
            <p style={{ fontFamily: "Space Mono, monospace", fontSize: 10, letterSpacing: "0.14em", color: T.textMute, textAlign: "center", padding: "24px 0" }}>
              LOADING...
            </p>
          ) : roster.isError ? (
            <p style={{ fontFamily: "Space Mono, monospace", fontSize: 10, letterSpacing: "0.14em", color: T.pink, textAlign: "center", padding: "24px 0" }}>
              COULDN&apos;T LOAD THE CLUB
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {rows.map((r) => (
                <RosterRow key={`${tab}-${r.rank}`} m={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PunchCardClubSection({
  members,
  totalMembers,
  totalCompletions,
  currentUserId = null,
}: {
  members: ClubMember[];
  totalMembers: number;
  totalCompletions: number;
  currentUserId?: string | null;
}) {
  const [openTab, setOpenTab] = useState<RosterTab | null>(null);

  if (members.length === 0) return null;

  const linkStyle = {
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    letterSpacing: "inherit",
    color: T.pink,
    textDecoration: "underline",
    textDecorationStyle: "dotted",
    textUnderlineOffset: 3,
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Section header */}
      <div
        style={{
          padding: "4px 2px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, lineHeight: "1" }}>👊</span>
          <span
            style={{
              fontFamily: "Space Mono, monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.22em",
              color: T.text,
            }}
          >
            THE PUNCH CARD CLUB
          </span>
        </span>
        <span
          style={{
            fontFamily: "Space Mono, monospace",
            fontSize: 9,
            color: T.textDim,
            letterSpacing: "0.12em",
            fontWeight: 700,
            textAlign: "right",
          }}
        >
          <button type="button" style={linkStyle} onClick={() => setOpenTab("members")}>
            {totalMembers} MEMBERS
          </button>
          {" · "}
          <button type="button" style={linkStyle} onClick={() => setOpenTab("completions")}>
            {totalCompletions} COMPLETIONS
          </button>
        </span>
      </div>

      <p
        style={{
          fontFamily: "Space Mono, monospace",
          fontSize: 9,
          letterSpacing: "0.18em",
          color: T.textMute,
          padding: "0 2px",
          margin: 0,
        }}
      >
        FASTEST TO PUNCH OUT
      </p>

      {/* Card */}
      <div
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: "12px 14px",
        }}
      >
        {/* Column header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "Space Mono, monospace",
            fontSize: 8,
            letterSpacing: "0.2em",
            color: T.textMute,
            fontWeight: 700,
            paddingBottom: 8,
            marginBottom: 8,
            borderBottom: `1px dashed ${T.border}`,
          }}
        >
          <span style={{ minWidth: 18 }}>#</span>
          <span style={{ flex: 1 }}>MEMBER</span>
          <span>ROLLS</span>
        </div>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {members.map((m, i) => (
            <RosterRow
              key={i}
              m={{
                rank: m.rank,
                user: m.user,
                you: m.you,
                tag: `CARD #${m.cardNumber}`,
                value: m.rolls,
                unit: "ROLLS",
              }}
            />
          ))}
        </div>
      </div>

      {openTab && (
        <PunchCardClubModal
          initialTab={openTab}
          currentUserId={currentUserId}
          onClose={() => setOpenTab(null)}
        />
      )}
    </div>
  );
}
