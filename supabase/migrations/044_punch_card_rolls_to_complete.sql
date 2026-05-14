-- ============================================================
-- Add rolls_to_complete to punch_card_completions
-- Records how many rolls it took to finish each punch card
-- instance. NULL for backfilled historical records where the
-- exact roll count is no longer recoverable.
-- ============================================================

ALTER TABLE public.punch_card_completions
  ADD COLUMN rolls_to_complete INT;
