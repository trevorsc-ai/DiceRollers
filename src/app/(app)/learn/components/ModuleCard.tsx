"use client";

import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { useLearnProgress } from "../hooks/useLearnProgress";
import type { ModuleEntry } from "../content";

interface ModuleCardProps {
  module: ModuleEntry;
  highlight?: boolean;
}

export default function ModuleCard({ module, highlight }: ModuleCardProps) {
  const { isComplete, hydrated } = useLearnProgress();
  const done = hydrated && isComplete(module.id);

  return (
    <Link
      href={`/learn/${module.id}`}
      className={`group block rounded-lg border p-4 transition-colors ${
        highlight
          ? "border-neon-pink bg-neon-pink/[0.06] hover:bg-neon-pink/[0.12]"
          : "border-surface-2 bg-surface hover:border-neon-pink/40"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-xs text-neon-pink">
          {String(module.number).padStart(2, "0")}
        </span>
        {done ? (
          <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-display">
            <Check className="w-3 h-3" />
            DONE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-text-secondary text-[10px]">
            <Clock className="w-3 h-3" />
            {module.estMinutes}m
          </span>
        )}
      </div>
      <div className="font-display text-base text-text-primary mb-1 group-hover:text-neon-pink transition-colors">
        {module.title}
      </div>
      <p className="text-text-secondary text-xs leading-relaxed line-clamp-3">
        {module.summary}
      </p>
    </Link>
  );
}
