"use client";

import { ReactNode } from "react";
import type { EarnedAchievement } from "@/lib/rollAchievements";
import { DrinkBadge } from "./DrinkBadge";
import { DoublesBadge } from "./DoublesBadge";
import { TwinsiesBadge, AchievementPills } from "./GoldPill";
import type { DailyDoubleLogos } from "@/hooks/useDailyDoubleLogos";

/**
 * The roll body shared by feed and history. Cards differ only in their
 * header (feed shows username/timestamp + like button; history shows
 * date/roll #) so we accept `header` and `footer` slots.
 */

export interface RollCardData {
  id: number;
  red_die_number: number;
  white_die_number: number;
  red_drink_name: string;
  white_drink_name: string;
  red_drink_logo: string | null;
  white_drink_logo: string | null;
  is_doubles: boolean;
  is_daily_double: boolean;
  achievements: EarnedAchievement[];
  twinPartners: string[];
}

export interface RollCardProps {
  roll: RollCardData;
  dailyDoubleLogo: DailyDoubleLogos;
  /** Top-left content (username, date row, etc.). */
  header: ReactNode;
  /** Optional bottom content (e.g. like button on feed). */
  footer?: ReactNode;
  /** Sets the roundness profile. Feed uses 16, history uses 14. */
  rounded?: "lg" | "md";
}

export function RollCard({ roll, dailyDoubleLogo, header, footer, rounded = "lg" }: RollCardProps) {
  const redLogo = roll.is_daily_double ? dailyDoubleLogo.beer : roll.red_drink_logo;
  const whiteLogo = roll.is_daily_double ? dailyDoubleLogo.shot : roll.white_drink_logo;
  const roundedCls = rounded === "lg" ? "rounded-2xl" : "rounded-[14px]";

  return (
    <div
      className={`bg-surface ${roundedCls} p-[12px_14px] border`}
      style={{
        borderColor: roll.is_doubles ? "rgba(255,214,0,0.55)" : "#252525",
        boxShadow: roll.is_doubles
          ? rounded === "lg"
            ? "0 0 16px rgba(255,214,0,0.12)"
            : "0 0 12px rgba(255,214,0,0.12)"
          : "none",
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex-1 min-w-0">{header}</div>
        {roll.is_doubles && <DoublesBadge isDailyDouble={roll.is_daily_double} />}
      </div>

      <div className="flex items-center gap-2.5">
        <DrinkBadge
          name={roll.red_drink_name}
          logo={redLogo}
          dieNum={roll.red_die_number}
          color="red"
        />
        <span className="text-text-muted text-sm shrink-0">+</span>
        <DrinkBadge
          name={roll.white_drink_name}
          logo={whiteLogo}
          dieNum={roll.white_die_number}
          color="white"
        />
      </div>

      {roll.twinPartners.length > 0 && (
        <div className="mt-2.5">
          <TwinsiesBadge partners={roll.twinPartners} />
        </div>
      )}

      {roll.achievements.length > 0 && (
        <div className="mt-2.5">
          <AchievementPills achievements={roll.achievements} />
        </div>
      )}

      {footer}
    </div>
  );
}
