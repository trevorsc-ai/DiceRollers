"use client";

import { GraduationCap, RotateCcw } from "lucide-react";
import ModuleCard from "./components/ModuleCard";
import AppMap from "./components/AppMap";
import { MODULES, MODULES_BY_PART, PART_BLURBS, PART_LABELS } from "./content";
import { useLearnProgress } from "./hooks/useLearnProgress";

export default function LearnHome() {
  const { completed, hydrated, reset } = useLearnProgress();
  const totalMin = MODULES.reduce((sum, m) => sum + m.estMinutes, 0);
  const doneCount = hydrated ? completed.size : 0;
  const pct = Math.round((doneCount / MODULES.length) * 100);

  const nextUp = hydrated
    ? MODULES.find((m) => !completed.has(m.id))
    : undefined;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex items-center gap-3 mb-2">
        <GraduationCap className="w-7 h-7 text-neon-pink" />
        <h1 className="font-display text-3xl text-text-primary">LEARN</h1>
      </header>
      <p className="text-text-secondary text-sm mb-6 leading-relaxed">
        14 modules · ~{Math.round(totalMin / 60)}h total · A guided tour of
        DiceRollers and modern web app design. Progress saved on this device.
      </p>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="font-display text-xs text-text-secondary tracking-wider">
            PROGRESS
          </span>
          <div className="flex items-center gap-3">
            <span className="text-text-primary text-sm">
              {doneCount}/{MODULES.length} ({pct}%)
            </span>
            {doneCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Reset all progress?")) reset();
                }}
                className="inline-flex items-center gap-1 text-text-secondary text-xs hover:text-text-primary"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-neon-pink transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Next up */}
      {nextUp && (
        <div className="mb-6">
          <div className="font-display text-xs text-text-secondary tracking-wider mb-2">
            {doneCount === 0 ? "START HERE" : "NEXT UP"}
          </div>
          <ModuleCard module={nextUp} highlight />
        </div>
      )}

      {/* App map */}
      <AppMap />

      {/* Modules grouped by part */}
      <div className="space-y-8 mt-6">
        {(["foundations", "data", "guts"] as const).map((part) => (
          <section key={part}>
            <h2 className="font-display text-xl text-text-primary mb-1">
              {PART_LABELS[part]}
            </h2>
            <p className="text-text-secondary text-sm mb-4">
              {PART_BLURBS[part]}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MODULES_BY_PART[part].map((m) => (
                <ModuleCard key={m.id} module={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
