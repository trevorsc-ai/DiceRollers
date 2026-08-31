-- Backfill dyslexic_deja_vu against historical rolls.
-- Triggering roll = the second roll of the first back-to-back combo+inverse
-- pair per user (the roll that would have completed it live). Doubles are
-- excluded on both sides of the pair.

WITH ordered AS (
  SELECT
    id,
    user_id,
    roll_date,
    roll_time,
    red_die_number,
    white_die_number,
    is_doubles,
    LAG(red_die_number)   OVER w AS prev_red,
    LAG(white_die_number) OVER w AS prev_white,
    LAG(is_doubles)       OVER w AS prev_is_doubles
  FROM rolls
  WINDOW w AS (PARTITION BY user_id, roll_date ORDER BY roll_time, id)
),
matches AS (
  SELECT user_id, id AS roll_id, roll_time
  FROM ordered
  WHERE prev_red IS NOT NULL
    AND NOT is_doubles
    AND NOT prev_is_doubles
    AND red_die_number = prev_white
    AND white_die_number = prev_red
),
first_per_user AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    roll_id,
    roll_time
  FROM matches
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'dyslexic_deja_vu', 1, roll_time, roll_id
FROM first_per_user
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();
