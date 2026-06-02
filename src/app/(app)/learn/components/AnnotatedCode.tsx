"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

export interface Annotation {
  lines: [number, number] | number;
  title: string;
  body: string;
}

interface AnnotatedCodeProps {
  code: string;
  language?: string;
  filename?: string;
  annotations?: Annotation[];
  startLine?: number;
}

function lineRange(a: Annotation): [number, number] {
  return Array.isArray(a.lines) ? a.lines : [a.lines, a.lines];
}

export default function AnnotatedCode({
  code,
  filename,
  annotations = [],
  startLine = 1,
}: AnnotatedCodeProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const lines = code.replace(/\n$/, "").split("\n");

  const annotationByLine = new Map<number, number>();
  annotations.forEach((ann, idx) => {
    const [lo, hi] = lineRange(ann);
    for (let line = lo; line <= hi; line++) annotationByLine.set(line, idx);
  });

  return (
    <div className="my-6 rounded-lg overflow-hidden border border-surface-2 bg-[#0f0f14] not-prose">
      {filename && (
        <div className="bg-surface-2 px-4 py-2 text-xs font-mono text-text-secondary border-b border-surface-2 flex items-center justify-between">
          <span>{filename}</span>
          {annotations.length > 0 && (
            <span className="inline-flex items-center gap-1 text-neon-pink text-[10px] font-display">
              <Info className="w-3 h-3" />
              CLICK PINK LINES
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <pre className="text-sm font-mono leading-relaxed py-3">
          {lines.map((line, i) => {
            const lineNo = i + startLine;
            const annIdx = annotationByLine.get(lineNo);
            const hasAnn = annIdx !== undefined;
            const isOpen = openIndex === annIdx;
            return (
              <div
                key={lineNo}
                className={`group flex gap-4 px-4 ${
                  hasAnn
                    ? "cursor-pointer bg-neon-pink/[0.06] hover:bg-neon-pink/[0.14] border-l-2 border-neon-pink"
                    : "border-l-2 border-transparent"
                } ${isOpen ? "bg-neon-pink/[0.18]" : ""}`}
                onClick={() => {
                  if (annIdx === undefined) return;
                  setOpenIndex((cur) => (cur === annIdx ? null : annIdx));
                }}
              >
                <span className="text-text-secondary/60 select-none w-8 text-right shrink-0">
                  {lineNo}
                </span>
                <code className="text-text-primary whitespace-pre flex-1">
                  {line || " "}
                </code>
              </div>
            );
          })}
        </pre>
      </div>
      {openIndex !== null && annotations[openIndex] && (
        <div className="border-t border-neon-pink/40 bg-neon-pink/[0.08] px-4 py-3 relative">
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Close annotation"
            className="absolute top-2 right-2 text-text-secondary hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="font-display text-sm text-neon-pink mb-1">
            {annotations[openIndex].title}
          </div>
          <p className="text-text-primary text-sm leading-relaxed pr-6 whitespace-pre-wrap">
            {annotations[openIndex].body}
          </p>
        </div>
      )}
    </div>
  );
}
