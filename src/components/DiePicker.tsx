"use client";

import { useState } from "react";

interface DiePickerProps {
  color: "red" | "white";
  value: number | null;
  onChange: (value: number) => void;
  /** "spooky" = Halloween palette: red die glows orange, white die glows purple. */
  variant?: "default" | "spooky";
}

const DIE_FACES = [1, 2, 3, 4, 5, 6, 7, 8];

export default function DiePicker({ color, value, onChange, variant = "default" }: DiePickerProps) {
  const [lastPicked, setLastPicked] = useState<number | null>(null);

  const isRed = color === "red";
  const spooky = variant === "spooky";
  // Accent colour for the selected state; hex so the alpha suffixes below work.
  const accent = spooky ? (isRed ? "#FF7A00" : "#A855F7") : (isRed ? "#FF2D55" : "#F5F5F5");
  const glowAnimation = spooky
    ? isRed ? "glow-pulse-orange 2s ease-in-out infinite" : "glow-pulse-purple 2.2s ease-in-out infinite"
    : isRed ? "glow-pulse-pink 2s ease-in-out infinite" : "glow-pulse-white 2.2s ease-in-out infinite";

  function handlePick(num: number) {
    setLastPicked(num);
    setTimeout(() => setLastPicked(null), 300);
    onChange(num);
  }

  const dotGlow = spooky || isRed
    ? { background: accent, boxShadow: `0 0 6px ${accent}` }
    : { background: "#F5F5F5", boxShadow: "0 0 5px rgba(255,255,255,0.5)" };

  const dieFaceStyle: React.CSSProperties = {
    width: 88,
    height: 88,
    clipPath: "polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)",
    background: value !== null ? `${accent}${isRed || spooky ? "14" : "0C"}` : "#151515",
    border: `2px solid ${value !== null ? accent : "#252525"}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s, border-color 0.2s",
    animation: value !== null ? glowAnimation : "none",
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      {/* Label row */}
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full shrink-0" style={dotGlow} />
        <span className="font-display text-[10px] tracking-[0.18em] text-text-secondary">
          {isRed ? "BEER · RED" : "SHOT · WHITE"}
        </span>
      </div>

      {/* Octagonal die face */}
      <div style={dieFaceStyle}>
        <span
          style={{
            fontFamily: "var(--font-display, monospace)",
            fontSize: value !== null ? 42 : 30,
            fontWeight: 700,
            lineHeight: 1,
            color: value !== null ? accent : "#333",
            transition: "all 0.15s",
          }}
        >
          {value ?? "?"}
        </span>
      </div>

      {/* Number grid — 4×2 */}
      <div className="grid grid-cols-4 gap-1.5">
        {DIE_FACES.map((num) => {
          const selected = value === num;
          const popping = lastPicked === num;

          const btnStyle: React.CSSProperties = {
            width: 42,
            height: 42,
            borderRadius: 8,
            background: selected ? `${accent}${isRed || spooky ? "18" : "10"}` : "#181818",
            border: `1px solid ${selected ? accent : "#2A2A2A"}`,
            color: selected ? accent : "#555",
            fontFamily: "var(--font-display, monospace)",
            fontSize: 17,
            fontWeight: 700,
            cursor: "pointer",
            transition: "border-color 0.12s, color 0.12s, background 0.12s",
            boxShadow: selected
              ? spooky || isRed
                ? `0 0 10px ${accent}52`
                : "0 0 8px rgba(255,255,255,0.16)"
              : "none",
            animation: popping ? "btn-pop 0.28s ease-out" : "none",
          };

          return (
            <button key={num} onClick={() => handlePick(num)} style={btnStyle}>
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
