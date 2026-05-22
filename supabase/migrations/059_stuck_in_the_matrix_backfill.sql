-- Backfill stuck_in_the_matrix against historical rolls.
-- Triggering roll = the 3rd occurrence of a given combo within a single night
-- (earliest qualifying roll per user).

WITH combo_rolls AS (
  SELECT
    user_id,
    id,
    roll_date,
    roll_time,
    red_die_number,
    white_die_number,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, roll_date, red_die_number, white_die_number
      ORDER BY roll_time ASC
    ) AS combo_seq
  FROM rolls
),
third_occurrence_per_night AS (
  SELECT DISTINCT ON (user_id, roll_date)
    user_id,
    roll_date,
    id AS roll_id,
    roll_time
  FROM combo_rolls
  WHERE combo_seq >= 3
  ORDER BY user_id, roll_date, roll_time ASC
),
first_per_user AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    roll_id,
    roll_time
  FROM third_occurrence_per_night
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'stuck_in_the_matrix', 1, roll_time, roll_id
FROM first_per_user
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();
