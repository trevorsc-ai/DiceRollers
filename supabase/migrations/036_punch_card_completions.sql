-- ============================================================
-- Punch Card completion history table
-- Each time a user completes a Punch Card cycle, a row is
-- inserted here so the feed can display every completion
-- event linked to its triggering roll, even after subsequent
-- cycles overwrite earned_on_roll_id in user_achievements.
-- ============================================================

CREATE TABLE public.punch_card_completions (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  earned_on_roll_id INT NOT NULL REFERENCES rolls(id) ON DELETE CASCADE,
  completion_number INT NOT NULL,  -- 1 = first, 2 = second, etc.
  earned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pcc_user      ON punch_card_completions(user_id);
CREATE INDEX idx_pcc_roll      ON punch_card_completions(earned_on_roll_id);

ALTER TABLE public.punch_card_completions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read completions (for feed display)
CREATE POLICY "Anyone can view punch_card_completions"
  ON punch_card_completions FOR SELECT
  TO authenticated
  USING (true);

-- Service role manages writes
CREATE POLICY "Service role manages punch_card_completions"
  ON punch_card_completions FOR ALL
  USING (auth.role() = 'service_role');

-- Backfill: typewriter (and any other users) who already have
-- times_completed > 0 in user_achievements
INSERT INTO public.punch_card_completions (user_id, earned_on_roll_id, completion_number, earned_at)
SELECT
  ua.user_id,
  ua.earned_on_roll_id,
  ua.times_completed,
  ua.updated_at
FROM user_achievements ua
WHERE ua.achievement_id = 'the_punch_card'
  AND ua.times_completed > 0
  AND ua.earned_on_roll_id IS NOT NULL;
