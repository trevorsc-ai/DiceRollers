-- Link each completed achievement to the roll that triggered it
ALTER TABLE user_achievements
  ADD COLUMN earned_on_roll_id INT REFERENCES rolls(id) ON DELETE SET NULL;

CREATE INDEX idx_user_achievements_roll ON user_achievements(earned_on_roll_id)
  WHERE earned_on_roll_id IS NOT NULL;

-- Backfill: link each completed achievement to the closest roll in time
UPDATE user_achievements ua
SET earned_on_roll_id = (
  SELECT r.id
  FROM rolls r
  WHERE r.user_id = ua.user_id
  ORDER BY ABS(EXTRACT(EPOCH FROM (r.roll_time - ua.completed_at)))
  LIMIT 1
)
WHERE ua.completed_at IS NOT NULL
  AND ua.earned_on_roll_id IS NULL;
