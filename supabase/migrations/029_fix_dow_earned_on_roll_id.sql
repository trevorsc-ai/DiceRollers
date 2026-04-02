-- Backfill earned_on_roll_id for all day-of-week achievements.
-- Migrations 022, 024, and 026 set completed_at but never set
-- earned_on_roll_id, so the feed/history skipped these achievements
-- entirely (the UI filters on earned_on_roll_id IS NOT NULL).
--
-- For each user × DOW achievement, link to the earliest roll on
-- the matching day of week (which is the same roll that set completed_at).

-- Sunday Funday (DOW = 0)
UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id FROM rolls r
  WHERE r.user_id = ua.user_id
    AND EXTRACT(DOW FROM r.roll_date) = 0
  ORDER BY r.roll_time ASC LIMIT 1
)
WHERE ua.achievement_id = 'sunday_funday'
  AND ua.earned_on_roll_id IS NULL;

-- Case of the Mondays (DOW = 1)
UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id FROM rolls r
  WHERE r.user_id = ua.user_id
    AND EXTRACT(DOW FROM r.roll_date) = 1
  ORDER BY r.roll_time ASC LIMIT 1
)
WHERE ua.achievement_id = 'case_of_the_mondays'
  AND ua.earned_on_roll_id IS NULL;

-- Taco Tuesday (DOW = 2)
UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id FROM rolls r
  WHERE r.user_id = ua.user_id
    AND EXTRACT(DOW FROM r.roll_date) = 2
  ORDER BY r.roll_time ASC LIMIT 1
)
WHERE ua.achievement_id = 'taco_tuesday'
  AND ua.earned_on_roll_id IS NULL;

-- Hump Day (DOW = 3)
UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id FROM rolls r
  WHERE r.user_id = ua.user_id
    AND EXTRACT(DOW FROM r.roll_date) = 3
  ORDER BY r.roll_time ASC LIMIT 1
)
WHERE ua.achievement_id = 'hump_day'
  AND ua.earned_on_roll_id IS NULL;

-- Trivia Thursday (DOW = 4)
UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id FROM rolls r
  WHERE r.user_id = ua.user_id
    AND EXTRACT(DOW FROM r.roll_date) = 4
  ORDER BY r.roll_time ASC LIMIT 1
)
WHERE ua.achievement_id = 'trivia_thursday'
  AND ua.earned_on_roll_id IS NULL;

-- Friday Night Lights (DOW = 5)
UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id FROM rolls r
  WHERE r.user_id = ua.user_id
    AND EXTRACT(DOW FROM r.roll_date) = 5
  ORDER BY r.roll_time ASC LIMIT 1
)
WHERE ua.achievement_id = 'friday_night_lights'
  AND ua.earned_on_roll_id IS NULL;

-- Saturday Night Fever (DOW = 6)
UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id FROM rolls r
  WHERE r.user_id = ua.user_id
    AND EXTRACT(DOW FROM r.roll_date) = 6
  ORDER BY r.roll_time ASC LIMIT 1
)
WHERE ua.achievement_id = 'saturday_night_fever'
  AND ua.earned_on_roll_id IS NULL;
