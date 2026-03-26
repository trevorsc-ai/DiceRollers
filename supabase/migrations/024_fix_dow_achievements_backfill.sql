-- Fix all day-of-week achievement backfills to use roll_date instead of roll_time.
-- Also adds missing backfills for sunday_funday, taco_tuesday, trivia_thursday
-- which were inserted in 021 without any backfill.
--
-- EXTRACT(DOW FROM roll_date) matches JS getDay(): 0=Sun, 1=Mon, …, 6=Sat

-- Sunday Funday (DOW = 0)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'sunday_funday', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 0
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Case of the Mondays (DOW = 1)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'case_of_the_mondays', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 1
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Taco Tuesday (DOW = 2)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'taco_tuesday', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 2
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Hump Day (DOW = 3)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'hump_day', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 3
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Trivia Thursday (DOW = 4)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'trivia_thursday', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 4
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Friday Night Lights (DOW = 5)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'friday_night_lights', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 5
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Saturday Night Fever (DOW = 6)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'saturday_night_fever', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 6
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();
