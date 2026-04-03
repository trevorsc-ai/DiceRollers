-- Add the Dragon's Breath achievement (Hot Hooch twice in one night)

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'dragons_breath', 'Dragon''s Breath', '🐉',
  'Get Hot Hooch twice in one night',
  'danger_zone', 'Danger Zone', '⚠️', NULL, 165
);

-- Backfill: award to any user who has already gotten Hot Hooch twice in one night.
-- The earning roll is the 2nd Hot Hooch of their first qualifying night.

WITH ranked_hooch AS (
  SELECT
    user_id,
    roll_date,
    id,
    roll_time,
    ROW_NUMBER() OVER (PARTITION BY user_id, roll_date ORDER BY roll_time) AS rn,
    COUNT(*)    OVER (PARTITION BY user_id, roll_date)                     AS night_count
  FROM rolls
  WHERE white_drink_name = 'Hot Hooch'
),
qualifying_seconds AS (
  SELECT user_id, id AS roll_id, roll_time
  FROM ranked_hooch
  WHERE rn = 2 AND night_count >= 2
),
first_qualifying AS (
  SELECT DISTINCT ON (user_id) user_id, roll_id, roll_time
  FROM qualifying_seconds
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'dragons_breath', 1, roll_time, roll_id
FROM first_qualifying
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();
