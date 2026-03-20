---
planStatus:
  planId: plan-achievements-daily-double-datetime
  title: "Achievements, Daily Double & Date/Time Convention"
  status: draft
  planType: feature
  priority: high
  owner: travis
  stakeholders: []
  tags: [achievements, daily-double, datetime, leaderboard]
  created: "2026-03-20"
  updated: "2026-03-20T18:45:00.000Z"
  progress: 0
---

# PRD: Achievements, Daily Double & Date/Time Convention

## Overview

Three enhancements to Jackie Lee's Dice Roll Tracker:

1. **Achievements System** - 17 trackable achievements across 5 categories, with emoji flair on leaderboard
2. **Daily Double** - Opt-in alternative drinks when rolling doubles
3. **Date/Time Convention** - Redefine a "day" as 5pm-4am to match bar night reality

---

## Feature 1: Achievements System

### Concept

Users earn achievements based on their roll history. Each achievement awards an emoji that displays as "flair" next to their username on the leaderboard. A dedicated achievements page (new bottom nav tab) shows progress across all categories.

### Achievement Definitions

#### You're a Regular :gem:

| Achievement | Emoji | Trigger | Progress Tracker |
|---|---|---|---|
| Malort Advent Calendar | :calendar: | Roll Malort (white=6) 25 times | Counter: X/25 |
| The Punch Card | :ticket: | Roll each number 1-8 on BOTH dice | Checklist: red 1-8 + white 1-8 (16 slots) |
| Double Trouble | :smiling_imp: | Roll all 8 unique doubles (1-1 through 8-8) | Counter: X/8 unique doubles |
| Around the World | :earth_americas: | Roll all 64 unique die combinations (8x8) | Counter: X/64 unique combos |

#### The Craps Table :slot_machine:

| Achievement | Emoji | Trigger | Progress Tracker |
|---|---|---|---|
| Feeling Lucky | :four_leaf_clover: | Roll doubles twice in a row | One-time unlock |
| On Fire | :fire: | Roll doubles three times in a row | One-time unlock |
| Deja Vu | :crystal_ball: | Roll the exact same combo (red+white) twice in the same night | One-time unlock |

#### Special Combinations :people_with_bunny_ears:

All require both drinks in a **single roll**. Achievements are matched by **drink name** (stored in each roll record), not die number. This means:
- If a drink is swapped off the menu, the achievement stays locked to the original drink names and can't be earned until that drink returns.
- Historical rolls that had the correct drink names still count for backfill.

| Achievement | Emoji | Beer (red die) | Shot (white die) | Current Die Combo |
|---|---|---|---|---|
| HIGH ABV | :woozy_face: | Raging Bitch | Rumple Minze | red=1, white=3 |
| The Freshman | :notebook: | Whiteclaw | Espolon | red=4, white=5 |
| Chicago Charcuterie | :hot_dog: | High Life | Malort | red=8, white=6 |
| The Regular | :call_me_hand: | Mickeys | Malort | red=6, white=6 (doubles!) |

> **Note:** "The Regular" (Mickeys + Malort) is also a doubles roll (red=6, white=6).

#### Clocking In :alarm_clock:

| Achievement | Emoji | Trigger | Progress Tracker |
|---|---|---|---|
| Early Bird | :bird: | Roll between 5:00-5:59pm | One-time unlock |
| Night Owl | :owl: | Roll between 1:00-3:59am | One-time unlock |

#### Danger Zone :warning:

| Achievement | Emoji | Trigger | Progress Tracker |
|---|---|---|---|
| Run It Back | :person_running: | Roll twice in one night (5pm-4am window) | One-time unlock |
| Power Hour | :hourglass_flowing_sand: | Roll twice within 60 minutes | One-time unlock |
| Slow Down | :face_with_spiral_eyes: | Roll three times within 60 minutes | One-time unlock |

### Database Schema

#### New Table: `achievements`

Reference table defining all available achievements.

```sql
CREATE TABLE public.achievements (
  id TEXT PRIMARY KEY,              -- e.g. 'malort_advent_calendar'
  name TEXT NOT NULL,               -- 'Malort Advent Calendar'
  emoji TEXT NOT NULL,              -- '📅'
  description TEXT NOT NULL,        -- 'Get Malort 25 times'
  category TEXT NOT NULL,           -- 'youre_a_regular'
  category_name TEXT NOT NULL,      -- "You're a Regular"
  category_emoji TEXT NOT NULL,     -- '💎'
  target_count INT,                 -- 25 (null for one-time unlocks)
  sort_order INT NOT NULL DEFAULT 0 -- display ordering
);
```

#### New Table: `user_achievements`

Tracks each user's progress and completion.

```sql
CREATE TABLE public.user_achievements (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  progress INT NOT NULL DEFAULT 0,       -- current count toward target
  progress_detail JSONB,                 -- e.g. {"numbers_hit": [1,3,5]} for Punch Card
  completed_at TIMESTAMPTZ,              -- null = in progress, set = earned
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, achievement_id)
);

-- Index for fast lookups
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_completed ON user_achievements(user_id, completed_at) WHERE completed_at IS NOT NULL;
```

#### RLS Policies

```sql
-- Users can read their own + other users' completed achievements (for leaderboard flair)
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own achievements"
  ON user_achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view others completed achievements"
  ON user_achievements FOR SELECT
  USING (completed_at IS NOT NULL);

-- Only server/functions can insert/update (triggered by roll saves)
CREATE POLICY "Service role manages achievements"
  ON user_achievements FOR ALL
  USING (auth.role() = 'service_role');
```

### Achievement Evaluation Logic

Achievements are evaluated **server-side** after each roll is saved. A Supabase database function or edge function processes the new roll against all achievement criteria.

#### Evaluation Function: `evaluate_achievements(p_user_id UUID, p_roll_id INT)`

Called after every `INSERT INTO rolls`. Checks each achievement category:

1. **You're a Regular** - Query aggregates over all user rolls
   - Malort: `COUNT(*) WHERE white_die_number = 6`
   - Punch Card: `DISTINCT red_die_number` + `DISTINCT white_die_number`
   - Double Trouble: `COUNT(DISTINCT red_die_number) WHERE is_doubles`
   - Around the World: `COUNT(DISTINCT (red_die_number, white_die_number))`

2. **Craps Table** - Query recent consecutive rolls
   - Feeling Lucky / On Fire: Check last 2-3 rolls by `roll_time` for consecutive doubles
   - Deja Vu: Check if same `(red_die_number, white_die_number)` exists in same night (adjusted date)

3. **Special Combinations** - Check current roll's drink names
   - Direct comparison: `red_drink_name = 'X' AND white_drink_name = 'Y'`
   - Matched by drink name (not die number) so achievements persist across menu changes

4. **Clocking In** - Check current roll's time
   - Extract hour from `roll_time` in `America/New_York` timezone (handles DST)

5. **Danger Zone** - Check roll frequency
   - Count rolls in same adjusted-date night
   - Count rolls within 60 min window of current roll

#### Backfill Migration

A one-time migration script replays all existing rolls to populate `user_achievements` for existing users:

```sql
-- Pseudocode for backfill
FOR each user:
  FOR each roll (ordered by roll_time ASC):
    CALL evaluate_achievements(user_id, roll_id)
```

This ensures existing users see accurate progress immediately.

### Achievements Page (`/achievements`)

New page accessible via bottom nav (Trophy icon).

**Layout:**
- Grouped by category with category emoji headers
- Each achievement shows:
  - Emoji (greyed out if locked, full color if earned)
  - Name and description
  - Progress bar or counter (e.g. "12/25" for Malort Advent Calendar)
  - Checkmark/completion date if earned
  - For Punch Card: grid showing which numbers are hit/remaining per die
  - For Double Trouble: grid showing which doubles are hit/remaining
  - For Around the World: "X/64" counter with optional grid view

**Bottom Nav Update:**
- Add Trophy icon (`Trophy` from lucide-react) between Stats and Feed
- 6 tabs total: Roll | History | Stats | Achievements | Feed | Profile
- Show notification dot when new achievement earned (stored in localStorage)

### Leaderboard Flair

The leaderboard on the global stats page updates to show earned achievement emojis:

- **Always show top 10 users** (currently limited to 10 via SQL, keep this)
- After username, display all earned achievement emojis in a row
- Emojis ordered by category sort order
- Update `get_global_stats()` RPC to join `user_achievements` for completed emojis

**Example leaderboard row:**
```
🏆 JackieLee  (42 rolls)  📅🎟️😈🍀🥴🌭
   BeerBro    (38 rolls)  📅🔥
🥉 DiceQueen  (35 rolls)  🦉🏃
```

### Achievement Celebration

When a user earns a new achievement:
1. **Immediate modal** on the roll page after saving - shows the achievement emoji large, name, and description with confetti/celebration animation (reuse existing confetti component)
2. **Notification dot** on the Achievements nav tab (cleared on visit)

---

## Feature 2: Daily Double

### Concept

When a user rolls doubles, they get the option to substitute their rolled drinks with the "Daily Double" drinks: **Old Time Lager** (beer) + **Tullamore Dew** (shot). This is an opt-in choice, not automatic.

### UX Flow

1. User rolls doubles → existing confetti celebration plays
2. Below the doubles celebration, show a checkbox/toggle: **"Take the Daily Double instead?"**
3. Display the Daily Double drinks with their logos (Old Time Lager + Tullamore Dew)
4. If checked, the roll is saved with `daily_double = true` flag
5. The original die numbers are preserved (for achievement tracking) but the drink names/logos reflect the Daily Double choice

### Database Changes

#### `rolls` table - Add column

```sql
ALTER TABLE rolls ADD COLUMN daily_double BOOLEAN DEFAULT false;
```

When `daily_double = true`:
- `red_drink_name` / `red_drink_logo` = Daily Double beer (Old Time Lager)
- `white_drink_name` / `white_drink_logo` = Daily Double shot (Tullamore Dew)
- `red_die_number` / `white_die_number` = original rolled numbers (unchanged)
- `is_doubles` = true (still computed from die numbers)

#### `menu_items` table - Add Daily Double items

```sql
INSERT INTO menu_items (die_color, die_number, drink_name, is_active)
VALUES
  ('daily_double', 1, 'Old Time Lager', true),
  ('daily_double', 2, 'Tullamore Dew', true);
```

Using `die_color = 'daily_double'` to separate from regular menu items. Admins can edit name/logo in the menu editor just like other drinks.

### Admin Menu Editor

Add a "Daily Double" section below the existing Red/White sections in `/admin/menu`:
- Shows 2 items: the Daily Double beer and shot
- Same edit capabilities: change name, upload logo
- Clearly labeled as the doubles substitution drinks

### Achievement Interaction

Daily Double rolls **still count as doubles** for all achievement tracking (Double Trouble, Feeling Lucky, On Fire, etc.). The `is_doubles` computed column is based on die numbers which remain unchanged.

---

## Feature 3: Date/Time Convention

### Concept

Redefine a "day" within the app as **5:00 PM to 4:59 AM** (the next calendar day). A roll at 2am on March 21st belongs to the March 20th "night." Rolls between midnight and 4:59am are attributed to the previous calendar date.

### Implementation

#### `roll_date` Storage Change

The `roll_date` field should store the **adjusted date** (the "night" the roll belongs to):

- Roll at 9pm on March 20 → `roll_date = 2026-03-20`
- Roll at 2am on March 21 → `roll_date = 2026-03-20` (same night)
- Roll at 5pm on March 21 → `roll_date = 2026-03-21` (new night starts)
- Roll at 4:30am on March 21 → edge case: 4:00-4:59am is a gap. Treat as previous night: `roll_date = 2026-03-20`

#### Adjustment Logic

```typescript
function getAdjustedRollDate(timestamp: Date): string {
  const hour = timestamp.getHours();
  // If between midnight and 4:59am, subtract one day
  if (hour < 5) {
    const adjusted = new Date(timestamp);
    adjusted.setDate(adjusted.getDate() - 1);
    return adjusted.toLocaleDateString("en-CA"); // YYYY-MM-DD
  }
  return timestamp.toLocaleDateString("en-CA");
}
```

#### Affected Areas

1. **Roll creation** (`/roll/page.tsx`): Send adjusted `roll_date` when saving
2. **History page**: Date filters and grouping use `roll_date` (no change needed since dates are already adjusted)
3. **Stats page**: Streak calculation, day-of-week histogram remain based on `roll_date`
4. **Achievements**: "Same night" checks for Deja Vu, Run It Back, etc. use `roll_date`
5. **Early Bird / Night Owl**: Use `roll_time` (actual timestamp), not adjusted date

#### Backfill Migration

Update existing `roll_date` values for rolls made between midnight and 4:59am:

```sql
UPDATE rolls
SET roll_date = (roll_time AT TIME ZONE 'America/New_York')::date - INTERVAL '1 day'
WHERE EXTRACT(HOUR FROM roll_time AT TIME ZONE 'America/New_York') < 5;
```

> **Timezone:** `America/New_York` (Washington DC). This handles Eastern Standard Time and Eastern Daylight Time automatically.

---

## Implementation Plan

### Phase 1: Date/Time Convention
**Do this first** since it affects how achievements calculate "same night."

1. Add `getAdjustedRollDate()` utility function
2. Update roll save logic to use adjusted date
3. Backfill migration for existing rolls
4. Verify history/stats pages still work correctly

### Phase 2: Daily Double
1. Add `daily_double` column to `rolls` table
2. Add Daily Double menu items (`die_color = 'daily_double'`)
3. Update roll page UI: show Daily Double opt-in on doubles
4. Update admin menu editor with Daily Double section
5. Update feed/history display to show Daily Double indicator

### Phase 3: Achievements System
1. Create `achievements` + `user_achievements` tables with seed data
2. Build `evaluate_achievements()` database function
3. Run backfill migration for existing users
4. Build `/achievements` page with progress tracking UI
5. Add Trophy tab to bottom nav with notification dot
6. Build achievement celebration modal
7. Update leaderboard to show earned emoji flair
8. Update `get_global_stats()` RPC to include flair data

### Migration Files Needed

```
007_datetime_convention.sql        -- Backfill roll_date for early AM rolls
008_daily_double.sql               -- Add daily_double column + menu items
009_achievements_schema.sql        -- Create achievements + user_achievements tables
010_achievements_seed.sql          -- Seed all 17 achievement definitions
011_achievements_backfill.sql      -- Backfill progress for existing users
012_leaderboard_flair.sql          -- Update get_global_stats() to include flair
```

---

## Resolved Decisions

1. **Timezone:** `America/New_York` (Washington DC, handles DST automatically)
2. **The Freshman:** Espolon (white=5) + Whiteclaw (red=4) — corrected from seed data based on live menu
3. **Menu changes:** Special Combination achievements are locked to **original drink names**. If a drink is removed from the menu, the achievement becomes dormant (can't be earned) but historical rolls still count. Achievements match on `red_drink_name` / `white_drink_name` in the rolls table, not die numbers.
4. **4:00-4:59am:** Belongs to the previous night. A "night" runs from 5:00 PM to 4:59 AM. Any roll with hour < 5 gets `roll_date` set to the previous calendar date.

## Current Menu Reference (as of 2026-03-20)

| Die # | Red (Beer) | White (Shot) |
|---|---|---|
| 1 | Raging Bitch | Jim Beam |
| 2 | Duck Pin | Amaras Mezcal |
| 3 | District Commons | Rumple Minze |
| 4 | Whiteclaw | Jaegermeister |
| 5 | Fresh Cut | Espolon |
| 6 | Mickeys | Malort |
| 7 | Sea Quench | Bacardi Lime |
| 8 | High Life | Hot Hooch |
