"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { appFlagQueryKey, fetchAppFlag } from "@/lib/queries/stats";
import { wrappedYear } from "@/lib/wrapped";

/** "Your Wrapped is here" call-to-action. Renders nothing until an admin
 *  turns on the `wrapped_live` flag. */
export function WrappedBanner() {
  const supabase = createClient();
  const { data: live = false } = useQuery({
    queryKey: appFlagQueryKey("wrapped_live"),
    queryFn: () => fetchAppFlag(supabase, "wrapped_live"),
    staleTime: 5 * 60_000,
  });

  if (!live) return null;

  return (
    <Link
      href="/wrapped"
      className="flex items-center gap-3 rounded-[18px] border p-[14px_16px] transition-transform active:scale-[0.98]"
      style={{
        borderColor: "#FFD600",
        background: "linear-gradient(120deg, rgba(255,45,85,0.18), rgba(255,214,0,0.12) 60%, #1A1A1A)",
        boxShadow: "0 0 16px rgba(255,214,0,0.25)",
      }}
    >
      <span className="text-3xl">🎁</span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-[13px] tracking-[0.2em] text-neon-gold">YOUR {wrappedYear()} WRAPPED IS HERE</p>
        <p className="text-text-secondary text-xs mt-0.5">Luck, Malört, rivalries, and your yearbook award.</p>
      </div>
      <span className="font-display text-neon-gold text-lg">→</span>
    </Link>
  );
}
