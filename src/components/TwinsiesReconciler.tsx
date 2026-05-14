"use client";

import { useEffect, useState } from "react";
import AchievementModal from "@/components/AchievementModal";
import type { AchievementInfo } from "@/lib/achievements";

const SESSION_FLAG = "twinsies_reconciled";

interface NewTwinEvent {
  partners: string[];
  count: number;
}

const TWINSIES_BASE: Omit<AchievementInfo, "twinPartners" | "twinCount"> = {
  id: "twinsies",
  name: "Twinsies",
  emoji: "👯",
  description: "Roll the same exact dice combo as another roller on the same night.",
  category_name: "You're a Regular",
  category_emoji: "💎",
};

export default function TwinsiesReconciler() {
  const [queue, setQueue] = useState<AchievementInfo[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (sessionStorage.getItem(SESSION_FLAG)) return;
        const res = await fetch("/api/achievements/reconcile-twinsies", { method: "POST" });
        if (!res.ok) return;
        sessionStorage.setItem(SESSION_FLAG, "1");
        const data = (await res.json()) as { newEvents?: NewTwinEvent[] };
        const newEvents = data.newEvents ?? [];
        if (cancelled || newEvents.length === 0) return;

        // Mark the achievements tab dot
        try {
          const existing = JSON.parse(localStorage.getItem("new_achievements") ?? "[]");
          const next = Array.isArray(existing) ? existing : [];
          for (let i = 0; i < newEvents.length; i++) next.push("twinsies");
          localStorage.setItem("new_achievements", JSON.stringify(next));
        } catch {
          /* ignore */
        }

        setQueue(
          newEvents.map((e) => ({
            ...TWINSIES_BASE,
            twinPartners: e.partners,
            twinCount: e.count,
          }))
        );
      } catch {
        /* ignore */
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleClose() {
    setQueue((q) => q.slice(1));
  }

  if (queue.length === 0) return null;

  // Show one twinsies modal at a time so each event shows its own count
  // ("Twinsies #5!", then "Twinsies #6!" on next dismiss).
  return <AchievementModal achievements={[queue[0]]} onClose={handleClose} />;
}
