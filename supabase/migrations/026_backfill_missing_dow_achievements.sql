-- Backfill day-of-week achievements that were never awarded by the live code.
-- The runtime check in achievements.ts was missing case_of_the_mondays (DOW=1),
-- hump_day (DOW=3), friday_night_lights (DOW=5), and saturday_night_fever (DOW=6).
-- Any roll on those days after migration 024 ran was silently skipped.
-- These upserts are idempotent and safe to re-run.

-- Case of the Mondays (DOW = 1)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'case_of_the_mondays', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 1
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
