"use client";

import { useState } from "react";

interface DiePickerProps {
  color: "red" | "white";
  value: number | null;
  onChange: (value: number) => void;
}

const DIE_FACES = [1, 2, 3, 4, 5, 6, 7, 8];

export default function DiePicker({ color, value, onChange }: DiePickerProps) {
  const [animating, setAnimating] = useState<number | null>(null);

  const isRed = color === "red";
  const borderSelected = isRed ? "border-neon-pink neon-border-pink" : "border-text-primary";
  const bgSelected = isRed ? "bg-neon-pink/20" : "bg-text-primary/10";
  const textSelected = isRed ? "text-neon-pink" : "text-text-primary";

  function handlePick(num: number) {
    setAnimating(num);
    setTimeout(() => setAnimating(null), 300);
    onChange(num);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Die label */}
      <div className="flex items-center gap-2">
        <span
          className={`w-3 h-3 rounded-full ${isRed ? "bg-neon-pink" : "bg-text-primary"}`}
        />
        <span className="text-text-secondary text-xs uppercase tracking-widest font-medium">
          {isRed ? "Beer (Red)" : "Shot (White)"}
        </span>
      </div>

      {/* Selected value display — octagonal die face */}
      <div
        className={`relative w-24 h-24 flex items-center justify-center border-2 rounded-2xl transition-all duration-200 ${
          value !== null
            ? `${borderSelected} ${bgSelected}`
            : "border-surface-2 bg-surface"
        }`}
        style={{
          clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
        }}
      >
        {value !== null ? (
          <span className={`font-display text-5xl ${textSelected}`}>{value}</span>
        ) : (
          <span className="text-text-secondary text-3xl">?</span>
        )}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-4 gap-2">
        {DIE_FACES.map((num) => {
          const selected = value === num;
          const isAnimating = animating === num;
          return (
            <button
              key={num}
              onClick={() => handlePick(num)}
              className={`w-12 h-12 rounded-lg border flex items-center justify-center font-display text-2xl transition-all duration-150 ${
                selected
                  ? `${borderSelected} ${bgSelected} ${textSelected}`
                  : "border-surface-2 bg-surface text-text-secondary hover:border-surface-2 hover:text-text-primary"
              } ${isAnimating ? "scale-125" : "scale-100"} active:scale-90`}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}
