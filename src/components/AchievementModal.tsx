"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";
import type { AchievementInfo } from "@/lib/achievements";
import { formatPartners } from "@/lib/twinsies";

interface AchievementModalProps {
  achievements: AchievementInfo[];
  onClose: () => void;
}

export default function AchievementModal({ achievements, onClose }: AchievementModalProps) {
  const achievement = achievements[0];

  useEffect(() => {
    if (!achievement) return;

    // Celebration confetti burst
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ["#FFD600", "#FF2D55", "#00FF88", "#AA66FF", "#F5F5F5"],
      startVelocity: 45,
      gravity: 0.7,
      scalar: 1.3,
    });
  }, [achievement]);

  if (!achievement) return null;

  const isTwinsies = achievement.id === "twinsies";
  const twinCount = achievement.twinCount;
  const twinPartners = achievement.twinPartners ?? [];
  const displayName =
    isTwinsies && twinCount && twinCount > 1
      ? `Twinsies #${twinCount}!`
      : achievement.name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-neon-gold/50 rounded-3xl p-8 max-w-sm w-full text-center animate-scale-in shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-text-secondary text-xs uppercase tracking-widest mb-3">
          {achievement.category_emoji} {achievement.category_name}
        </p>

        <div className="text-8xl mb-4 leading-none">{achievement.emoji}</div>

        <h2 className="font-display text-2xl neon-text-gold tracking-widest mb-2">
          ACHIEVEMENT UNLOCKED
        </h2>

        <p className="text-text-primary text-xl font-semibold mb-1">{displayName}</p>
        <p className="text-text-secondary text-sm mb-2">{achievement.description}</p>

        {isTwinsies && twinPartners.length > 0 && (
          <p className="text-neon-pink text-sm font-semibold mb-6">
            with {formatPartners(twinPartners)}
          </p>
        )}
        {!(isTwinsies && twinPartners.length > 0) && <div className="mb-4" />}

        {achievements.length > 1 && (
          <p className="text-neon-pink text-xs mb-4">
            +{achievements.length - 1} more earned tonight!
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full bg-neon-gold text-background font-display text-lg tracking-widest py-3 rounded-2xl hover:opacity-90 active:scale-95 transition-all"
        >
          HELL YEAH
        </button>
      </div>
    </div>
  );
}
