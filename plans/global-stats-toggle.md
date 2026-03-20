---
planStatus:
  planId: plan-global-stats-toggle
  title: Global Stats Toggle on Stats Page
  status: ready-for-development
  planType: feature
  priority: medium
  owner: travisscavone
  stakeholders: []
  tags: ["stats", "ui", "supabase-rpc"]
  created: "2026-03-20"
  updated: "2026-03-20T00:00:00.000Z"
  progress: 0
---

# Global Stats Toggle on Stats Page

## Objective

Add a "MY ROLLS | ALL ROLLERS" segmented pill toggle to the stats page. Personal mode shows the current user's stats. Global mode shows aggregate stats across every roll ever recorded (bypassing RLS via a SECURITY DEFINER RPC), plus the leaderboard.

## Decisions

| Question | Answer |
|----------|--------|
| Scope | **All rolls ever** — bypass RLS via SECURITY DEFINER Supabase RPC |
| Streak | **Hidden** in global mode (personal only) |
| Leaderboard | **Global mode only** — remove from personal mode |
| Fetch strategy | **Supabase RPC** returning pre-aggregated JSON |
| Toggle label | **MY ROLLS \| ALL ROLLERS** segmented pill |

---

## Architecture

### 1. Supabase RPC — `get_global_stats()`

New migration `supabase/migrations/005_global_stats_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_rolls',   (SELECT COUNT(*) FROM rolls),
    'total_doubles', (SELECT COUNT(*) FROM rolls WHERE is_doubles = true),
    'red_die_freq',  (
      SELECT jsonb_object_agg(red_die_number, cnt)
      FROM (SELECT red_die_number, COUNT(*) AS cnt FROM rolls GROUP BY red_die_number) t
    ),
    'white_die_freq', (
      SELECT jsonb_object_agg(white_die_number, cnt)
      FROM (SELECT white_die_number, COUNT(*) AS cnt FROM rolls GROUP BY white_die_number) t
    ),
    'top_drinks', (
      SELECT jsonb_agg(t ORDER BY t.count DESC)
      FROM (
        SELECT drink_name, SUM(cnt) AS count FROM (
          SELECT red_drink_name AS drink_name, COUNT(*) AS cnt FROM rolls GROUP BY red_drink_name
          UNION ALL
          SELECT white_drink_name AS drink_name, COUNT(*) AS cnt FROM rolls GROUP BY white_drink_name
        ) sub GROUP BY drink_name ORDER BY count DESC LIMIT 8
      ) t
    ),
    'day_of_week', (
      SELECT jsonb_agg(t ORDER BY t.day_num)
      FROM (
        SELECT EXTRACT(DOW FROM roll_time)::int AS day_num, COUNT(*) AS count
        FROM rolls GROUP BY day_num
      ) t
    ),
    'leaderboard', (
      SELECT jsonb_agg(t ORDER BY t.count DESC)
      FROM (
        SELECT p.username, COUNT(r.id) AS count
        FROM rolls r JOIN profiles p ON p.id = r.user_id
        GROUP BY p.username ORDER BY count DESC LIMIT 10
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- Only authenticated users can call this function
REVOKE ALL ON FUNCTION public.get_global_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_stats() TO authenticated;
```

Returns a single JSONB blob — no raw roll rows ever leave the DB.

### 2. Stats Page Changes (`src/app/(app)/stats/page.tsx`)

#### State additions
```typescript
const [mode, setMode] = useState<'personal' | 'global'>('personal');
const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
const [globalLoading, setGlobalLoading] = useState(false);
```

#### Data fetching
- **Personal mode** (unchanged): fetch own rolls with `eq("user_id", user.id)`. Remove the separate `pubRolls` leaderboard query entirely.
- **Global mode** (lazy): call `supabase.rpc('get_global_stats')` only on first switch to global, then cache in state.

#### GlobalStats TypeScript type
```typescript
interface GlobalStats {
  total_rolls: number;
  total_doubles: number;
  red_die_freq: Record<string, number>;
  white_die_freq: Record<string, number>;
  top_drinks: { drink_name: string; count: number }[];
  day_of_week: { day_num: number; count: number }[];
  leaderboard: { username: string; count: number }[];
}
```

#### Chart data derivation
Transform global RPC response into the same chart-array shapes the existing charts consume, so the chart JSX can be reused without modification:

- `redFreq` / `whiteFreq` → map 1–8 over `red_die_freq` / `white_die_freq` record
- `topDrinks` → map `top_drinks` array, truncating names >10 chars
- `dayFreq` → map DAYS array using `day_of_week` array keyed by `day_num`

#### Rendering differences by mode

| Section | Personal | Global |
|---------|----------|--------|
| Toggle pill | ✓ | ✓ |
| Total rolls / Doubles / Dbl % | ✓ | ✓ |
| Streak | ✓ | ✗ |
| Die frequency charts | ✓ | ✓ |
| Top drinks chart | ✓ | ✓ |
| Rolls by day of week | ✓ | ✓ |
| Leaderboard | ✗ | ✓ |

#### Toggle pill UI
Sits below the "STATS" heading:
```tsx
<div className="flex rounded-full border border-surface-2 overflow-hidden">
  <button
    onClick={() => setMode('personal')}
    className={`flex-1 py-2 text-xs font-display tracking-widest transition-colors ${
      mode === 'personal'
        ? 'bg-neon-pink text-background'
        : 'text-text-secondary hover:text-text-primary'
    }`}
  >
    MY ROLLS
  </button>
  <button
    onClick={() => setMode('global')}
    className={`flex-1 py-2 text-xs font-display tracking-widest transition-colors ${
      mode === 'global'
        ? 'bg-neon-pink text-background'
        : 'text-text-secondary hover:text-text-primary'
    }`}
  >
    ALL ROLLERS
  </button>
</div>
```

---

## Files to Change

| File | Type | Change |
|------|------|--------|
| `supabase/migrations/005_global_stats_rpc.sql` | New | `get_global_stats()` SECURITY DEFINER RPC |
| `src/app/(app)/stats/page.tsx` | Edit | Toggle, global fetch, conditional rendering, remove leaderboard from personal |

---

## Out of Scope

- No DB schema changes (no new tables/columns)
- No changes to RLS policies
- No changes to other pages
