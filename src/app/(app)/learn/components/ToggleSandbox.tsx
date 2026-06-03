"use client";

import { useState, type ReactNode } from "react";

export interface ToggleOption {
  id: string;
  label: string;
  display: ReactNode;
  explanation?: ReactNode;
}

interface ToggleSandboxProps {
  title: string;
  prompt?: string;
  options: ToggleOption[];
  initialId?: string;
}

export default function ToggleSandbox({
  title,
  prompt,
  options,
  initialId,
}: ToggleSandboxProps) {
  const [selectedId, setSelectedId] = useState(initialId ?? options[0]?.id);
  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  return (
    <div className="my-6 rounded-lg border border-neon-pink/40 bg-surface p-4 not-prose">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-display text-[10px] text-neon-pink tracking-wider">
          TRY IT
        </span>
      </div>
      <div className="font-display text-base text-text-primary mb-1">{title}</div>
      {prompt && (
        <p className="text-text-secondary text-sm mb-3 leading-relaxed">{prompt}</p>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {options.map((opt) => {
          const active = opt.id === selected.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSelectedId(opt.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-display transition-colors ${
                active
                  ? "bg-neon-pink text-background"
                  : "bg-surface-2 text-text-secondary hover:text-text-primary"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-md bg-[#0f0f14] border border-surface-2 p-4">
        {selected.display}
      </div>

      {selected.explanation && (
        <div className="mt-3 text-sm text-text-primary leading-relaxed border-l-2 border-neon-pink/60 pl-3">
          {selected.explanation}
        </div>
      )}
    </div>
  );
}
