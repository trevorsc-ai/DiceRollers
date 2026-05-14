-- ============================================================
-- Add rolls_to_complete to punch_card_completions
-- Records how many rolls it took to finish each punch card
-- instance, backfilled for existing records by counting rolls
-- between consecutive completion timestamps.
-- ============================================================

ALTER TABLE public.punch_card_completions
  ADD COLUMN rolls_to_complete INT;

-- Backfill: count rolls in each completion's cycle window.
-- For completion N, the window is (prev completion earned_at, this earned_at].
-- Completion #1 uses epoch as the lower bound (all prior rolls).
UPDATE punch_card_completions pcc
SET rolls_to_complete = (
  SELECT COUNT(*)
  FROM rolls r
  WHERE r.user_id = pcc.user_id
    AND r.roll_time <= pcc.earned_at
    AND r.roll_time > COALESCE(
      (SELECT prev.earned_at
       FROM punch_card_completions prev
       WHERE prev.user_id = pcc.user_id
         AND prev.completion_number = pcc.completion_number - 1),
      '1970-01-01'::timestamptz
    )
)
WHERE pcc.rolls_to_complete IS NULL;
