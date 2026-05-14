-- ============================================================
-- Twinsies 👯 achievement (repeatable, cross-user)
--
-- Two users rolling the same exact (red, white) dice combo on the
-- same roll_date (bar-night adjusted) constitutes a "twin event".
-- Both users get +1 progress, with the other user(s) recorded as
-- partners on that event.
--
-- This migration:
--   1. Seeds the achievement row (target_count=1: unlocks on first twin).
--   2. Backfills every user's progress + credited_events list from
--      all historical twin events. `completed_at` and `earned_on_roll_id`
--      are set to the user's earliest qualifying roll.
--   3. Creates a `rolls_with_twins` view that derives twin_partners
--      per roll at query time. The feed reads from this view.
--   4. Adds an index on (roll_date, red_die_number, white_die_number)
--      to keep the cross-user join cheap.
-- ============================================================

-- 1. Seed
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'twinsies', 'Twinsies', '👯',
  'Roll the same exact dice combo as another roller on the same night.',
  'youre_a_regular', 'You''re a Regular', '💎', 1, 46
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  emoji = EXCLUDED.emoji,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  category_name = EXCLUDED.category_name,
  category_emoji = EXCLUDED.category_emoji,
  target_count = EXCLUDED.target_count,
  sort_order = EXCLUDED.sort_order;

-- 2. Supporting index (used by backfill, sync path, reconcile route, view)
CREATE INDEX IF NOT EXISTS idx_rolls_twin_lookup
  ON rolls(roll_date, red_die_number, white_die_number);

-- 3. Backfill: credit every user with every historical twin event
WITH twin_events AS (
  SELECT
    a.user_id,
    a.roll_date,
    a.red_die_number,
    a.white_die_number,
    MIN(a.id) AS first_roll_id,
    MIN(a.roll_time) AS first_time,
    ARRAY_AGG(DISTINCT p.username ORDER BY p.username) AS partners
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
  SELECT
    user_id,
    COUNT(*)::int AS event_count,
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
INSERT INTO user_achievements (
  user_id, achievement_id, progress, progress_detail, earned_on_roll_id, completed_at, updated_at
)
SELECT
  user_id,
  'twinsies',
  event_count,
  jsonb_build_object('credited_events', events),
  earliest_roll_id,
  earliest_time,
  NOW()
FROM per_user
ON CONFLICT (user_id, achievement_id) DO UPDATE
SET progress = EXCLUDED.progress,
    progress_detail = EXCLUDED.progress_detail,
    earned_on_roll_id = EXCLUDED.earned_on_roll_id,
    completed_at = EXCLUDED.completed_at,
    updated_at = NOW();

-- 4. View used by the feed to badge every twin roll
CREATE OR REPLACE VIEW rolls_with_twins
WITH (security_invoker = true) AS
SELECT
  r.*,
  COALESCE(
    (
      SELECT ARRAY_AGG(DISTINCT p2.username ORDER BY p2.username)
      FROM rolls r2
      JOIN profiles p2 ON p2.id = r2.user_id
      WHERE r2.roll_date = r.roll_date
        AND r2.red_die_number = r.red_die_number
        AND r2.white_die_number = r.white_die_number
        AND r2.user_id <> r.user_id
    ),
    ARRAY[]::text[]
  ) AS twin_partners
FROM rolls r;

-- Allow authenticated clients to read the view (RLS on rolls still applies)
GRANT SELECT ON rolls_with_twins TO authenticated;
