"use client";

import { useState } from "react";
import { Play, RotateCcw, Lightbulb } from "lucide-react";

export interface EditableSnippetTestCase {
  args: unknown[];
  expected?: unknown;
  label?: string;
}

interface EditableSnippetProps {
  title: string;
  prompt: string;
  /** Function name expected to be defined inside the snippet, e.g. "rollDice". */
  functionName: string;
  starterCode: string;
  solutionCode?: string;
  testCases: EditableSnippetTestCase[];
}

interface RunResult {
  label: string;
  args: unknown[];
  output: unknown;
  expected?: unknown;
  passed?: boolean;
  error?: string;
}

function format(v: unknown): string {
  if (v === undefined) return "undefined";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((x, i) => deepEqual(x, b[i]));
    }
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
    );
  }
  return false;
}

export default function EditableSnippet({
  title,
  prompt,
  functionName,
  starterCode,
  solutionCode,
  testCases,
}: EditableSnippetProps) {
  const [code, setCode] = useState(starterCode);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  const run = () => {
    const out: RunResult[] = [];
    for (const tc of testCases) {
      try {
        // Build a function that returns the named function from the user's code.
        const factory = new Function(`
          "use strict";
          ${code}
          if (typeof ${functionName} !== "function") {
            throw new Error("No function named '${functionName}' was defined.");
          }
          return ${functionName};
        `);
        const fn = factory() as (...args: unknown[]) => unknown;
        const output = fn(...tc.args);
        const passed = tc.expected !== undefined ? deepEqual(output, tc.expected) : undefined;
        out.push({
          label: tc.label ?? `${functionName}(${tc.args.map(format).join(", ")})`,
          args: tc.args,
          output,
          expected: tc.expected,
          passed,
        });
      } catch (err) {
        out.push({
          label: tc.label ?? `${functionName}(${tc.args.map(format).join(", ")})`,
          args: tc.args,
          output: undefined,
          expected: tc.expected,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    setResults(out);
  };

  const reset = () => {
    setCode(starterCode);
    setResults(null);
    setShowSolution(false);
  };

  return (
    <div className="my-6 rounded-lg border border-neon-pink/40 bg-surface p-4 not-prose">
      <span className="font-display text-[10px] text-neon-pink tracking-wider">
        EDIT &amp; RUN
      </span>
      <div className="font-display text-base text-text-primary mb-1 mt-1">{title}</div>
      <p className="text-text-secondary text-sm mb-3 leading-relaxed">{prompt}</p>

      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        spellCheck={false}
        rows={Math.max(6, code.split("\n").length + 1)}
        className="w-full bg-[#0f0f14] border border-surface-2 rounded-md p-3 font-mono text-sm text-text-primary focus:outline-none focus:border-neon-pink resize-y"
      />

      <div className="flex flex-wrap gap-2 mt-3">
        <button
          type="button"
          onClick={run}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-display bg-neon-pink text-background hover:bg-neon-pink/90"
        >
          <Play className="w-3 h-3" />
          RUN
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-display bg-surface-2 text-text-secondary hover:text-text-primary"
        >
          <RotateCcw className="w-3 h-3" />
          RESET
        </button>
        {solutionCode && (
          <button
            type="button"
            onClick={() => setShowSolution((s) => !s)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-display bg-surface-2 text-text-secondary hover:text-text-primary"
          >
            <Lightbulb className="w-3 h-3" />
            {showSolution ? "HIDE SOLUTION" : "SHOW SOLUTION"}
          </button>
        )}
      </div>

      {results && (
        <div className="mt-4 space-y-2">
          {results.map((r, i) => {
            const passColor =
              r.error
                ? "border-red-500/60 bg-red-500/10"
                : r.passed === true
                ? "border-emerald-500/60 bg-emerald-500/10"
                : r.passed === false
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-surface-2 bg-[#0f0f14]";
            return (
              <div key={i} className={`rounded-md border p-3 text-sm font-mono ${passColor}`}>
                <div className="text-text-secondary text-xs mb-1">{r.label}</div>
                {r.error ? (
                  <div className="text-red-300">Error: {r.error}</div>
                ) : (
                  <>
                    <div className="text-text-primary">→ {format(r.output)}</div>
                    {r.expected !== undefined && (
                      <div className="text-text-secondary text-xs mt-1">
                        expected: {format(r.expected)}{" "}
                        <span
                          className={
                            r.passed ? "text-emerald-400" : "text-amber-400"
                          }
                        >
                          {r.passed ? "✓ match" : "✗ different"}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showSolution && solutionCode && (
        <pre className="mt-4 bg-[#0f0f14] border border-surface-2 rounded-md p-3 text-sm font-mono text-text-primary overflow-x-auto whitespace-pre">
          {solutionCode}
        </pre>
      )}
    </div>
  );
}
