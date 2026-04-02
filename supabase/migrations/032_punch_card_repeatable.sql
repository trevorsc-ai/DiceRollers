-- ============================================================
-- Punch Card repeatable achievement
-- Adds times_completed and cycle_started_at to track multiple
-- completions of the_punch_card per user.
-- ============================================================

ALTER TABLE public.user_achievements
  ADD COLUMN times_completed INT NOT NULL DEFAULT 0,
  ADD COLUMN cycle_started_at TIMESTAMPTZ;

-- Backfill: users who already completed the Punch Card get
-- times_completed=1, progress reset to 0, and cycle tracking
-- starts from the moment of their original completion so the
-- grid reflects only rolls after that point.
UPDATE public.user_achievements
SET
  times_completed    = 1,
  progress           = 0,
  progress_detail    = NULL,
  cycle_started_at   = completed_at,
  earned_on_roll_id  = earned_on_roll_id,  -- unchanged
  completed_at       = NULL                -- start fresh cycle
WHERE achievement_id = 'the_punch_card'
  AND completed_at IS NOT NULL;
