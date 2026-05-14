# Plan: "Twinsies" 👯 Achievement

## Context

We're adding the first **cross-user** achievement to DiceRollers. When two users roll the **same exact dice combination** (red die + white die, ordered match) on the same `roll_date` (bar-night adjusted), both users get credit toward "Twinsies". It lives in the **"You're a Regular" 💎** category and unlocks at **2 twin events** (counter achievement, like Malort Advent Calendar).

The wrinkle: when user A rolls, no one has matched yet. When user B rolls and matches, user B's match can be credited synchronously at roll-save time, but user A has no idea — they need the credit to appear **the next time they open the app**. So we need a deferred check that runs on app layout load and reconciles any twin events that occurred while the user was away.

### Historical data (informs backfill)
- 9 distinct twin pair-events across 191 rolls / 38 rollers
- 7 users have ≥1 historical twin event
- Backfill rule: any user with ≥1 historical event gets `progress = 1` (must earn one more new twin to unlock; no retroactive auto-unlocks)

## Design overview

- **Achievement definition**: `id = 'twinsies'`, emoji `👯`, category `youre_a_regular`, `target_count = 2`.
- **Match rule**: same `roll_date` AND same `red_die_number` AND same `white_die_number`, across two distinct users.
- **Per-user counting**: increment a user's progress by 1 for each *unique* twin event they're a party to (a "twin event" = `(roll_date, red, white)` shared with at least one other user, counted once per user regardless of how many other users matched that combo on that date).
- **Dedupe**: each user must not be credited twice for the same twin event. Track credited events in `user_achievements.progress_detail` as `{"credited_events": [{"key": "YYYY-MM-DD|R|W", "partners": ["username1", "username2"]}, ...]}` — partners stored so the unlock modal can name them later. Idempotent on `key`.
- **Sync path (second roller)**: in `evaluateAchievements()`, when a new roll is saved, look for other users' rolls with the same `(roll_date, red, white)`. If found and event key not yet credited for this user, increment progress.
- **Deferred path (first roller)**: on authenticated layout mount, call a server route that runs the same reconciliation for the current user against all their historical rolls. Stores results idempotently.
- **Reveal UX**: when the deferred path increments progress to `target_count` (unlocks), it returns the new achievement *plus* the list of usernames the user twinned with for each credited event. Client stores it in `localStorage["new_achievements"]`, navigation to `/roll` will then display the existing `AchievementModal` with an added line: "You twinned with **@username** (and N others, if applicable)". Progress increments that don't unlock are silent.
- **N-way support**: schema/UX must handle 3+ users sharing a combo on a night (never happened historically, but possible). The modal displays a comma-separated list (or "@a, @b, and @c"); credited-event dedupe still treats it as one event per `(roll_date, red, white)` for the current user.

## Implementation steps

### 1. Migration: define the achievement
**File**: `supabase/migrations/0NN_twinsies_achievement.sql` (next sequence number)

```sql
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'twinsies', 'Twinsies', '👯',
  'Roll the same exact dice combo as another roller on the same night — twice.',
  'youre_a_regular', 'You''re a Regular', '💎', 2, 35
)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, emoji=EXCLUDED.emoji, description=EXCLUDED.description,
  target_count=EXCLUDED.target_count, sort_order=EXCLUDED.sort_order;
```

### 2. Migration: backfill historical progress (cap at 1)
Same migration file. For every user with ≥1 historical twin event, insert `user_achievements` row with `progress = 1`, `completed_at = NULL`, and `progress_detail` containing the **first** historical event key (so it's not re-counted later):

```sql
WITH twin_events AS (
  SELECT a.user_id, a.roll_date, a.red_die_number, a.white_die_number,
         MIN(a.id) AS first_roll_id, MIN(a.roll_time) AS first_time
  FROM rolls a
  JOIN rolls b
    ON a.roll_date = b.roll_date
   AND a.red_die_number = b.red_die_number
   AND a.white_die_number = b.white_die_number
   AND a.user_id <> b.user_id
  GROUP BY a.user_id, a.roll_date, a.red_die_number, a.white_die_number
),
first_per_user AS (
  SELECT DISTINCT ON (user_id) user_id, roll_date, red_die_number, white_die_number, first_roll_id
  FROM twin_events ORDER BY user_id, first_time
)
INSERT INTO user_achievements (user_id, achievement_id, progress, progress_detail, earned_on_roll_id, completed_at)
SELECT user_id, 'twinsies', 1,
       jsonb_build_object('credited_events',
         jsonb_build_array(roll_date::text || '|' || red_die_number || '|' || white_die_number)),
       NULL, NULL
FROM first_per_user
ON CONFLICT (user_id, achievement_id) DO NOTHING;
```

This makes the 7 historical users start at `1/2`. No one auto-unlocks.

### 3. Add Twinsies logic to `evaluateAchievements()` (sync path)
**File**: `src/lib/achievements.ts` (extend the function, ~line 197 area, follow the Malort/counter pattern)

Logic:
1. If `completed.has('twinsies')` already, skip.
2. Build event key for the just-saved roll: `${roll.roll_date}|${roll.red_die_number}|${roll.white_die_number}`.
3. Query: does any **other** user have a roll with the same `(roll_date, red, white)`?
4. If yes, load this user's existing `user_achievements.progress_detail.credited_events` (or empty array). If the event key is already in there, skip.
5. Otherwise: append event key, increment `progress`. If `progress >= 2`, set `completed_at = NOW()` and `earned_on_roll_id = rollId`. Use an upsert helper consistent with existing patterns.

Use the existing `markComplete` / `updateCounter` helpers (`achievements.ts:83–155`) as templates; may need a new helper that also writes `progress_detail`.

### 4. Deferred reconciliation: server route
**New file**: `src/app/api/achievements/reconcile-twinsies/route.ts`

- `POST` (or `GET`) handler, auth required (read user from session).
- Use admin Supabase client (service role) — `src/lib/supabaseAdmin.ts` pattern.
- Fetch all twin events for the current user via SQL:
  ```sql
  SELECT DISTINCT a.roll_date, a.red_die_number, a.white_die_number, MIN(a.id) AS roll_id
  FROM rolls a
  JOIN rolls b ON a.roll_date=b.roll_date AND a.red_die_number=b.red_die_number
              AND a.white_die_number=b.white_die_number AND a.user_id <> b.user_id
  WHERE a.user_id = $user
  GROUP BY a.roll_date, a.red_die_number, a.white_die_number;
  ```
- Load `user_achievements` row for `twinsies`. Get `credited_events`.
- For each event not in `credited_events`, append it and bump `progress` (capped at 2). If unlocked, set `completed_at` and `earned_on_roll_id` (use the corresponding `roll_id`).
- Return JSON: `{ newlyEarned: AchievementInfo[] | [] }`.

This handler is idempotent and cheap (one indexed self-join). Safe to call on every layout mount, but we'll throttle (see step 5).

### 5. Wire deferred check into app layout
**File**: `src/app/(app)/layout.tsx` (currently lines 1–31, only auth + oath)

- Add a small client component `TwinsiesReconciler` mounted inside the layout.
- On mount, check `sessionStorage["twinsies_reconciled"]`. If absent:
  1. POST to `/api/achievements/reconcile-twinsies`.
  2. Set the sessionStorage flag.
  3. If response has `newlyEarned` entries, push their IDs into `localStorage["new_achievements"]` (same key the roll page already consumes at `roll/page.tsx:112–123`).
- No UI rendered. Silent on failure.

The existing roll page already reads `localStorage["new_achievements"]` and renders `AchievementModal`, so the unlock celebration "appears the next time they go to roll" with no extra UI work. (Verify exact consumption path during implementation — may need to surface the modal on whatever page they're on, not strictly roll page.)

### 6. AchievementModal: show twin partner(s)
**File**: `src/components/AchievementModal.tsx`

- Extend the prop shape (or the `AchievementInfo` type in `src/lib/achievements.ts`) with an optional `twinPartners?: string[]` field, set only for the twinsies unlock.
- When `twinPartners` is non-empty, render an extra line under the description: `with @user1` (1 partner), `with @user1 & @user2` (2), or `with @user1, @user2, and @user3` (3+). Use a simple Intl.ListFormat or hand-rolled formatter.
- The unlocking event's partner list comes from `progress_detail.credited_events[lastIndex].partners` — populated by both the sync path and the reconcile route at the moment of the unlocking increment.
- localStorage payload becomes `{ id: "twinsies", twinPartners: [...] }` instead of just an ID; update the roll page consumer at `src/app/(app)/roll/page.tsx:112–123` to pass the partner array through.

### 7. Achievements page surfacing
**File**: `src/app/(app)/achievements/page.tsx` — already iterates all achievements by category and shows progress bars (lines 336–353). The new `twinsies` row will appear automatically under "You're a Regular" once the seed migration runs. No changes needed unless we want a custom display (e.g., listing who you twinned with). **Out of scope for v1.**

### 8. Feed roll card: show twin partner next to achievement badge
**File**: `src/app/(app)/feed/page.tsx` (lines 70–79 join, 266–282 badge rendering)

- The feed loads each roll's earned achievements via `earned_on_roll_id`. When a `twinsies` badge renders on a roll card, display the partner username inline next to the 👯 emoji — e.g., `👯 Twinsies · with @username`.
- Data source: read the partner(s) from `user_achievements.progress_detail.credited_events`, matching the event whose `(roll_date, red, white)` equals the card's roll. The matching event's `partners` array gives the username(s) to render.
- Include `progress_detail` in the feed's existing achievement query select. For 3+ partners, render as `with @a, @b & @c` (same formatter used by the modal — extract to a small util in `src/lib/twinsies.ts` for reuse).
- Render the partner names as links to their profile if the feed already links usernames (check existing pattern in feed page); otherwise plain text.

### 9. Types
**File**: `src/types/database.ts` — if `progress_detail` shape is typed anywhere specifically, add a `TwinsiesProgressDetail = { credited_events: string[] }` variant. Otherwise the existing `Json` type covers it.

## Critical files to modify

| File | Why |
|---|---|
| `supabase/migrations/0NN_twinsies_achievement.sql` (new) | Seed + backfill |
| `src/lib/achievements.ts` | Sync path in `evaluateAchievements()` |
| `src/app/api/achievements/reconcile-twinsies/route.ts` (new) | Deferred reconciliation endpoint |
| `src/app/(app)/layout.tsx` + new `TwinsiesReconciler.tsx` client component | Trigger deferred check on app open |
| `src/components/AchievementModal.tsx` | Show twin partner usernames on unlock |
| `src/app/(app)/roll/page.tsx` | Pass `twinPartners` from localStorage into modal |
| `src/app/(app)/feed/page.tsx` | Show twin partner inline next to 👯 badge on roll cards |
| `src/lib/twinsies.ts` (new) | Shared formatter for partner-list strings |
| `src/types/database.ts` | Optional: typed progress_detail |

## Reuse / patterns referenced

- Counter pattern: `src/lib/achievements.ts:197–204` (Malort Advent Calendar)
- AchievementModal consumption: `src/app/(app)/roll/page.tsx:112–123, 145–147`
- Service-role admin client: existing usage in `src/app/api/rolls/route.ts:72–75`
- Bar-night `roll_date`: `src/lib/dateUtils.ts:6–31` (already applied at roll insert — we just read the stored column)
- RLS: matching across users requires the service-role client; user session client can't read other users' rolls — that's why the reconciliation must be a server route, not a client query.

## Verification

1. **Migration**: run locally via `supabase db push`. Check `achievements` row exists and 7 expected users have `user_achievements` rows at `progress=1`.
2. **Sync path**: as user B, roll a combination user A already rolled on the same `roll_date`. Both should now have `progress` incremented (A via backfill or prior progress; B via sync path). If either crosses 2, expect `completed_at` set.
3. **Deferred path**: as user A, immediately after step 2 but before user A's next roll: open the app. `/api/achievements/reconcile-twinsies` fires. If A's progress hits 2, `AchievementModal` should appear on next `/roll` navigation. Verify `sessionStorage["twinsies_reconciled"]` set so it doesn't re-fire that session.
4. **Idempotency**: call the reconcile endpoint twice in a row — second call should be a no-op (no new entries to `credited_events`, no progress change).
5. **Achievements page**: confirm Twinsies card renders under "You're a Regular" 💎 with `x/2` progress bar.
6. **DB sanity**: re-run the analysis query from planning and confirm credited counts in `progress_detail` match the historical event counts (capped at 1 for pre-deploy events, growing afterward).
7. **Feed**: load `/feed` and verify any roll with a 👯 badge renders the twin partner's username next to it. Check both 2-user and synthetic 3-user cases.

## Out of scope (v1)

- Notifying via push / email
- A separate, distinct achievement for twinning with 3+ users at once (the existing one supports it, but no special tier)
- Adjusting the threshold (locked at 2)
- Showing partner names on the Achievements page card (only the unlock modal shows them)
