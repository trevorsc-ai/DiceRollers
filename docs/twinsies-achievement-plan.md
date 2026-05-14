# Plan: "Twinsies" 👯 Achievement (Repeatable)

## Context

First **cross-user** achievement in DiceRollers. Two users rolling the **same exact dice combination** (red die + white die) on the same `roll_date` (bar-night adjusted) constitutes a "twin event". Both users get credit. It lives in the **"You're a Regular" 💎** category.

**Repeatable**: `target_count = 1` — the achievement unlocks the first time a user has a twin, but the counter keeps incrementing on every subsequent twin event. The unlock modal pops **every** time (with a running count: "Twinsies #5!").

**Historical data**: 9 twin pair-events across 191 rolls / 38 rollers; 7 users have ≥1 historical event. All are backfilled retroactively with full counts; everyone with ≥1 is marked completed. **No modal pops for backfill** — it just appears as "already earned" on their achievements page.

**Tracker**: achievements page shows "Twinsies × N" with an expandable list of every event (date, partner username(s), dice combo).

**Feed**: every roll that is part of any twin event — past or future, viewer's own or not — gets a 👯 badge with partner username inline. The badge is derived at query time from `(roll_date, red, white)` matches across users, **independent** of the achievement's `earned_on_roll_id` (which only points at the user's first twin roll). So a user with 5 twins sees all 5 rolls badged in the feed, even though only 1 is the "earning" roll.

**Counting rules**:
- A *twin event* is unique per `(user_id, roll_date, red_die_number, white_die_number)`. Three users rolling the same combo on the same night → each user gets **+1 progress**, with the other two listed as partners on that single event.
- Cross-user only. A user rolling the same combo twice in one night does not twin with themselves.

## Implementation steps

### 1. Migration: seed achievement + backfill all historical events
**File**: `supabase/migrations/0NN_twinsies_achievement.sql`

```sql
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'twinsies', 'Twinsies', '👯',
  'Roll the same exact dice combo as another roller on the same night.',
  'youre_a_regular', 'You''re a Regular', '💎', 1, 35
)
ON CONFLICT (id) DO UPDATE SET
  name=EXCLUDED.name, emoji=EXCLUDED.emoji, description=EXCLUDED.description,
  target_count=EXCLUDED.target_count, sort_order=EXCLUDED.sort_order;

-- Backfill: every user with twin events gets full count + completed_at + full credited_events list
WITH twin_events AS (
  SELECT a.user_id, a.roll_date, a.red_die_number, a.white_die_number,
         MIN(a.id) AS first_roll_id,
         MIN(a.roll_time) AS first_time,
         ARRAY_AGG(DISTINCT p.username) AS partners
  FROM rolls a
  JOIN rolls b
    ON a.roll_date = b.roll_date
   AND a.red_die_number = b.red_die_number
   AND a.white_die_number = b.white_die_number
   AND a.user_id <> b.user_id
  JOIN profiles p ON p.id = b.user_id
  GROUP BY a.user_id, a.roll_date, a.red_die_number, a.white_die_number
),
per_user AS (
  SELECT user_id,
         COUNT(*) AS event_count,
         MIN(first_time) AS earliest_time,
         (ARRAY_AGG(first_roll_id ORDER BY first_time))[1] AS earliest_roll_id,
         jsonb_agg(
           jsonb_build_object(
             'key', roll_date::text || '|' || red_die_number || '|' || white_die_number,
             'roll_date', roll_date,
             'red', red_die_number,
             'white', white_die_number,
             'partners', to_jsonb(partners),
             'roll_id', first_roll_id
           ) ORDER BY first_time
         ) AS events
  FROM twin_events
  GROUP BY user_id
)
INSERT INTO user_achievements (user_id, achievement_id, progress, progress_detail, earned_on_roll_id, completed_at)
SELECT user_id, 'twinsies', event_count,
       jsonb_build_object('credited_events', events),
       earliest_roll_id,
       earliest_time
FROM per_user
ON CONFLICT (user_id, achievement_id) DO UPDATE
SET progress = EXCLUDED.progress,
    progress_detail = EXCLUDED.progress_detail,
    earned_on_roll_id = EXCLUDED.earned_on_roll_id,
    completed_at = EXCLUDED.completed_at;
```

After this runs: 7 users have `progress = N` (their actual historical count), `completed_at` set, and full event list. No modal pops because no entry in `localStorage["new_achievements"]` is written for backfill.

### 2. Sync path: extend `evaluateAchievements()`
**File**: `src/lib/achievements.ts`

Logic:
1. Build event key for the just-saved roll: `${roll.roll_date}|${roll.red_die_number}|${roll.white_die_number}`.
2. Find other users with same `(roll_date, red, white)`. Join `profiles` for usernames.
3. If no matches, exit.
4. Load existing `user_achievements` row. Read `progress_detail.credited_events`. If event key already credited, exit (dedupe).
5. Append `{key, roll_date, red, white, partners: [...usernames], roll_id: rollId}` to `credited_events`.
6. Increment `progress`. If `completed_at` is null, set it now and set `earned_on_roll_id = rollId`. (Subsequent increments don't touch `earned_on_roll_id`.)
7. **Always** return this as a "newly earned" entry to trigger the modal — the modal fires on every twin, not only on first unlock. Include `{ id: 'twinsies', twinPartners: [...], count: progress }` in the return payload.

New helper needed in `achievements.ts`: an upsert that writes `progress_detail` and is safe to call repeatedly. The existing `markComplete` / `updateCounter` helpers (`achievements.ts:83–155`) don't handle JSON merging — add `bumpTwinsies(userId, rollId, eventKey, partners)`.

Also: the sync path needs to credit the **other** user(s) too. When user B rolls and matches user A, only user B's row is touched by the sync path — user A is offline. **User A is handled by the deferred path (step 4)** on next app open.

### 3. Achievement payload: support count + partners
**File**: `src/lib/achievements.ts` (type def)

Extend `AchievementInfo` (or whatever the return type is named) with optional fields:
```ts
twinPartners?: string[]   // usernames involved in the unlocking event
twinCount?: number        // current total (e.g., 5 → modal says "Twinsies #5!")
```

These are only set for the `twinsies` achievement.

### 4. Deferred reconciliation: server route
**New file**: `src/app/api/achievements/reconcile-twinsies/route.ts`

- POST handler, auth required.
- Service-role Supabase client (cross-user reads).
- Query: all twin events for current user with partner usernames:
  ```sql
  SELECT a.roll_date, a.red_die_number, a.white_die_number,
         MIN(a.id) AS roll_id, MIN(a.roll_time) AS roll_time,
         ARRAY_AGG(DISTINCT p.username) AS partners
  FROM rolls a
  JOIN rolls b ON a.roll_date=b.roll_date AND a.red_die_number=b.red_die_number
              AND a.white_die_number=b.white_die_number AND a.user_id <> b.user_id
  JOIN profiles p ON p.id = b.user_id
  WHERE a.user_id = $user
  GROUP BY a.roll_date, a.red_die_number, a.white_die_number
  ORDER BY MIN(a.roll_time);
  ```
- Load `user_achievements.twinsies` for this user. Read `credited_events`.
- For each event not already credited (by key), append the event entry, increment `progress`, set `completed_at` and `earned_on_roll_id` if not already set.
- Collect the *newly credited* events. Return `{ newEvents: [{partners, count}, ...] }` — one entry per new event, each with the `count` value at the time it was credited (so the client can show "#3", "#4", "#5" sequentially if multiple piled up while away).
- Idempotent: second call within same session returns `{ newEvents: [] }`.

### 5. Wire deferred check into app layout
**File**: `src/app/(app)/layout.tsx` + new `src/components/TwinsiesReconciler.tsx` (client)

- Mount `<TwinsiesReconciler />` inside the authed layout.
- On mount, check `sessionStorage["twinsies_reconciled"]`. If absent:
  1. POST `/api/achievements/reconcile-twinsies`.
  2. Set sessionStorage flag.
  3. For each entry in `newEvents`, append to `localStorage["new_achievements"]`. Stack format: `[{ id: 'twinsies', twinPartners: [...], twinCount: N }, ...]`.
- Existing modal consumer (`roll/page.tsx:112–123`) dequeues and displays. If the queue has 3 entries, modal pops 3 times (existing behavior — verify during impl).

**Important**: backfill (step 1) does NOT write to `localStorage["new_achievements"]`, so a freshly-deployed user with existing twins will see their progress filled in silently. The reconcile route only flags events whose `key` isn't already in `credited_events`. Since backfill seeds ALL historical events, no modal fires until a new twin happens post-deploy.

### 6. Modal: show "Twinsies #N" + partners
**File**: `src/components/AchievementModal.tsx`

- Accept `twinCount` and `twinPartners` props (from the queued entry).
- For `twinsies`: render title as `"Twinsies #{twinCount}!"` (or `"Twinsies!"` if `twinCount === 1`, your call — defaulting to always showing the # for consistency).
- Render partner line: `with @user1` / `with @user1 & @user2` / `with @user1, @user2, and @user3` using a shared formatter.
- Other achievements unaffected.

### 7. Shared partner formatter
**New file**: `src/lib/twinsies.ts`

```ts
export function formatPartners(usernames: string[]): string {
  if (!usernames.length) return '';
  if (usernames.length === 1) return `@${usernames[0]}`;
  if (usernames.length === 2) return `@${usernames[0]} & @${usernames[1]}`;
  const last = usernames.at(-1)!;
  return usernames.slice(0, -1).map(u => `@${u}`).join(', ') + `, and @${last}`;
}
```

Used by modal, feed badge, and achievements-page tracker list.

### 8. Achievements page: count + expandable list
**File**: `src/app/(app)/achievements/page.tsx` (currently iterates achievements with progress bars around lines 336–353)

For the `twinsies` row, render a custom display:
- Header: `👯 Twinsies × N` (where N = `progress`, not the target).
- Click/tap toggles an expanded panel listing each event from `progress_detail.credited_events`, sorted newest-first. Each row: `{roll_date}` · 🔴`{red}` ⚪`{white}` · with `{formatPartners(partners)}`.
- Empty state (N=0): standard "not yet earned" treatment.

Use existing card styling — extend with a collapsible section (likely a `useState` open flag and conditional render). Keep the default progress bar suppressed for this achievement since the concept of "target" doesn't apply once past 1.

The achievement loader at this page already fetches `user_achievements` rows; ensure it also selects `progress_detail` (verify current select clause).

### 9. Feed: 👯 indicator on every twin roll (past + future, everyone)
**File**: `src/app/(app)/feed/page.tsx`

Decouple this from the achievement entirely — treat it as a *twin label* on rolls.

Derive twin status at query time via a SQL view or RPC `feed_with_twins(limit, offset)` (created in the migration from step 1, or a follow-up migration):

```sql
CREATE OR REPLACE VIEW rolls_with_twins AS
SELECT r.*,
       COALESCE(
         (SELECT ARRAY_AGG(DISTINCT p2.username ORDER BY p2.username)
          FROM rolls r2 JOIN profiles p2 ON p2.id = r2.user_id
          WHERE r2.roll_date = r.roll_date
            AND r2.red_die_number = r.red_die_number
            AND r2.white_die_number = r.white_die_number
            AND r2.user_id <> r.user_id),
         ARRAY[]::text[]
       ) AS twin_partners
FROM rolls r;
```

Feed page reads from this view (joined to `profiles` as it already does) and selects `twin_partners`. Add an index on `rolls(roll_date, red_die_number, white_die_number)` to keep the subselect cheap — also benefits the sync path and reconcile route.

Render: when `twin_partners.length > 0`, render `👯 with {formatPartners(twin_partners)}` next to the dice on the roll card. This is independent of whether that roll "earned" the achievement — every twin roll shows the badge, including the viewer's own.

Existing achievement-earned-on-roll badge logic stays as-is; the new 👯 indicator is a separate UI element (don't conflate with `earned_on_roll_id` badges, since after backfill only the *first* twin per user is the "earning" roll).

### 10. Types
**File**: `src/types/database.ts` — add optional typed shape for `progress_detail`:
```ts
export type TwinsiesProgressDetail = {
  credited_events: Array<{
    key: string;
    roll_date: string;
    red: number;
    white: number;
    partners: string[];
    roll_id: string;
  }>;
};
```

## Critical files to modify

| File | Why |
|---|---|
| `supabase/migrations/0NN_twinsies_achievement.sql` (new) | Seed + full backfill |
| `src/lib/achievements.ts` | Sync path + extend `AchievementInfo` |
| `src/lib/twinsies.ts` (new) | `formatPartners` helper |
| `src/app/api/achievements/reconcile-twinsies/route.ts` (new) | Deferred reconciliation |
| `src/app/(app)/layout.tsx` + `src/components/TwinsiesReconciler.tsx` (new) | Trigger reconciliation on app open |
| `src/components/AchievementModal.tsx` | "Twinsies #N!" + partner line |
| `src/app/(app)/roll/page.tsx` | Pass `twinCount` + `twinPartners` through modal queue |
| `src/app/(app)/achievements/page.tsx` | Count display + expandable list |
| `src/app/(app)/feed/page.tsx` | 👯 indicator on every twin roll |
| `src/types/database.ts` | Optional `TwinsiesProgressDetail` |

## Reuse / patterns referenced

- Modal queue consumption: `src/app/(app)/roll/page.tsx:112–123, 145–147`
- Service-role admin client: `src/app/api/rolls/route.ts:72–75`
- Bar-night `roll_date`: `src/lib/dateUtils.ts:6–31`
- Counter-style achievement (closest existing pattern): Malort Advent Calendar in `achievements.ts`
- Achievement card rendering: `src/app/(app)/achievements/page.tsx:336–353`

## Verification

1. **Migration**: `supabase db push` locally. Verify `achievements.twinsies` exists; 7 users have `user_achievements` rows with `progress = expected_historical_count`, `completed_at` set, and `progress_detail.credited_events` populated with full partner arrays.
2. **No backfill modal**: log in as a historical-twin user post-migration. Confirm **no** modal pops on next app open. Achievements page shows "Twinsies × N" already earned.
3. **Sync path**: as user B, roll a combo user A already rolled today. Modal pops for B saying "Twinsies #1!" (or "#N+1" if B had prior history). B's `credited_events` gets the new entry.
4. **Deferred path**: as user A (offline during step 3), open the app. Reconcile fires. Modal pops with "Twinsies #N!" for the matching event. Sub-pops if multiple events occurred while away.
5. **Idempotency**: refresh the page. `sessionStorage` flag prevents re-fire. Manually clear it and re-call — endpoint returns `newEvents: []`.
6. **Achievements page**: tap "Twinsies × N" → expanded panel lists every event with date, dice, partners. Verify ordering (newest first).
7. **Feed**: every roll card whose `(date, red, white)` matches another user displays `👯 with @partner`. Confirmed on both historical rolls and a freshly-rolled twin. Includes viewer's own rolls.
8. **Repeat modal**: trigger 3 distinct twins in one session — modal pops 3 times with incrementing counts.

## Out of scope (v1)

- Notifications outside the app (push/email)
- Realtime push to the partner (they see the modal next time they open the app, not the instant the twin happens)
- Toggleable "mute repeat twinsies" preference
- Refunding/decrementing progress if a roll is later deleted
- Backfilling `earned_on_roll_id` to point to the most recent twin (it stays at the first, which is fine — the achievement is still considered "earned" via `completed_at`)
