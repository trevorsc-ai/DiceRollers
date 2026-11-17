"use client";

import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChartCard } from "@/components/ChartCard";
import {
  AroundTheWorldGrid,
  DoublesGrid,
  PunchCardGrid,
} from "@/components/achievements/ProgressGrids";
import {
  achievementTrackerQueryKey,
  fetchAchievementTracker,
  type TrackerNearRow,
  type TrackerNearSection,
} from "@/lib/queries/achievements";

const PINK = "#FF2D55";
const GOLD = "#FFD600";

function rankColor(rank: number): string | null {
  if (rank === 1) return GOLD;
  if (rank === 2) return "#C9C9C9";
  if (rank === 3) return "#E08A4A";
  return null;
}

interface TrackerRowProps {
  rank: number;
  username: string;
  isMe: boolean;
  onUserClick: (username: string) => void;
  /** Right-aligned content (pill, count, etc.). */
  trailing?: ReactNode;
  /** Content rendered under the row line (bars, grids). */
  below?: ReactNode;
  /** When provided the whole row toggles on tap. */
  onToggle?: () => void;
  expanded?: boolean;
}

function TrackerRow({
  rank,
  username,
  isMe,
  onUserClick,
  trailing,
  below,
  onToggle,
  expanded,
}: TrackerRowProps) {
  const c = rankColor(rank);
  const interactive = !!onToggle;
  return (
    <div
      onClick={onToggle}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onToggle?.();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-expanded={interactive ? expanded : undefined}
      className={`font-mono text-[11px] ${interactive ? "cursor-pointer" : ""}`}
      style={{
        fontFamily: "Space Mono, monospace",
        padding: isMe ? "6px 8px" : "4px 0",
        background: isMe
          ? `linear-gradient(90deg, ${PINK}18, ${PINK}05 70%, transparent)`
          : "transparent",
        border: isMe ? `1px solid ${PINK}40` : "1px solid transparent",
        borderRadius: 6,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="min-w-[18px] font-bold tracking-[0.04em]"
          style={{
            color: c ?? "#555",
            textShadow: rank === 1 ? "0 0 6px #FFD60080" : "none",
          }}
        >
          {String(rank).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUserClick(username);
          }}
          className="flex-1 min-w-0 text-left truncate hover:text-neon-pink transition-colors"
          style={{
            fontWeight: isMe ? 700 : 400,
            color: isMe ? PINK : (c ?? "#F5F5F5"),
          }}
        >
          @{username}
          {isMe && (
            <span className="ml-1.5 text-[9px] tracking-[0.14em] font-normal text-text-secondary">
              YOU
            </span>
          )}
        </button>
        {trailing}
        {interactive && (
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-text-muted transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        )}
      </div>
      {below}
    </div>
  );
}

function AwayPill({ rollsAway }: { rollsAway: number }) {
  const color = rollsAway === 1 ? GOLD : rollsAway === 2 ? PINK : "#999999";
  return (
    <span
      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.14em]"
      style={{ color, background: `${color}1A`, border: `1px solid ${color}55` }}
    >
      {rollsAway === 1 ? "1 ROLL AWAY" : `${rollsAway} ROLLS AWAY`}
    </span>
  );
}

function EmptyNote() {
  return <p className="text-text-muted text-[12px] py-2">No one&apos;s started yet.</p>;
}

function NearSection({
  section,
  myUserId,
  onUserClick,
  renderVisual,
}: {
  section: TrackerNearSection;
  myUserId: string | null;
  onUserClick: (username: string) => void;
  renderVisual: (row: TrackerNearRow) => ReactNode;
}) {
  if (section.rows.length === 0) return <EmptyNote />;
  return (
    <>
      {section.isFallback && (
        <p className="font-display text-[9px] tracking-[0.18em] text-text-muted mb-2">
          NOBODY&apos;S CLOSE YET · CLOSEST SO FAR
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        {section.rows.map((row, i) => (
          <TrackerRow
            key={row.user_id}
            rank={i + 1}
            username={row.username}
            isMe={row.user_id === myUserId}
            onUserClick={onUserClick}
            trailing={<AwayPill rollsAway={row.rolls_away} />}
            below={renderVisual(row)}
          />
        ))}
      </div>
    </>
  );
}

export default function AchievementTrackerView({
  myUserId,
  onUserClick,
}: {
  myUserId: string | null;
  onUserClick: (username: string) => void;
}) {
  const supabase = createClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: achievementTrackerQueryKey,
    queryFn: () => fetchAchievementTracker(supabase),
    staleTime: 60_000,
  });

  function toggle(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  if (isLoading) {
    return <div className="text-center text-text-secondary py-12">Loading...</div>;
  }
  if (isError || !data) {
    return <div className="text-center text-text-secondary py-12">Couldn&apos;t load the tracker.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      <ChartCard variant="stats" title="🌎 AROUND THE WORLD · TOP 5">
        {data.aroundTheWorld.length === 0 ? (
          <EmptyNote />
        ) : (
          <div className="flex flex-col gap-2.5">
            {data.aroundTheWorld.map((row, i) => {
              const isOpen = expanded.has(row.user_id);
              return (
                <TrackerRow
                  key={row.user_id}
                  rank={i + 1}
                  username={row.username}
                  isMe={row.user_id === myUserId}
                  onUserClick={onUserClick}
                  onToggle={() => toggle(row.user_id)}
                  expanded={isOpen}
                  trailing={
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="w-14 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (row.progress / 64) * 100)}%`,
                            background: GOLD,
                          }}
                        />
                      </span>
                      <span className="font-bold text-text-primary">{row.progress}/64</span>
                    </span>
                  }
                  below={isOpen ? <AroundTheWorldGrid combos={row.combos} size="sm" /> : null}
                />
              );
            })}
          </div>
        )}
      </ChartCard>

      <ChartCard variant="stats" title="😈 DOUBLE TROUBLE">
        <NearSection
          section={data.doubleTrouble}
          myUserId={myUserId}
          onUserClick={onUserClick}
          renderVisual={(row) => <DoublesGrid numbers={row.numbers ?? []} size="sm" />}
        />
      </ChartCard>

      <ChartCard variant="stats" title="📅 MALORT ADVENT CALENDAR">
        <NearSection
          section={data.malortAdventCalendar}
          myUserId={myUserId}
          onUserClick={onUserClick}
          renderVisual={(row) => (
            <p className="mt-1.5 pl-[26px] text-text-secondary text-[10px] tracking-[0.08em]">
              {row.progress}/25
            </p>
          )}
        />
      </ChartCard>

      <ChartCard variant="stats" title="🎟️ THE PUNCH CARD">
        <NearSection
          section={data.punchCard}
          myUserId={myUserId}
          onUserClick={onUserClick}
          renderVisual={(row) => (
            <PunchCardGrid detail={{ red: row.red, white: row.white }} size="sm" />
          )}
        />
      </ChartCard>

      <ChartCard variant="stats" title="👯 TWINSIES BOARD">
        {data.twinsies.length === 0 ? (
          <EmptyNote />
        ) : (
          <div className="flex flex-col gap-2.5">
            {data.twinsies.map((row, i) => (
              <TrackerRow
                key={row.user_id}
                rank={i + 1}
                username={row.username}
                isMe={row.user_id === myUserId}
                onUserClick={onUserClick}
                trailing={
                  <span className="shrink-0 font-bold text-text-primary">
                    {row.progress}
                    <span className="ml-1 text-[9px] font-normal tracking-[0.14em] text-text-secondary">
                      {row.progress === 1 ? "TWIN" : "TWINS"}
                    </span>
                  </span>
                }
              />
            ))}
          </div>
        )}
      </ChartCard>
    </div>
  );
}
