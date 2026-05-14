-- Update On Fire: 3 doubles in a night (was: 3 consecutive doubles)
-- Update Hot Dice: 2 doubles in a night (was: 3 doubles in a night)

UPDATE achievements SET description = 'Roll three doubles in a single night' WHERE id = 'on_fire';
UPDATE achievements SET description = 'Roll two doubles in a single night' WHERE id = 'hot_dice';

-- Backfill Hot Dice: earliest night each user rolled 2+ doubles
WITH doubles_per_night AS (
  SELECT
    user_id,
    roll_date,
    (array_agg(id ORDER BY roll_time))[2]         AS trigger_roll_id,
    (array_agg(roll_time ORDER BY roll_time))[2]   AS trigger_time
  FROM rolls
  WHERE is_doubles = true
  GROUP BY user_id, roll_date
  HAVING COUNT(*) >= 2
),
first_qualifying AS (
  SELECT DISTINCT ON (user_id) user_id, trigger_roll_id, trigger_time
  FROM doubles_per_night
  ORDER BY user_id, roll_date ASC
)
INSERT INTO user_achievements (user_id, achievement_id, completed_at, earned_on_roll_id)
SELECT user_id, 'hot_dice', trigger_time, trigger_roll_id
FROM first_qualifying
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Backfill On Fire: earliest night each user rolled 3+ doubles
WITH doubles_per_night AS (
  SELECT
    user_id,
    roll_date,
    (array_agg(id ORDER BY roll_time))[3]         AS trigger_roll_id,
    (array_agg(roll_time ORDER BY roll_time))[3]   AS trigger_time
  FROM rolls
  WHERE is_doubles = true
  GROUP BY user_id, roll_date
  HAVING COUNT(*) >= 3
),
first_qualifying AS (
  SELECT DISTINCT ON (user_id) user_id, trigger_roll_id, trigger_time
  FROM doubles_per_night
  ORDER BY user_id, roll_date ASC
)
INSERT INTO user_achievements (user_id, achievement_id, completed_at, earned_on_roll_id)
SELECT user_id, 'on_fire', trigger_time, trigger_roll_id
FROM first_qualifying
ON CONFLICT (user_id, achievement_id) DO NOTHING;
