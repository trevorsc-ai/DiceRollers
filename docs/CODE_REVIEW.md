# DiceRollers Code Review

**Reviewed:** 2026-05-22
**Scope:** Full src/ tree (~7.7K LOC), Supabase server logic, API routes
**Build health:** ✅ `tsc --noEmit` clean · ✅ `next lint` clean

The code compiles cleanly and lints cleanly. The issues are all structural: duplication, N+1 query patterns, swallowed errors, and over-fetching. Below is a prioritized punch list. Each item shows where it lives, why it matters, and the recommended fix.

---

## P0 — Bugs and silent failures

### 1. Achievement errors are silently swallowed
**File:** `src/app/api/rolls/route.ts:74-78`

```ts
try {
  newAchievements = await evaluateAchievements(adminSupabase, user.id, rollData, rollData.id);
} catch {
  // Achievement evaluation errors shouldn't fail the roll save
}
```

The empty `catch {}` means if `evaluateAchievements` throws (Supabase error, malformed roll, schema drift, etc.), the user gets a successful save with **zero achievements credited and zero visibility**. The intent is right (don't break the roll save), but blind swallow is wrong.

**Fix:** Log the error to Vercel logs at minimum:
```ts
} catch (err) {
  console.error("evaluateAchievements failed", { userId: user.id, rollId: rollData.id, err });
}
```
Ideally also surface a generic "achievements unavailable" hint in the response so the client can show a non-blocking toast.

### 2. `rollData!.length` non-null assertion when error is possible
**File:** `src/lib/achievements.ts:254`

```ts
rolls_to_complete: punchRolls!.length,
```

If the punch-query above errored, `punchRolls` is null and this throws. Cascades into the swallow above and silently breaks Punch Card crediting.

**Fix:** Guard with `?? 0` or treat a null `punchRolls` as an early return for the punch-card branch.

---

## P1 — Major duplication

### 3. `feed/page.tsx` and `history/page.tsx` are 80%+ the same code
**Files:**
- `src/app/(app)/feed/page.tsx` (388 lines)
- `src/app/(app)/history/page.tsx` (441 lines)

Both pages duplicate:
- Keyset pagination state (`lastTimeRef`, `hasMoreRef`, `inFlightRef`)
- `loadPage` callback with the same shape
- `IntersectionObserver` sentinel setup
- `loadAchievementsForRolls` + `loadTwinsForRolls` Promise.all glue
- Roll card layout (drink badges, doubles badge, achievement pills, twinsies indicator)

**Fix:** Extract three things:
1. **`useInfiniteRolls()` hook** — encapsulates pagination state + sentinel ref. Takes a query builder function as input.
2. **`<RollCard />` component** — accepts a normalized `Roll` shape. Owns the doubles badge, drink row, twinsies badge, achievement pills.
3. **`<DrinkBadge />` component** — replaces the three near-identical sibling components (see #4).

After extraction each page should be ~100 lines focused on its unique concerns: feed needs likes + user-tap, history needs filters + search.

### 4. Three nearly identical drink-row components
**Files:**
- `src/app/(app)/roll/page.tsx:291` — `DrinkCard` (62×62 large variant)
- `src/app/(app)/feed/page.tsx:342` — `MiniDrink` (34×34 small variant)
- `src/app/(app)/history/page.tsx:406` — `DrinkItem` (34×34 small variant)

All three render the same thing: a colored container with either a drink logo or the die number, plus a "BEER" / "SHOT" label.

**Fix:** One `<DrinkBadge size="lg" | "sm" />` component in `src/components/`. Same `name`, `logo`, `dieNum`, `color` props.

### 5. Duplicate `ChartCard` components
**Files:**
- `src/app/(app)/stats/page.tsx:101`
- `src/app/(app)/admin/users/page.tsx:104`

Identical surface, slightly different padding. Move to `src/components/ChartCard.tsx` and parameterize padding if needed.

### 6. Punched into the repo: `backlog 2.md` and `.env 2.example`
**Files:**
- `backlog 2.md` (identical to `backlog.md`)
- `.env 2.example` (identical to `.env.example`)

Classic macOS Finder/iCloud rename artifacts. Just delete them.

---

## P2 — `src/lib/achievements.ts` (831 lines) is begging for refactor

This file is the most leveraged spot in the codebase — it runs on **every roll save**. Today it makes ~15–25 round trips to Supabase per save. Most are unnecessarily separate.

### 7. Five separate "count rolls tonight" queries
**File:** `src/lib/achievements.ts:656-700` (and elsewhere)

These four achievements all run an identical `count(*) where user_id=? and roll_date=?`:
- `run_it_back` (≥2)
- `hat_trick` (≥3)
- `the_quad_god` (≥4)
- `the_legend` (≥5)

Plus three more that filter by additional columns on the same date:
- `hot_dice` / `on_fire` (≥2 / ≥3 doubles tonight)
- `mark_of_the_devil` (count of 6s on tonight's rolls)

**Fix:** One query early in the function returns tonight's rolls (full rows). Every "tonight" check becomes an in-memory operation. Drops 7+ DB calls to 1.

### 8. Two identical "recent dates" queries
**File:** `src/lib/achievements.ts:602-651`

`bender` (3-day streak) and `my_new_home` (7-day streak) both query:
```ts
.from("rolls").select("roll_date").eq("user_id", userId).order("roll_date", { ascending: false }).limit(50);
```
…and apply different length thresholds to the result.

**Fix:** One query, two predicates against the same result.

### 9. Two identical "rolls in the last hour" queries
**File:** `src/lib/achievements.ts:704-758`

`power_hour` (≥2) and `slow_down` (≥3) both fetch `count where roll_time between now-1h and now`. Same query, two thresholds.

### 10. Two queries for `fifty_fabulous` + `century_club`
**File:** `src/lib/achievements.ts:163-175`

Already partially deduplicated but `count(*) for user_id` is run separately from `count(*) where user_id and is_daily_double` (devotee), and `count(*) where user_id and is_doubles and not daily_double` (contrarian). These three filtering counts could be a single `SELECT count, count_filter, count_filter` SQL via RPC or just one fetch of relevant rows.

### 11. Day-of-week achievements: 7 if-statements that should be a lookup
**File:** `src/lib/achievements.ts:556-576`

```ts
if (!completed.has("sunday_funday") && dow === 0) await markComplete("sunday_funday");
if (!completed.has("case_of_the_mondays") && dow === 1) await markComplete("case_of_the_mondays");
// ...5 more
```

**Fix:**
```ts
const DOW_ACHIEVEMENTS = ["sunday_funday", "case_of_the_mondays", "taco_tuesday", "hump_day", "trivia_thursday", "friday_night_lights", "saturday_night_fever"];
const id = DOW_ACHIEVEMENTS[dow];
if (!completed.has(id)) await markComplete(id);
```

### 12. `fetchAchievementInfo()` is called per achievement (N+1)
**File:** `src/lib/achievements.ts:104-111, 126-127, 151-152, 257, 386-393`

Every time `markComplete` or `updateCounter` triggers a completion, we do a separate `SELECT * FROM achievements WHERE id=?`. For a single roll that triggers 5 achievements that's 5 round trips.

**Fix:** At the end of `evaluateAchievements`, do one `SELECT * FROM achievements WHERE id IN (...)` with the IDs collected during the run.

### 13. Each `markComplete` is its own upsert (no batching)
**File:** `src/lib/achievements.ts:113-128`

20+ achievements → up to 20+ sequential upserts. Supabase REST round trips. Each one is small but they all hit the cold-network path one after another.

**Fix:** Collect completions in an array, then issue ONE `upsert(rows)` at the end. The repeatables (Punch Card, Twinsies) need their own writes because they're not simple completion flags, but the simple cases can batch.

### 14. Magic strings everywhere — no achievement ID constants
The file references `"ring_gong"`, `"snake_eyes"`, `"twinsies"`, etc. as raw strings. A typo silently breaks evaluation. Same IDs are also hard-coded in `src/app/(app)/achievements/page.tsx`.

**Fix:** Generate a const enum (or just a record) from the achievements table at build time, or hand-author one in `src/lib/achievementIds.ts` and import everywhere.

---

## P3 — Client-side Supabase usage

### 15. `createClient()` called inside every client component body
**Files:** 16+ files, e.g. `src/app/(app)/feed/page.tsx:37`, `src/app/(app)/history/page.tsx:41`, etc.

```ts
export default function FeedPage() {
  const supabase = createClient();  // new client on every render
  ...
}
```

`createBrowserClient` from `@supabase/ssr` is reasonably cheap, but it's still a new instance per render and the `useEffect([supabase])` dependency lists make this a footgun (the effect re-runs whenever the client identity changes, even though Supabase has internal singleton-ish behavior).

**Fix (cheap):** Memoize at module scope:
```ts
// src/lib/supabase/client.ts
let _client: ReturnType<typeof createBrowserClient> | null = null;
export function getSupabaseClient() {
  if (!_client) _client = createBrowserClient(URL, KEY);
  return _client;
}
```
Now `[supabase]` deps are stable refs. Less churn, fewer accidental re-renders/re-fetches.

### 16. Stats page downloads every roll to compute frequencies in JS
**File:** `src/app/(app)/stats/page.tsx:151-156`

```ts
const { data: rollData } = await supabase
  .from("rolls")
  .select("*")
  .eq("user_id", user.id)
  .order("roll_time", { ascending: true });
```

You already have `get_global_stats` and `get_punch_card_club` RPCs for the global side. The personal side fetches every row and bins them client-side. For an active user with 500+ rolls this is several hundred KB on every navigation to /stats.

**Fix:** Create a `get_personal_stats(user_id)` RPC that mirrors `get_global_stats` shape. Pages can render off the same `StatsData` type for both modes.

### 17. Admin client recreated per request
**File:** `src/app/api/rolls/route.ts:8-13, 72`

`createClient` (admin) is invoked inside the POST handler. Fine for correctness, but for hot endpoints it adds avoidable allocation.

**Fix:** Hoist to module scope:
```ts
const adminSupabase = createClient(URL, SERVICE_ROLE_KEY);
```
Service-role clients have no per-request state so this is safe.

---

## P4 — Smaller cleanups

### 18. Duplicate admin auth boilerplate
**Files:** `src/app/(app)/admin/page.tsx:40-47`, `users/page.tsx:120-140`, similar in `menu`, `puzzles`

Each admin page repeats:
```ts
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
if (!profile?.is_admin) { setIsAdmin(false); setLoading(false); return; }
```

**Fix:** A `useAdminAuth()` hook returning `{ isAdmin, isLoading }`. Or — better — make `/admin/*` a route group with a layout that does the check once at the layout level and renders `<Forbidden />` for non-admins.

### 19. Three date-formatting helpers across files
- `formatDate` (achievements/page.tsx)
- `formatDay` (admin/users/page.tsx)
- `formatWeek` (admin/users/page.tsx — identical to formatDay)
- `formatTimeAgo` (feed/page.tsx)

**Fix:** `src/lib/format.ts` with `formatShortDate`, `formatRelativeTime`, etc. `formatWeek` and `formatDay` are literally the same function — just delete one.

### 20. `react-hooks/exhaustive-deps` disabled in history page
**File:** `src/app/(app)/history/page.tsx:165`

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [supabase]);
```

The init effect intentionally fires once. With a memoized `supabase` (item #15) this comment can probably go away. Right now it's papering over an instability that #15 fixes properly.

### 21. Several `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
**Files:** Multiple, e.g. `feed/page.tsx:90`, `history/page.tsx:115`, `achievements.ts:332`, `rollAchievements.ts:38`

These are all about Supabase's joined-row return types being awkward. Worth investing in proper types — e.g. by generating types with `supabase gen types typescript` and reading from `src/types/database.ts` (which exists but is underused).

### 22. `useDailyDoubleLogos` runs on every component that uses it
**File:** `src/hooks/useDailyDoubleLogos.ts` (used in feed + history)

If both feed and history are open in adjacent tabs of a router stack, both run identical queries on mount. **Fix:** Either cache via React Context provider at the `(app)` layout, or use SWR/React Query (next item).

### 23. No data-fetching library
You're hand-rolling fetch + state + dedup + revalidation everywhere. SWR (Vercel's own) or TanStack Query would eliminate hundreds of lines of `useEffect`/`useRef`/`inFlightRef` boilerplate, give automatic cache/dedup across components, and make the perf wins in #15-#17 cascade naturally.

**Tradeoff:** Adds ~10KB to the bundle. For a Next.js app of this size with this many client-component pages, almost certainly worth it.

### 24. `'use client'` on 23 of ~27 source files
Almost every page is a client component. Most of these (achievements, history, stats, admin/users) could be server components for the initial data fetch with a small client island for interactivity. That's:
- Faster TTFB (data loads on the server, cached, streamed)
- Smaller client bundle (Supabase client code isn't shipped to the browser for read-only pages)
- Removes `[supabase]` dep churn entirely on the initial load

This is the highest-leverage perf change, but also the biggest refactor. Recommend tackling **after** items #3-#5 (rolls list extraction) — once you have a `<RollCard>` server component, swapping fetches to server-side is one PR per page.

---

## Performance summary

If you implement P0-P2 (just the achievement work), every roll save drops from ~15-25 DB round trips to ~3-5. That's the single biggest perf lever in the app — it sits in the hot path of the only write operation users care about.

Items #15-#17 are bigger wins for the read paths (feed, history, stats) but require more refactoring.

---

## Suggested fix order

1. **#1, #2** — bug fixes, 5 minutes total
2. **#6** — delete the two duplicate `*2.*` files, 30 seconds
3. **#11** — DOW lookup, 5 minutes (read momentum)
4. **#7-#10** — achievement.ts query consolidation, ~2 hours, drops DB pressure by ~70%
5. **#3, #4, #5** — extract `<RollCard>`, `<DrinkBadge>`, `<ChartCard>`. ~3 hours. Net deletion: ~400 lines.
6. **#15** — module-scope memoized supabase client, ~15 minutes. Unblocks dep churn fixes.
7. **#16** — `get_personal_stats` RPC. ~1 hour including SQL.
8. **#18** — admin auth as layout. ~30 minutes.
9. **#12, #13** — batch achievement reads/writes. ~1 hour.
10. **#19-#22** — incremental cleanups, as you go.
11. **#23** — adopt SWR or React Query (separate ADR-worthy decision).
12. **#24** — move read-only pages to server components (one PR per page).

Stop at any point — earlier items pay for themselves immediately, later ones compound but require more thinking.
