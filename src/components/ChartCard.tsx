"use client";

import { ReactNode } from "react";

/**
 * Titled card used to wrap stat charts and admin metrics. The two original
 * variants used slightly different paddings and label sizes — the `variant`
 * prop preserves both.
 *   - "stats": tight padding, 9px label (used on /stats)
 *   - "admin": square padding, 12px label (used on admin dashboards)
 */

export interface ChartCardProps {
  title: string;
  children: ReactNode;
  variant: "stats" | "admin";
}

export function ChartCard({ title, children, variant }: ChartCardProps) {
  if (variant === "admin") {
    return (
      <div className="bg-surface rounded-2xl p-4 border border-surface-2">
        <p className="text-text-secondary text-xs uppercase tracking-widest mb-4">{title}</p>
        {children}
      </div>
    );
  }
  return (
    <div className="bg-surface border border-surface-2 rounded-[18px] p-[14px_14px_12px]">
      <p className="font-display text-[9px] tracking-[0.22em] text-text-secondary mb-2.5">{title}</p>
      {children}
    </div>
  );
}
