-- ============================================================
-- Add cycle_roll_count to user_achievements
-- Tracks the total number of rolls made in the current punch
-- card cycle (including rolls that don't add new unique hits).
-- Reset to 0 on completion; incremented on every roll.
-- ============================================================

ALTER TABLE public.user_achievements
  ADD COLUMN cycle_roll_count INT NOT NULL DEFAULT 0;
