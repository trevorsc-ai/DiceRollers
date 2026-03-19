"use client";

import { useEffect, useState } from "react";

interface MalortCelebrationProps {
  active: boolean;
}

const BOTTLE_COUNT = 8;

export default function MalortCelebration({ active }: MalortCelebrationProps) {
  const [bottles, setBottles] = useState<{ id: number; left: number; delay: number }[]>([]);

  useEffect(() => {
    if (!active) {
      setBottles([]);
      return;
    }
    setBottles(
      Array.from({ length: BOTTLE_COUNT }, (_, i) => ({
        id: i,
        left: 5 + (i * (90 / (BOTTLE_COUNT - 1))),
        delay: i * 80,
      }))
    );
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
      {/* Malort bottles rising from bottom */}
      {bottles.map((b) => (
        <div
          key={b.id}
          className="absolute bottom-0 flex flex-col items-center"
          style={{
            left: `${b.left}%`,
            animationDelay: `${b.delay}ms`,
          }}
        >
          <div
            className="animate-rise"
            style={{
              animationDelay: `${b.delay}ms`,
              filter: "drop-shadow(0 0 12px #00FF88)",
            }}
          >
            {/* Bottle emoji */}
            <span
              className="text-5xl animate-wobble inline-block"
              style={{ animationDelay: `${b.delay + 400}ms` }}
            >
              🍾
            </span>
          </div>
        </div>
      ))}

      {/* Malort text callout */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-scale-in text-center px-4">
          <p
            className="font-display text-5xl sm:text-6xl tracking-widest"
            style={{
              color: "#00FF88",
              textShadow: "0 0 20px #00FF88, 0 0 40px #00FF88",
            }}
          >
            MALORT.
          </p>
          <p className="text-neon-green text-sm mt-2 tracking-widest uppercase animate-pulse">
            You asked for it.
          </p>
        </div>
      </div>
    </div>
  );
}
