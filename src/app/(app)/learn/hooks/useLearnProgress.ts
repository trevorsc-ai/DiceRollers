"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "learn_progress_v1";

interface ProgressShape {
  completed: string[];
}

function read(): ProgressShape {
  if (typeof window === "undefined") return { completed: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.completed)) return { completed: parsed.completed };
  } catch {
    // fall through
  }
  return { completed: [] };
}

function write(next: ProgressShape) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable (private mode, etc.) — silently ignore.
  }
}

export function useLearnProgress() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCompleted(new Set(read().completed));
    setHydrated(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setCompleted(new Set(read().completed));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const markComplete = useCallback((id: string) => {
    setCompleted((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      write({ completed: Array.from(next) });
      return next;
    });
  }, []);

  const markIncomplete = useCallback((id: string) => {
    setCompleted((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      write({ completed: Array.from(next) });
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setCompleted(new Set());
    write({ completed: [] });
  }, []);

  const isComplete = useCallback((id: string) => completed.has(id), [completed]);

  return { completed, hydrated, isComplete, markComplete, markIncomplete, reset };
}
