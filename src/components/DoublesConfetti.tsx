"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

interface DoublesConfettiProps {
  active: boolean;
}

export default function DoublesConfetti({ active }: DoublesConfettiProps) {
  useEffect(() => {
    if (!active) return;

    // Burst confetti in neon colors
    const colors = ["#FF2D55", "#FFD600", "#00FF88", "#F5F5F5"];

    confetti({
      particleCount: 120,
      spread: 80,
      origin: { x: 0.5, y: 0.6 },
      colors,
      startVelocity: 40,
      gravity: 0.8,
      scalar: 1.2,
    });

    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 120,
        origin: { x: 0.2, y: 0.5 },
        colors,
        startVelocity: 30,
      });
      confetti({
        particleCount: 60,
        spread: 120,
        origin: { x: 0.8, y: 0.5 },
        colors,
        startVelocity: 30,
      });
    }, 200);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 flex items-center justify-center">
      <div className="animate-scale-in text-center px-4">
        <p className="font-display text-6xl neon-text-gold animate-pulse-neon tracking-widest">
          DOUBLES!
        </p>
        <p className="text-text-primary text-sm mt-2 animate-pulse">
          You also get: Old Time Lager + Tullamore Dew shot!
        </p>
      </div>
    </div>
  );
}
