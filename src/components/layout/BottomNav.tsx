"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dice6, BarChart2, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";

const tabs = [
  { href: "/roll",         label: "ROLL",         Icon: Dice6 },
  { href: "/stats",        label: "STATS",        Icon: BarChart2 },
  { href: "/achievements", label: "ACHIEVEMENTS", Icon: Trophy },
  { href: "/feed",         label: "FEED",         Icon: Users },
];

export default function BottomNav() {
  const pathname = usePathname();
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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-surface-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const showDot = href === "/achievements" && hasNewAchievements && !active;

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
