"use client";

/**
 * The colored die/drink container shown across feed cards, history cards,
 * and the roll review screen. Two size variants:
 *   - "md" (34px): inline list cards (feed, history)
 *   - "lg" (62px): the in-progress roll review on /roll
 */

export type DrinkBadgeSize = "md" | "lg";

export interface DrinkBadgeProps {
  name: string;
  logo: string | null;
  dieNum: number;
  color: "red" | "white";
  size?: DrinkBadgeSize;
}

const SIZE = {
  md: { box: 34, logo: 20, dieFont: 14 },
  lg: { box: 62, logo: 48, dieFont: 28 },
} as const;

export function DrinkBadge({ name, logo, dieNum, color, size = "md" }: DrinkBadgeProps) {
  const isRed = color === "red";
  const s = SIZE[size];
  const isLarge = size === "lg";

  return (
    <div
      className={
        isLarge
          ? "flex flex-col items-center gap-1.5 flex-1 px-1.5"
          : "flex items-center gap-2 flex-1 min-w-0"
      }
    >
      <div
        className={isLarge ? "rounded-xl flex items-center justify-center border" : "rounded-lg shrink-0 flex items-center justify-center"}
        style={{
          width: s.box,
          height: s.box,
          background: isRed
            ? isLarge ? "#FF2D5514" : "#FF2D5512"
            : isLarge ? "#F5F5F50A" : "#F5F5F508",
          border: `1px solid ${isRed ? "rgba(255,45,85,0.32)" : isLarge ? "#333" : "#252525"}`,
          fontFamily: "var(--font-display, monospace)",
          fontSize: isLarge ? undefined : s.dieFont,
          fontWeight: 700,
          color: isRed ? "#FF2D55" : "#F5F5F5",
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={name}
            className={isLarge ? "object-contain rounded-lg" : "object-contain"}
            style={{ width: s.logo, height: s.logo }}
          />
        ) : (
          <span
            className={isLarge ? "font-display" : undefined}
            style={isLarge ? { fontSize: s.dieFont, color: isRed ? "#FF2D55" : "#F5F5F5" } : undefined}
          >
            {dieNum}
          </span>
        )}
      </div>
      <div className={isLarge ? "text-center" : "min-w-0"}>
        <p
          className={
            isLarge
              ? "text-text-primary text-[11px] font-medium leading-snug"
              : "text-text-primary text-[12px] leading-snug truncate"
          }
        >
          {name}
        </p>
        <p
          className={isLarge ? "text-[10px] mt-0.5" : "font-display text-[9px] tracking-[0.12em] mt-0.5"}
          style={{ color: isRed ? "rgba(255,45,85,0.75)" : "#555" }}
        >
          {isLarge ? (isRed ? "Beer" : "Shot") : isRed ? "BEER" : "SHOT"}
        </p>
      </div>
    </div>
  );
}
