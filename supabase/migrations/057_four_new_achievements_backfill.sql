-- Backfill four new achievements against historical rolls.
-- Each block identifies the user's FIRST qualifying triggering roll, then
-- upserts a completed row keyed on (user_id, achievement_id).

-- ────────────────────────────────────────────────────────────────────
-- common_man: first roll where red_drink_name='High Life' AND white_drink_name='Jim Beam'
-- ────────────────────────────────────────────────────────────────────
WITH first_match AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    id AS roll_id,
    roll_time
  FROM rolls
  WHERE red_drink_name = 'High Life'
    AND white_drink_name = 'Jim Beam'
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'common_man', 1, roll_time, roll_id
FROM first_match
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────
-- fire_and_ice: same night has Hot Hooch AND Rumple Minze.
-- Triggering roll = the later of the two earliest occurrences on the
-- first qualifying night per user.
-- ────────────────────────────────────────────────────────────────────
WITH fi_rolls AS (
  SELECT user_id, id, roll_date, roll_time, white_drink_name
  FROM rolls
  WHERE white_drink_name IN ('Hot Hooch', 'Rumple Minze')
),
night_summary AS (
  SELECT
    user_id,
    roll_date,
    MIN(roll_time) FILTER (WHERE white_drink_name = 'Hot Hooch')      AS first_hooch,
    MIN(roll_time) FILTER (WHERE white_drink_name = 'Rumple Minze')   AS first_rumple
  FROM fi_rolls
  GROUP BY user_id, roll_date
),
qualifying_nights AS (
  SELECT
    user_id,
    roll_date,
    GREATEST(first_hooch, first_rumple) AS trigger_time
  FROM night_summary
  WHERE first_hooch IS NOT NULL AND first_rumple IS NOT NULL
),
trigger_rolls AS (
  SELECT
    qn.user_id,
    qn.roll_date,
    qn.trigger_time,
    fi.id AS roll_id
  FROM qualifying_nights qn
  JOIN fi_rolls fi
    ON fi.user_id   = qn.user_id
   AND fi.roll_date = qn.roll_date
   AND fi.roll_time = qn.trigger_time
),
first_per_user AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    roll_id,
    trigger_time AS roll_time
  FROM trigger_rolls
  ORDER BY user_id, trigger_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'fire_and_ice', 1, roll_time, roll_id
FROM first_per_user
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────
-- mark_of_the_devil: 3+ total 6s across both dies in one night.
-- Per row: sixes_count = (red=6)::int + (white=6)::int (double-six = 2).
-- Triggering roll = first row whose running cumulative reaches >= 3.
-- ────────────────────────────────────────────────────────────────────
WITH sixes_per_roll AS (
  SELECT
    user_id,
    id,
    roll_date,
    roll_time,
    ((red_die_number = 6)::int + (white_die_number = 6)::int) AS sixes_count
  FROM rolls
  WHERE red_die_number = 6 OR white_die_number = 6
),
running AS (
  SELECT
    user_id,
    id,
    roll_date,
    roll_time,
    SUM(sixes_count) OVER (
      PARTITION BY user_id, roll_date
      ORDER BY roll_time
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS cum_sixes
  FROM sixes_per_roll
),
night_triggers AS (
  SELECT DISTINCT ON (user_id, roll_date)
    user_id,
    roll_date,
    id AS roll_id,
    roll_time
  FROM running
  WHERE cum_sixes >= 3
  ORDER BY user_id, roll_date, roll_time ASC
),
first_per_user AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    roll_id,
    roll_time
  FROM night_triggers
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'mark_of_the_devil', 1, roll_time, roll_id
FROM first_per_user
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();

-- ────────────────────────────────────────────────────────────────────
-- shot_roulette: across rolls with white_die_number=7, accumulate 3 distinct
-- white_drink_name values. Triggering roll = the roll where the 3rd distinct
-- name FIRST appears for that user.
-- ────────────────────────────────────────────────────────────────────
WITH whites_7 AS (
  SELECT user_id, id, roll_time, white_drink_name
  FROM rolls
  WHERE white_die_number = 7
),
first_occurrence_per_name AS (
  -- For each (user_id, white_drink_name), the earliest roll
  SELECT DISTINCT ON (user_id, white_drink_name)
    user_id,
    white_drink_name,
    id AS roll_id,
    roll_time
  FROM whites_7
  ORDER BY user_id, white_drink_name, roll_time ASC
),
ordered_firsts AS (
  SELECT
    user_id,
    white_drink_name,
    roll_id,
    roll_time,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY roll_time ASC) AS distinct_rn
  FROM first_occurrence_per_name
),
third_distinct AS (
  SELECT user_id, roll_id, roll_time
  FROM ordered_firsts
  WHERE distinct_rn = 3
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'shot_roulette', 1, roll_time, roll_id
FROM third_distinct
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress          = 1,
      completed_at      = EXCLUDED.completed_at,
      earned_on_roll_id = EXCLUDED.earned_on_roll_id,
      updated_at        = NOW();
