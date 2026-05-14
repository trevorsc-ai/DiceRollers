-- ============================================================
-- Add cycle_roll_count to user_achievements
-- Tracks the total number of rolls made in the current punch
-- card cycle (including rolls that don't add new unique hits).
-- Reset to 0 on completion; incremented on every roll.
-- ============================================================

ALTER TABLE public.user_achievements
  ADD COLUMN cycle_roll_count INT NOT NULL DEFAULT 0;

-- Backfill: count rolls since each user's cycle_started_at
-- (or epoch for first-cycle users who have never completed).
UPDATE user_achievements ua
SET cycle_roll_count = (
  SELECT COUNT(*)
  FROM rolls r
  WHERE r.user_id = ua.user_id
    AND r.roll_time > COALESCE(ua.cycle_started_at, '1970-01-01'::timestamptz)
)
WHERE ua.achievement_id = 'the_punch_card'
  AND ua.cycle_roll_count = 0;
