import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="font-display text-3xl text-text-primary mb-4 mt-2">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-display text-2xl text-text-primary mt-8 mb-3">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="font-display text-xl text-text-primary mt-6 mb-2">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-text-primary leading-relaxed my-3">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-6 my-3 text-text-primary space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 my-3 text-text-primary space-y-1">{children}</ol>
    ),
    code: ({ children }) => (
      <code className="bg-surface-2 text-neon-pink px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-surface-2 text-text-primary p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono">
        {children}
      </pre>
    ),
    a: ({ href, children }) => (
      <a href={href} className="text-neon-pink underline hover:text-neon-pink/80">
        {children}
      </a>
    ),
    strong: ({ children }) => (
      <strong className="text-text-primary font-semibold">{children}</strong>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-neon-pink/60 pl-4 my-4 text-text-secondary italic">
        {children}
      </blockquote>
    ),
    ...components,
  };
}
