"use client";

import { useEffect, useRef, useState } from "react";

interface DataFlowDiagramProps {
  chart: string;
  caption?: string;
}

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        themeVariables: {
          background: "#0f0f14",
          primaryColor: "#1a1a24",
          primaryTextColor: "#f4f4f5",
          primaryBorderColor: "#ec4899",
          lineColor: "#ec4899",
          secondaryColor: "#27272a",
          tertiaryColor: "#18181b",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        },
        securityLevel: "loose",
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export default function DataFlowDiagram({ chart, caption }: DataFlowDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;
    loadMermaid()
      .then(async (mermaid) => {
        if (cancelled || !ref.current) return;
        try {
          const { svg } = await mermaid.render(idRef.current, chart);
          if (!cancelled && ref.current) ref.current.innerHTML = svg;
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to render diagram");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load mermaid"));
    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <figure className="my-6 not-prose">
      <div className="rounded-lg border border-surface-2 bg-[#0f0f14] p-4 overflow-x-auto">
        {error ? (
          <p className="text-red-400 text-sm font-mono">Diagram error: {error}</p>
        ) : (
          <div ref={ref} className="flex justify-center min-h-[120px] items-center" />
        )}
      </div>
      {caption && (
        <figcaption className="text-text-secondary text-xs text-center mt-2 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
