"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock } from "lucide-react";
import { useLearnProgress } from "../hooks/useLearnProgress";
import type { ModuleEntry } from "../content";

interface LessonProps {
  moduleId: string;
  title: string;
  number: number;
  estMinutes: number;
  prev?: Pick<ModuleEntry, "id" | "title">;
  next?: Pick<ModuleEntry, "id" | "title">;
  children: React.ReactNode;
}

export default function Lesson({
  moduleId,
  title,
  number,
  estMinutes,
  prev,
  next,
  children,
}: LessonProps) {
  const { isComplete, markComplete, markIncomplete, hydrated } = useLearnProgress();
  const done = hydrated && isComplete(moduleId);

  return (
    <article className="max-w-3xl mx-auto px-4 py-6">
      <header className="border-b border-surface-2 pb-4 mb-6">
        <Link
          href="/learn"
          className="inline-flex items-center gap-1 text-text-secondary text-xs hover:text-text-primary transition-colors mb-3"
        >
          <ArrowLeft className="w-3 h-3" />
          All modules
        </Link>
        <div className="flex items-baseline gap-3 mb-1">
          <span className="font-display text-sm text-neon-pink">
            MODULE {String(number).padStart(2, "0")}
          </span>
          <span className="inline-flex items-center gap-1 text-text-secondary text-xs">
            <Clock className="w-3 h-3" />
            {estMinutes} min
          </span>
          {done && (
            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-display">
              <Check className="w-3 h-3" />
              COMPLETED
            </span>
          )}
        </div>
        <h1 className="font-display text-3xl text-text-primary">{title}</h1>
      </header>

      <div className="prose-learn">{children}</div>

      <footer className="mt-12 pt-6 border-t border-surface-2 space-y-4">
        <button
          type="button"
          onClick={() => (done ? markIncomplete(moduleId) : markComplete(moduleId))}
          className={`w-full py-3 rounded-lg font-display text-sm transition-colors ${
            done
              ? "bg-surface-2 text-text-secondary hover:bg-surface-2/80"
              : "bg-neon-pink text-background hover:bg-neon-pink/90"
          }`}
        >
          {done ? "MARK INCOMPLETE" : "MARK COMPLETE"}
        </button>

        <div className="flex gap-3">
          {prev ? (
            <Link
              href={`/learn/${prev.id}`}
              className="flex-1 flex flex-col items-start gap-1 p-3 rounded-lg bg-surface border border-surface-2 hover:border-neon-pink/40 transition-colors"
            >
              <span className="inline-flex items-center gap-1 text-text-secondary text-xs">
                <ArrowLeft className="w-3 h-3" />
                Previous
              </span>
              <span className="text-text-primary text-sm line-clamp-1">{prev.title}</span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
          {next ? (
            <Link
              href={`/learn/${next.id}`}
              className="flex-1 flex flex-col items-end gap-1 p-3 rounded-lg bg-surface border border-surface-2 hover:border-neon-pink/40 transition-colors text-right"
            >
              <span className="inline-flex items-center gap-1 text-text-secondary text-xs">
                Next
                <ArrowRight className="w-3 h-3" />
              </span>
              <span className="text-text-primary text-sm line-clamp-1">{next.title}</span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </footer>
    </article>
  );
}
