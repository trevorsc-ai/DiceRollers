"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { appFlagQueryKey, fetchAppFlag } from "@/lib/queries/stats";
import { isWrappedDecember, wrappedYear } from "@/lib/wrapped";

/** One "seen" marker per user per Wrapped season, kept in this browser. */
export const wrappedPopupSeenKey = (userId: string, year: number) => `wrapped_popup_seen:${userId}:${year}`;

/**
 * "Your Wrapped is here" popup. Shows once, the first time a user opens the app
 * in December after an admin has turned on `wrapped_live`. After that (and after
 * December) the banner on the roll page is the way in.
 */
export default function WrappedPopup({ userId }: { userId: string }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const { data: live = false } = useQuery({
    queryKey: appFlagQueryKey("wrapped_live"),
    queryFn: () => fetchAppFlag(supabase, "wrapped_live"),
    staleTime: 5 * 60_000,
  });

  const year = wrappedYear();
  const onWrapped = pathname.startsWith("/wrapped");

  useEffect(() => {
    if (!live || !isWrappedDecember() || onWrapped) return;
    const key = wrappedPopupSeenKey(userId, year);
    try {
      if (localStorage.getItem(key)) return;
      // Mark it seen as soon as it opens so it can't come back, even if they
      // close the tab without dismissing it.
      localStorage.setItem(key, new Date().toISOString());
    } catch (err) {
      // Storage blocked (private mode): skip the popup rather than show it on every load.
      console.warn("[WrappedPopup] localStorage unavailable, skipping popup", err);
      return;
    }
    setOpen(true);
  }, [live, onWrapped, userId, year]);

  if (!open || onWrapped) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={`Your ${year} Wrapped is here`}
    >
      <div
        className="border border-neon-gold/60 rounded-3xl p-8 max-w-sm w-full text-center animate-scale-in shadow-2xl"
        style={{ background: "linear-gradient(160deg, rgba(255,45,85,0.18), #1A1A1A 55%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-7xl leading-none mb-4">🎁</p>
        <p className="font-display text-[11px] tracking-[0.28em] text-text-secondary mb-2">DICEROLLERS WRAPPED</p>
        <h2 className="font-display text-[28px] tracking-[0.12em] neon-text-gold leading-tight">YOUR {year} WRAPPED IS HERE</h2>
        <p className="text-text-secondary text-sm mt-3">
          Luck, Malört, rivalries, how much you poured, and your yearbook award. It keeps counting through
          December.
        </p>
        <Link
          href="/wrapped"
          onClick={() => setOpen(false)}
          className="block mt-6 px-4 py-3 rounded-xl bg-neon-pink text-background font-display text-[13px] tracking-[0.22em] font-bold"
        >
          SEE MY WRAPPED
        </Link>
        <button
          onClick={() => setOpen(false)}
          className="mt-3 font-display text-[11px] tracking-[0.2em] text-text-secondary hover:text-text-primary"
        >
          LATER
        </button>
      </div>
    </div>
  );
}
