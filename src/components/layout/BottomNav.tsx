"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dice6, List, Clock, BarChart2, Users, Settings } from "lucide-react";

const tabs = [
  { href: "/roll",     label: "Roll",    Icon: Dice6 },
  { href: "/menu",     label: "Menu",    Icon: List },
  { href: "/history",  label: "History", Icon: Clock },
  { href: "/stats",    label: "Stats",   Icon: BarChart2 },
  { href: "/feed",     label: "Feed",    Icon: Users },
  { href: "/settings", label: "Profile", Icon: Settings },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-surface-2"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active
                  ? "text-neon-pink"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className={`text-[9px] tracking-wider ${active ? "font-semibold" : ""}`}>
                {label.toUpperCase()}
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
