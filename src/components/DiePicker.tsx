"use client";

import { useState } from "react";

interface DiePickerProps {
  color: "red" | "white";
  value: number | null;
  onChange: (value: number) => void;
}

const DIE_FACES = [1, 2, 3, 4, 5, 6, 7, 8];

export default function DiePicker({ color, value, onChange }: DiePickerProps) {
  const [lastPicked, setLastPicked] = useState<number | null>(null);

  const isRed = color === "red";

  function handlePick(num: number) {
    setLastPicked(num);
    setTimeout(() => setLastPicked(null), 300);
    onChange(num);
  }

  const dotGlow = isRed
    ? { background: "#FF2D55", boxShadow: "0 0 6px #FF2D55" }
    : { background: "#F5F5F5", boxShadow: "0 0 5px rgba(255,255,255,0.5)" };

  const dieFaceStyle: React.CSSProperties = {
    width: 88,
    height: 88,
    clipPath: "polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)",
    background: value !== null ? (isRed ? "#FF2D5514" : "#F5F5F50C") : "#151515",
    border: `2px solid ${value !== null ? (isRed ? "#FF2D55" : "#F5F5F5") : "#252525"}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.2s, border-color 0.2s",
    animation: value !== null
      ? isRed
        ? "glow-pulse-pink 2s ease-in-out infinite"
        : "glow-pulse-white 2.2s ease-in-out infinite"
      : "none",
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
            color: value !== null ? (isRed ? "#FF2D55" : "#F5F5F5") : "#333",
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
            background: selected ? (isRed ? "#FF2D5518" : "#F5F5F510") : "#181818",
            border: `1px solid ${selected ? (isRed ? "#FF2D55" : "#F5F5F5") : "#2A2A2A"}`,
            color: selected ? (isRed ? "#FF2D55" : "#F5F5F5") : "#555",
            fontFamily: "var(--font-display, monospace)",
            fontSize: 17,
            fontWeight: 700,
            cursor: "pointer",
            transition: "border-color 0.12s, color 0.12s, background 0.12s",
            boxShadow: selected
              ? isRed
                ? "0 0 10px rgba(255,45,85,0.32)"
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
