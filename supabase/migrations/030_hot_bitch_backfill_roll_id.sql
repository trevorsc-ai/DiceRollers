-- Backfill earned_on_roll_id for the hot_bitch achievement.
-- Migration 027 set completed_at but not earned_on_roll_id, so the
-- feed skips the badge (it filters on earned_on_roll_id IS NOT NULL).
-- Links each user's award to their earliest Raging Bitch + Hot Hooch roll.

UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id FROM rolls r
  WHERE r.user_id = ua.user_id
    AND r.red_drink_name = 'Raging Bitch'
    AND r.white_drink_name = 'Hot Hooch'
  ORDER BY r.roll_time ASC LIMIT 1
)
WHERE ua.achievement_id = 'hot_bitch'
  AND ua.earned_on_roll_id IS NULL;
