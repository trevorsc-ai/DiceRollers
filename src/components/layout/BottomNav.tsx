"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dice6, BarChart2, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { fetchUnseenLikesCount, unseenLikesQueryKey } from "@/lib/queries/rolls";

const tabs = [
  { href: "/roll",         label: "ROLL",         Icon: Dice6 },
  { href: "/stats",        label: "STATS",        Icon: BarChart2 },
  { href: "/achievements", label: "ACHIEVEMENTS", Icon: Trophy },
  { href: "/feed",         label: "FEED",         Icon: Users },
];

const lastSeenFeedKey = (userId: string) => `last_seen_feed_at:${userId}`;

export default function BottomNav() {
  const pathname = usePathname();
  const supabase = createClient();

  const [hasNewAchievements, setHasNewAchievements] = useState(false);

  useEffect(() => {
    function checkDot() {
      try {
        const stored = JSON.parse(localStorage.getItem("new_achievements") ?? "[]");
        setHasNewAchievements(Array.isArray(stored) && stored.length > 0);
      } catch {
        setHasNewAchievements(false);
      }
    }

    checkDot();
    window.addEventListener("storage", checkDot);
    document.addEventListener("visibilitychange", checkDot);

    return () => {
      window.removeEventListener("storage", checkDot);
      document.removeEventListener("visibilitychange", checkDot);
    };
  }, []);

  useEffect(() => {
    if (pathname === "/achievements") {
      setHasNewAchievements(false);
    }
  }, [pathname]);

  // Likes bubble. Mirrors the achievements pattern but the populator is a
  // lightweight count query (no server-side push for likes-received).
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [lastSeenFeedAt, setLastSeenFeedAt] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
  }, [supabase]);

  // On first run for this user, anchor "since" to now so we don't surface
  // every historical like as new.
  useEffect(() => {
    if (!myUserId) return;
    try {
      const key = lastSeenFeedKey(myUserId);
      let value = localStorage.getItem(key);
      if (!value) {
        value = new Date().toISOString();
        localStorage.setItem(key, value);
      }
      setLastSeenFeedAt(value);
    } catch {
      setLastSeenFeedAt(new Date().toISOString());
    }
  }, [myUserId]);

  const { data: unseenLikes = 0 } = useQuery({
    queryKey: myUserId && lastSeenFeedAt
      ? unseenLikesQueryKey(myUserId, lastSeenFeedAt)
      : ["unseenLikes", "disabled"],
    queryFn: () => fetchUnseenLikesCount(supabase, myUserId!, lastSeenFeedAt!),
    enabled: !!myUserId && !!lastSeenFeedAt,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const hasNewLikes = unseenLikes > 0;

  // Visiting FEED marks all current likes seen.
  useEffect(() => {
    if (pathname !== "/feed" || !myUserId) return;
    const now = new Date().toISOString();
    try {
      localStorage.setItem(lastSeenFeedKey(myUserId), now);
    } catch (err) {
      console.warn("localStorage failed:", err);
    }
    setLastSeenFeedAt(now);
  }, [pathname, myUserId]);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-surface-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const showAchievementsDot = href === "/achievements" && hasNewAchievements && !active;
          const showLikesDot = href === "/feed" && hasNewLikes && !active;
          const showDot = showAchievementsDot || showLikesDot;

          return (
            <Link
              key={href}
              href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "text-neon-pink" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.5} />
                {showDot && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-neon-pink rounded-full" />
                )}
              </div>
              <span className={`font-display text-[9px] tracking-wider ${active ? "font-semibold" : ""}`}>
                {label}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-neon-pink rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
