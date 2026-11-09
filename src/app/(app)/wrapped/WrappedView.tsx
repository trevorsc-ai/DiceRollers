"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchWrapped,
  fetchWrappedGlobal,
  fetchWrappedPour,
  wrappedGlobalQueryKey,
  wrappedPourQueryKey,
  wrappedQueryKey,
} from "@/lib/queries/stats";
import { assignSuperlatives } from "@/lib/wrapped";
import { buildSlides } from "./WrappedSlides";

/**
 * Tap-through story deck. Tap the right side (or →) to advance, the left
 * third (or ←) to go back. Data is prefetched by the server page.
 */
export default function WrappedView({
  userId,
  year,
  isPreview,
}: {
  userId: string;
  year: number;
  isPreview: boolean;
}) {
  const supabase = createClient();

  const personal = useQuery({
    queryKey: wrappedQueryKey(userId, year),
    queryFn: () => fetchWrapped(supabase, userId, year),
    staleTime: 5 * 60_000,
  });
  const global = useQuery({
    queryKey: wrappedGlobalQueryKey(year),
    queryFn: () => fetchWrappedGlobal(supabase, year),
    staleTime: 5 * 60_000,
  });

  const pour = useQuery({
    queryKey: wrappedPourQueryKey(userId, year),
    queryFn: () => fetchWrappedPour(supabase, userId, year),
    staleTime: 5 * 60_000,
  });

  const slides = useMemo(() => {
    if (!personal.data || !global.data || !pour.data) return [];
    const superlatives = assignSuperlatives(global.data.roller_metrics);
    return buildSlides({ personal: personal.data, global: global.data, superlatives, pour: pour.data, userId, year });
  }, [personal.data, global.data, pour.data, userId, year]);

  const [index, setIndex] = useState(0);
  const last = slides.length - 1;
  const next = useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  function onTap(e: MouseEvent<HTMLDivElement>) {
    // Ignore taps on links/buttons inside a slide.
    if ((e.target as HTMLElement).closest("a, button")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
    else next();
  }

  const loading = personal.isLoading || global.isLoading || pour.isLoading;
  const error = personal.error ?? global.error ?? pour.error;
  const slide = slides[Math.min(index, Math.max(last, 0))];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col select-none">
      {slide && (
        <div
          className="absolute inset-0 pointer-events-none transition-[background] duration-500"
          style={{ background: `radial-gradient(120% 70% at 50% 0%, ${slide.accent}2E, transparent 65%)` }}
        />
      )}

      {/* Progress + close */}
      <div className="relative z-10 w-full max-w-lg mx-auto px-3 pt-3" style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}>
        <div className="flex gap-1">
          {slides.map((s, i) => (
            <div key={s.key} className="flex-1 h-[3px] rounded-full bg-surface-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: i <= index ? "100%" : "0%", background: slide?.accent ?? "#FF2D55" }}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <p className="font-display text-[10px] tracking-[0.25em] text-text-secondary">
            WRAPPED {year}
            {isPreview && <span className="ml-2 text-neon-gold">· ADMIN PREVIEW</span>}
          </p>
          <Link href="/stats" aria-label="Close Wrapped" className="p-1 text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Slide */}
      <div
        className="relative z-10 flex-1 w-full max-w-lg mx-auto overflow-y-auto cursor-pointer"
        onClick={onTap}
        role="region"
        aria-roledescription="story"
        aria-label={slide ? `Slide ${index + 1} of ${slides.length}` : "Wrapped"}
      >
        {loading ? (
          <Centered>
            <p className="font-display text-[12px] tracking-[0.3em] text-text-secondary animate-pulse">
              SHUFFLING THE DICE…
            </p>
          </Centered>
        ) : error ? (
          <Centered>
            <p className="text-text-primary">Couldn&apos;t load your Wrapped.</p>
            <button
              onClick={() => {
                personal.refetch();
                global.refetch();
                pour.refetch();
              }}
              className="mt-4 px-4 py-2 rounded-lg border border-neon-pink text-neon-pink font-display text-[11px] tracking-[0.2em]"
            >
              TRY AGAIN
            </button>
          </Centered>
        ) : slide ? (
          <div key={slide.key} className="min-h-full flex flex-col justify-center px-6 py-8 text-center animate-scale-in">
            {slide.content}
            {index === last && (
              <div className="flex gap-2 justify-center mt-6">
                <button
                  onClick={() => setIndex(0)}
                  className="px-4 py-2 rounded-lg border border-surface-2 text-text-secondary font-display text-[11px] tracking-[0.2em] hover:text-text-primary"
                >
                  REPLAY
                </button>
                <Link
                  href="/stats"
                  className="px-4 py-2 rounded-lg bg-neon-pink text-background font-display text-[11px] tracking-[0.2em] font-bold"
                >
                  DONE
                </Link>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="h-full flex flex-col items-center justify-center text-center px-6">{children}</div>;
}
