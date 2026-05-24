"use client";

import { ReactNode } from "react";
import { formatPartners } from "@/lib/twinsies";
import type { EarnedAchievement } from "@/lib/rollAchievements";

/** Reusable gold-bordered pill — used by twinsies and achievement pills. */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 font-display text-[10px] tracking-[0.08em] px-2 py-1 rounded-full border"
      style={{
        color: "#FFD600",
        borderColor: "rgba(255,214,0,0.4)",
        background: "rgba(255,214,0,0.10)",
      }}
    >
      {children}
    </span>
  );
}

export function TwinsiesBadge({ partners }: { partners: string[] }) {
  if (partners.length === 0) return null;
  return <Pill>👯 TWINSIES with {formatPartners(partners)}</Pill>;
}

export function AchievementPills({ achievements }: { achievements: EarnedAchievement[] }) {
  if (achievements.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {achievements.map((a) => (
        <Pill key={a.name}>
          {a.emoji} {a.name}
        </Pill>
      ))}
    </div>
  );
}
