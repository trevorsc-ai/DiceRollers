"use client";

import { useState } from "react";
import Link from "next/link";
import { MODULES } from "../content";

interface AppArea {
  id: string;
  label: string;
  blurb: string;
}

const AREAS: AppArea[] = [
  { id: "routes", label: "Routing", blurb: "How URLs map to files in app/." },
  { id: "login", label: "Auth", blurb: "Login → cookies → middleware." },
  { id: "roll", label: "Roll page", blurb: "Pick dice, save roll, fire achievements." },
  { id: "feed", label: "Feed", blurb: "Infinite-scroll list of everyone's rolls." },
  { id: "achievements", label: "Achievements", blurb: "The engine that awards badges." },
];

export default function AppMap() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = AREAS.find((a) => a.id === activeId);
  const relatedModules = active
    ? MODULES.filter((m) => m.coversAppAreas?.includes(active.id))
    : [];

  return (
    <div className="rounded-lg border border-surface-2 bg-surface p-4 my-4">
      <div className="font-display text-xs text-text-secondary mb-3 tracking-wider">
        APP MAP — CLICK AN AREA TO SEE RELATED MODULES
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {AREAS.map((area) => {
          const isActive = area.id === activeId;
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => setActiveId(isActive ? null : area.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-display transition-colors ${
                isActive
                  ? "bg-neon-pink text-background"
                  : "bg-surface-2 text-text-secondary hover:text-text-primary"
              }`}
            >
              {area.label}
            </button>
          );
        })}
      </div>

      {active && (
        <div className="rounded-md bg-[#0f0f14] border border-surface-2 p-3">
          <div className="text-text-primary text-sm mb-2">{active.blurb}</div>
          {relatedModules.length > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="text-text-secondary text-[10px] font-display tracking-wider mb-1">
                COVERED IN:
              </div>
              {relatedModules.map((m) => (
                <Link
                  key={m.id}
                  href={`/learn/${m.id}`}
                  className="text-neon-pink hover:underline text-sm"
                >
                  {String(m.number).padStart(2, "0")} · {m.title}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-xs italic">
              No modules dedicated to this area yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
