"use client";

/** The gold pill that says "DOUBLES!" or "DAILY DOUBLE!" on roll cards. */
export function DoublesBadge({ isDailyDouble }: { isDailyDouble: boolean }) {
  return (
    <span
      className="font-display text-[9px] font-bold tracking-[0.18em] px-2 py-1 rounded-full border shrink-0"
      style={{
        color: "#FFD600",
        textShadow: "0 0 8px rgba(255,214,0,0.5)",
        borderColor: "#FFD600",
        background: isDailyDouble ? "rgba(255,214,0,0.25)" : "rgba(255,214,0,0.15)",
      }}
    >
      {isDailyDouble ? "DAILY DOUBLE!" : "DOUBLES!"}
    </span>
  );
}
