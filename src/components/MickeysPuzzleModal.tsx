"use client";

import { useEffect, useState } from "react";
import puzzlesFallback from "@/data/mickeys-puzzles.json";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function getTodayKey(): string {
  const d = new Date();
  return `mickeys-seen-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function MickeysPuzzleModal() {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [puzzle, setPuzzle] = useState<{ puzzle: string; answer: string } | null>(null);

  useEffect(() => {
    const key = getTodayKey();
    if (localStorage.getItem(key)) return;

    const day = getDayOfYear(new Date());

    async function loadPuzzle() {
      const supabase = createClient();
      const { data } = await supabase
        .from("puzzles")
        .select("puzzle, answer")
        .eq("is_active", true)
        .order("day_index");

      if (data && data.length > 0) {
        setPuzzle(data[day % data.length]);
      } else {
        // Fallback to local JSON if DB unavailable
        setPuzzle(puzzlesFallback[day % puzzlesFallback.length]);
      }
      setOpen(true);
    }

    loadPuzzle();
  }, []);

  function dismiss() {
    localStorage.setItem(getTodayKey(), "1");
    setOpen(false);
  }

  if (!open || !puzzle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-scale-in">
      <div className="relative w-full max-w-sm bg-surface rounded-2xl p-6 border border-surface-2 text-center">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Mickey's branding */}
        <div className="mb-4">
          <p className="text-xs text-text-secondary uppercase tracking-widest mb-1">
            Daily Puzzle brought to you by
          </p>
          <p className="font-display text-3xl neon-text-gold tracking-widest">
            MICKEY&apos;S
          </p>
          <p className="text-xs text-text-secondary tracking-widest">MALT LIQUOR</p>
        </div>

        <div className="w-full h-px bg-surface-2 mb-6" />

        {/* Puzzle */}
        <div className="bg-surface-2 rounded-xl p-6 mb-6">
          <p className="text-4xl leading-relaxed mb-1">{puzzle.puzzle}</p>
        </div>

        {/* Answer */}
        {revealed ? (
          <div className="mb-4">
            <p className="text-xs text-text-secondary uppercase tracking-widest mb-1">Answer</p>
            <p className="font-display text-2xl neon-text-green tracking-widest">
              {puzzle.answer.toUpperCase()}
            </p>
          </div>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="w-full bg-surface-2 border border-surface-2 hover:border-neon-gold text-text-secondary hover:text-neon-gold font-medium py-3 rounded-lg transition-colors mb-4 text-sm tracking-wider"
          >
            TAP TO REVEAL ANSWER
          </button>
        )}

        <button
          onClick={dismiss}
          className="w-full bg-neon-pink text-white font-display text-lg tracking-widest py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all"
        >
          LET&apos;S ROLL
        </button>
      </div>
    </div>
  );
}
