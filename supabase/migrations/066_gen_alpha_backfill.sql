-- Backfill gen_alpha achievement against historical rolls.
-- Triggering roll = each user's first roll where red_die_number=6 AND white_die_number=7.

WITH first_match AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    id AS roll_id,
    roll_time
  FROM rolls
  WHERE red_die_number = 6
    AND white_die_number = 7
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'gen_alpha', 1, roll_time, roll_id
FROM first_match
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();
