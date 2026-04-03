-- Rename Malort Three-Peat → Malort Again! and lower threshold to 2 Malorts in one night

UPDATE achievements
SET
  name        = 'Malort Again!',
  description = 'Roll Malort twice in one night'
WHERE id = 'malort_three_peat';

-- Backfill: award to any user who has rolled Malort 2+ times in one night but
-- hasn't earned this achievement yet.  The earning roll is the 2nd Malort of
-- their first qualifying night.

WITH ranked_malort AS (
  SELECT
    user_id,
    roll_date,
    id,
    roll_time,
    ROW_NUMBER() OVER (PARTITION BY user_id, roll_date ORDER BY roll_time) AS rn,
    COUNT(*)    OVER (PARTITION BY user_id, roll_date)                     AS night_count
  FROM rolls
  WHERE white_die_number = 6
),
qualifying_seconds AS (
  SELECT user_id, id AS roll_id, roll_time
  FROM ranked_malort
  WHERE rn = 2 AND night_count >= 2
),
first_qualifying AS (
  SELECT DISTINCT ON (user_id) user_id, roll_id, roll_time
  FROM qualifying_seconds
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'malort_three_peat', 1, roll_time, roll_id
FROM first_qualifying
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();
