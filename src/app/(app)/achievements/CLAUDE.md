# Adding a New Achievement

Read root `CLAUDE.md` first. This file is the **step-by-step** for the most common change in this app: adding one achievement.

## Files touched (in order)

1. `supabase/migrations/NNN_<id>.sql` — seed the row
2. `src/lib/achievementIds.ts` — add the const
3. `src/lib/achievements.ts` — eval logic
4. *(optional)* `supabase/migrations/NNN+1_<id>_backfill.sql` — backfill historical rolls
5. *(rare)* `src/app/(app)/achievements/AchievementsView.tsx` — only if custom visual (grid/log)

If you don't touch all 4 required files, you're not done.

---

## Step 1 — Seed migration

```sql
-- supabase/migrations/NNN_<id>.sql
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  '<snake_case_id>', '<Display Name>', '<emoji>',
  '<Imperative description, sentence case>',
  '<category>', '<Category Name>', '<category emoji>',
  <target or NULL>, <next sort_order in category>
);
```

### Categories (use exactly these values)

| `category` | `category_name` | `category_emoji` |
|---|---|---|
| `youre_a_regular` | `You're a Regular` | 💎 |
| `craps_table` | `The Craps Table` | 🎰 |
| `special_combos` | `Special Combinations` | 👯 |
| `clocking_in` | `Clocking In` | ⏰ |
| `danger_zone` | `Danger Zone` | ⚠️ |
| `holiday` | `Holidays` | 🎁 |

### `target_count`
- `NULL` for one-shot achievements (snake eyes, holidays)
- An integer for counters (`fifty_fabulous`=50, `malort_advent_calendar`=25)

### `sort_order`
Increments of 10 within a category. Look at the last row in your category and add 10. Leaves gaps for future inserts.

---

## Step 2 — Add the ID constant

In `src/lib/achievementIds.ts`, add under the right category block:

```ts
YOUR_NEW_ID: "<snake_case_id>",
```

Keep the file's section grouping intact. **Never** reference the raw string elsewhere — always `A.YOUR_NEW_ID`.

---

## Step 3 — Eval logic in `src/lib/achievements.ts`

Pick the pattern that matches your achievement. **Do not add new individual count queries** — the bulk fetch at the top of `evaluateAchievements` already has what you need.

### Pattern A — fires on this single roll (most common)

Triggered purely by the current roll's properties. Snake-eyes, boxcars, holidays, drink-name combos.

```ts
if (roll.red_die_number === 1 && roll.white_die_number === 1) {
  queueCompletion(A.YOUR_NEW_ID);
}
```

`queueCompletion` already skips re-completion and batches the write.

### Pattern B — derived from tonight's rolls

Anything "in one night" — uses `tonightRolls`, already fetched once.

```ts
const malortTonight = tonightRolls.filter((r) => r.white_die_number === 6).length;
if (malortTonight >= 3) queueCompletion(A.YOUR_NEW_ID);
```

### Pattern C — derived from last hour

```ts
if (lastHourCount >= 5) queueCompletion(A.YOUR_NEW_ID);
```

### Pattern D — counter with target

Lifetime accumulator. Reuse one of the pre-fetched counts when possible.

```ts
queueCounter(A.YOUR_NEW_ID, totalRollsCount ?? 0, 200);
```

If you need a new aggregate count, add it to the bulk-fetch `Promise.all` at the top of `evaluateAchievements` (do NOT add it inline later).

### Pattern E — recent-dates streak

```ts
// inside the "Bender / My New Home" block — extend the helper
if (isConsecutiveTail(14)) queueCompletion(A.YOUR_NEW_ID);
```

### Pattern F — drink-name combo (single roll)

Append to `SPECIAL_COMBOS`:

```ts
{ id: A.YOUR_NEW_ID, redDrink: "Some Beer", whiteDrink: "Some Shot" },
```

The loop already evaluates it. Nothing else to add.

### Pattern G — holiday (date check)

Put under the `// ── HOLIDAYS ──` section. Use `month`/`day`/`dow` from `getNYDate(roll.roll_date)`. Variable holidays use `getEasterDate` / `getThanksgivingDate`.

### Patterns you should NOT use
- **Repeatable with side table** (Punch Card) or **with progress_detail array** (Twinsies) require custom write paths. If your achievement truly needs to fire more than once, talk to the user before building — these are the only two and they each have unique storage.
- Standalone Supabase queries inside `evaluateAchievements`. The few that remain (Shot Roulette, Double Trouble, Around the World, Punch Card) are guarded by `!completed.has(...)` because they're expensive — don't add more.

---

## Step 4 — Backfill migration (when applicable)

If existing users could have already met the condition, write a backfill so they get the achievement on next deploy instead of having to re-trigger it.

```sql
-- supabase/migrations/NNN+1_<id>_backfill.sql
WITH first_match AS (
  SELECT DISTINCT ON (user_id)
    user_id, id AS roll_id, roll_time
  FROM rolls
  WHERE <condition>
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, '<id>', 1, roll_time, roll_id
FROM first_match
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1,
      completed_at = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at = NOW();
```

For counters, set `progress` to the user's current count and only set `completed_at` if they've hit the target.

**Skip the backfill when:**
- Achievement is impossible to evaluate retroactively (depends on real-time context)
- Achievement is a holiday that's already passed for the year
- It's a Day-1 launch achievement seeded from scratch

---

## Step 5 — UI customization (rare)

Almost every achievement renders fine using the default `<AchievementCard>` in `AchievementsView.tsx`. Skip this step unless you need a custom display.

Custom UI lives inside the `AchievementCard` body, conditionally rendered by ID:

```tsx
{a.id === A.YOUR_NEW_ID && <YourCustomGrid detail={a.progress_detail} />}
```

Examples already in the file: `DoublesGrid`, `AroundTheWorldGrid`, `PunchCardGrid`, `TwinsiesLog`.

If your achievement uses `progress_detail`, extend the `progress_detail` type in `src/lib/queries/achievements.ts` (`UserAchievementRow.progress_detail`).

---

## Step 6 — Verify

```bash
npx tsc --noEmit
npx next build
```

Then run the migration against your local Supabase, save a triggering roll, confirm the achievement appears in:
1. The save-roll API response (`newAchievements`)
2. The achievements page
3. The feed/history roll card pills

---

## Naming conventions

- **ID** (snake_case): describes the *condition*, not the prize. `mark_of_the_devil` ✓, `three_sixes_today` ✗
- **Name** (Title Case): short, punchy. Avoid generic.
- **Description**: imperative, starts with a verb. "Roll Malort 25 times" — not "Awarded for rolling Malort 25 times".
- **Emoji**: one glyph. Look at existing achievements before picking — duplicates are confusing.

---

## Checklist (copy into your PR description)

- [ ] Seed migration written and applied locally
- [ ] ID added to `achievementIds.ts` under the right category
- [ ] Eval logic in `achievements.ts` uses an existing pattern + reuses bulk-fetched data
- [ ] Backfill migration written (or explicitly skipped with reason)
- [ ] Tested: triggering roll fires modal + appears on feed/history/achievements page
- [ ] `npx tsc --noEmit` and `npx next build` clean
