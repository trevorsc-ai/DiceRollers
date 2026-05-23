# DiceRollers — Architecture Guide

Read this before changing any code. The goal is to **reuse what's already there** instead of growing new copies.

## Stack
- Next.js 14 App Router · TypeScript strict · Tailwind
- Supabase (Postgres + Auth + Storage) via `@supabase/ssr`
- TanStack Query for all client-side data
- Recharts for admin charts

---

## Data fetching — always TanStack Query

**Never** write `useEffect(() => { fetch... setState... })` for data. **Never** hold `loading`/`error` in `useState`.

| Need | Use |
|---|---|
| Single read | `useQuery` |
| Paginated read | `useInfiniteQuery` + `useScrollSentinel` |
| Write | `useMutation` (add `onMutate`/`onError` for optimistic UI) |

Query functions live in `src/lib/queries/*.ts`. Each module exports:
- A **query key factory** (`somethingQueryKey(...)`)
- The **fetch function** that takes a `SupabaseClient` so it works on server *and* client

Add to an existing queries file before making a new one. The same key + fetch fn must be used by every caller — that's how the cache dedupes.

```ts
// in src/lib/queries/example.ts
export const exampleQueryKey = (id: string) => ["example", id] as const;
export async function fetchExample(supabase: SupabaseClient, id: string) { /* ... */ }

// in a client component
const { data } = useQuery({ queryKey: exampleQueryKey(id), queryFn: () => fetchExample(supabase, id) });
```

---

## Server vs. client components

| Page type | Pattern |
|---|---|
| Read-only with light interactivity (filters, expand/collapse) | **Server `page.tsx` + client `*View.tsx`** — server prefetches into `HydrationBoundary`, client `useQuery` picks up |
| Heavy interactivity (saves, infinite scroll, inputs) | **Pure client component** — `"use client"` at top |
| Static text | Server component, no fetching |

**Server prefetch template:**
```ts
// page.tsx (server)
export default async function Page() {
  const supabase = await createClient(); // server client from @/lib/supabase/server
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const queryClient = createQueryClient();
  await queryClient.prefetchQuery({ queryKey: ..., queryFn: () => fetch...(supabase, ...) });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SomeView userId={user.id} />
    </HydrationBoundary>
  );
}
```

The client view receives auth state as props — never re-fetch `auth.getUser()` in the client when the server already has it.

---

## Shared components — check before building

Before writing a new component, search `src/components/` and `src/components/roll/`. The following exist and **must be reused**:

| Need | Use |
|---|---|
| Roll card (feed/history) | `<RollCard>` from `@/components/roll/RollCard` (header/footer slots) |
| Drink + die badge | `<DrinkBadge size="md\|lg">` |
| "DOUBLES!" / "DAILY DOUBLE!" pill | `<DoublesBadge>` |
| Twinsies indicator | `<TwinsiesBadge partners={...}>` |
| Achievement chips | `<AchievementPills achievements={...}>` |
| Titled chart container | `<ChartCard variant="stats\|admin">` |
| Daily-double rotating logos | `useDailyDoubleLogos()` (shared cache, do not re-fetch) |
| Infinite scroll sentinel | `useScrollSentinel(onIntersect)` |

If you're tempted to write something close to one of these — generalise the existing one instead. Variants go on the existing component (`size`, `variant`, `rounded`), not in a new file.

---

## Formatting & utilities

| | Use |
|---|---|
| Short date pill ("MAY 22") | `formatShortDate` from `@/lib/format` |
| Chart axis date ("5/22") | `formatMonthDay` |
| Relative time ("5m ago") | `formatRelativeTime` |
| Achievement IDs | `ACHIEVEMENT_IDS` / `DOW_ACHIEVEMENTS` from `@/lib/achievementIds` — never use raw string IDs |

---

## Achievement engine (`src/lib/achievements.ts`)

This runs on every roll save and is the hot path. Rules:

- **One bulk fetch up front**, then derive everything from it in memory. Do not add new individual count queries.
- New simple-completion achievements: add to `queueCompletion(A.YOUR_ID)`, batched at the end.
- Counter-style achievements: `queueCounter(A.YOUR_ID, progress, target, progressDetail?)`.
- Repeatable achievements with side tables (punch card, twinsies) keep their dedicated writes.
- Add new IDs to `src/lib/achievementIds.ts` first. The DB seed migration must match.

---

## Mutations — optimistic by default

For any UI that flips state (like, toggle, edit), use `useMutation` with `onMutate` snapshot + `onError` rollback. Pattern:

```ts
const m = useMutation({
  mutationFn: async (vars) => { /* ... */ },
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey });
    const previous = queryClient.getQueryData(queryKey);
    queryClient.setQueryData(queryKey, (prev) => /* optimistic shape */);
    return { previous };
  },
  onError: (_e, _v, ctx) => { if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous); },
});
```

---

## Admin pages

Admin gating is **server-side in `src/app/(app)/admin/layout.tsx`**. Inside any `/admin/*` page you can assume the user is an admin — do not re-check.

---

## Supabase clients

- Client side: `createClient` from `@/lib/supabase/client`. Don't try to memoise it at module scope — the SSR package singletons internally.
- Server side: `createClient` from `@/lib/supabase/server` (async, reads cookies).
- Service role (admin writes): only inside API routes, lazily created via `getAdminClient()` pattern (see `src/app/api/rolls/route.ts`).

---

## File layout cheatsheet

```
src/
├── app/(app)/<page>/page.tsx        ← server (prefetch + hydrate)
├── app/(app)/<page>/<Page>View.tsx  ← client (uses query)
├── app/api/<route>/route.ts         ← API handlers
├── components/                      ← shared UI
│   ├── ChartCard.tsx
│   ├── Providers.tsx
│   └── roll/                        ← roll-card family
├── hooks/                           ← shared client hooks
├── lib/
│   ├── format.ts                    ← date/time helpers
│   ├── queries/                     ← query keys + fetch fns (shared server+client)
│   ├── queryClient.ts               ← TanStack QueryClient factory
│   ├── achievements.ts              ← roll-save engine
│   ├── achievementIds.ts            ← canonical IDs
│   └── supabase/                    ← client.ts + server.ts + middleware.ts
└── types/database.ts                ← generated Supabase types
```

---

## Things to NEVER do

- Re-implement keyset pagination — use `useInfiniteQuery`.
- Add a `useState` + `useEffect` data fetch — use `useQuery`.
- Copy a card/badge/component "with one small change" — add a prop to the existing one.
- Hard-code achievement IDs as strings — use `ACHIEVEMENT_IDS`.
- Add per-achievement count queries to `achievements.ts` — reuse the bulk-fetched data.
- Re-check `is_admin` inside an `/admin/*` page — the layout does it.
- Swallow errors with empty `catch {}` — log with context.
- Add named exports (other than `default`) to `app/**/page.tsx` files — Next.js will refuse to build.

---

## Before opening a PR

```bash
npx tsc --noEmit   # must pass
npx next lint      # must pass
npx next build     # must pass (needs .env.local with Supabase URL/keys)
```

Migrations: new SQL goes in `supabase/migrations/NNN_description.sql` with the next sequential number. Apply locally first.
