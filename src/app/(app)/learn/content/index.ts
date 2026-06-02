import type { ComponentType } from "react";

export type ModulePart = "foundations" | "data" | "guts";

export interface ModuleMeta {
  id: string;
  number: number;
  part: ModulePart;
  title: string;
  summary: string;
  estMinutes: number;
  coversAppAreas?: string[];
}

export interface ModuleEntry extends ModuleMeta {
  load: () => Promise<{ default: ComponentType }>;
}

export const PART_LABELS: Record<ModulePart, string> = {
  foundations: "Foundations",
  data: "Data & State",
  guts: "This App's Guts",
};

export const PART_BLURBS: Record<ModulePart, string> = {
  foundations:
    "How a web app fits together and how this one's bones are arranged.",
  data: "How data moves between Supabase, the server, the browser, and the screen.",
  guts: "The actual systems that make DiceRollers do its thing.",
};

export const MODULES: ModuleEntry[] = [
  {
    id: "web-basics",
    number: 1,
    part: "foundations",
    title: "How a web app works",
    summary:
      "Browser, server, database — what each one does and where they all live in this repo.",
    estMinutes: 10,
    load: () => import("./01-web-basics.mdx"),
  },
  {
    id: "nextjs-routing",
    number: 2,
    part: "foundations",
    title: "Next.js routing & the App Router",
    summary:
      "Why folders are URLs, what (app), [id], page.tsx, and layout.tsx do — toured across DiceRollers.",
    estMinutes: 12,
    coversAppAreas: ["routes"],
    load: () => import("./02-nextjs-routing.mdx"),
  },
  {
    id: "react-components",
    number: 3,
    part: "foundations",
    title: "React components & JSX",
    summary:
      "Components as functions, props, state. We pick apart <RollCard /> line by line.",
    estMinutes: 12,
    coversAppAreas: ["roll", "feed"],
    load: () => import("./03-react-components.mdx"),
  },
  {
    id: "server-vs-client",
    number: 4,
    part: "foundations",
    title: "Server vs. client components",
    summary:
      'The "use client" boundary — what runs where, why, and how the Roll page uses both.',
    estMinutes: 12,
    coversAppAreas: ["roll"],
    load: () => import("./04-server-vs-client.mdx"),
  },
  {
    id: "typescript",
    number: 5,
    part: "foundations",
    title: "TypeScript in 20 minutes",
    summary:
      "Types, interfaces, strict mode. Just enough to read this codebase fluently.",
    estMinutes: 15,
    load: () => import("./05-typescript.mdx"),
  },
  {
    id: "supabase",
    number: 6,
    part: "data",
    title: "Supabase: database, auth, storage",
    summary:
      "What Postgres tables look like, what @supabase/ssr does, and the three client flavors.",
    estMinutes: 14,
    load: () => import("./06-supabase.mdx"),
  },
  {
    id: "auth-flow",
    number: 7,
    part: "data",
    title: "Auth flow end-to-end",
    summary:
      "Login → cookies → middleware → getUser() → redirect. Walked through the real code.",
    estMinutes: 12,
    coversAppAreas: ["login"],
    load: () => import("./07-auth-flow.mdx"),
  },
  {
    id: "tanstack-query",
    number: 8,
    part: "data",
    title: "TanStack Query: the data layer",
    summary:
      "Query keys, fetch functions, the cache, and why useEffect+fetch is banned here.",
    estMinutes: 14,
    load: () => import("./08-tanstack-query.mdx"),
  },
  {
    id: "server-prefetch",
    number: 9,
    part: "data",
    title: "Server prefetch + hydration",
    summary:
      "How HydrationBoundary hands data from server to client. Trace the Feed page end-to-end.",
    estMinutes: 12,
    coversAppAreas: ["feed"],
    load: () => import("./09-server-prefetch.mdx"),
  },
  {
    id: "mutations-optimistic",
    number: 10,
    part: "data",
    title: "Mutations & optimistic UI",
    summary:
      "useMutation, onMutate / onError rollback — how the like button feels instant.",
    estMinutes: 12,
    coversAppAreas: ["feed"],
    load: () => import("./10-mutations-optimistic.mdx"),
  },
  {
    id: "achievements-engine",
    number: 11,
    part: "guts",
    title: "The achievements engine",
    summary:
      "Bulk-fetch pattern, why one query per achievement is forbidden, and how queueCompletion works.",
    estMinutes: 18,
    coversAppAreas: ["achievements"],
    load: () => import("./11-achievements-engine.mdx"),
  },
  {
    id: "roll-deep-dive",
    number: 12,
    part: "guts",
    title: "Roll page deep-dive",
    summary:
      "DiePicker → API route → achievements.ts → confetti. The full flow.",
    estMinutes: 16,
    coversAppAreas: ["roll"],
    load: () => import("./12-roll-deep-dive.mdx"),
  },
  {
    id: "feed-infinite-scroll",
    number: 13,
    part: "guts",
    title: "Feed & infinite scroll",
    summary:
      "useInfiniteQuery + useScrollSentinel — keyset pagination explained.",
    estMinutes: 12,
    coversAppAreas: ["feed"],
    load: () => import("./13-feed-infinite-scroll.mdx"),
  },
  {
    id: "deployment",
    number: 14,
    part: "guts",
    title: "Deployment & the production stack",
    summary:
      "Vercel, the 5-phase deploy scripts, and why migrations ship before code.",
    estMinutes: 14,
    load: () => import("./14-deployment.mdx"),
  },
];

export const MODULES_BY_PART: Record<ModulePart, ModuleEntry[]> = {
  foundations: MODULES.filter((m) => m.part === "foundations"),
  data: MODULES.filter((m) => m.part === "data"),
  guts: MODULES.filter((m) => m.part === "guts"),
};

export function getModule(id: string): ModuleEntry | undefined {
  return MODULES.find((m) => m.id === id);
}

export function getAdjacent(id: string): { prev?: ModuleEntry; next?: ModuleEntry } {
  const i = MODULES.findIndex((m) => m.id === id);
  if (i < 0) return {};
  return {
    prev: i > 0 ? MODULES[i - 1] : undefined,
    next: i < MODULES.length - 1 ? MODULES[i + 1] : undefined,
  };
}
