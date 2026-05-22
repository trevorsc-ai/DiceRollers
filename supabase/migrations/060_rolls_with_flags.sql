-- 060_rolls_with_flags.sql
--
-- Adds a `rolls_with_flags` view that extends `rolls_with_twins` with two
-- boolean flags (`has_achievement`, `has_twin`) and a per-user roll number
-- (`user_roll_number`). The history page uses this to push every filter
-- (achievements-only, twinsies-only, doubles, search, date range) into
-- the SQL query so keyset pagination stays honest at any history size,
-- and to label rolls with the user's lifetime roll number regardless of
-- filter or page.
--
-- `has_achievement` mirrors the display rule exactly: a roll has an
-- achievement pill iff there is a non-twinsies user_achievements row
-- with completed_at set, OR a punch_card_completions row. (Punch Card
-- lives in its own table because user_achievements.completed_at is
-- reset to NULL each cycle — see migration 036.)

CREATE OR REPLACE VIEW public.rolls_with_flags
WITH (security_invoker = true) AS
SELECT
  rwt.*,
  COALESCE(array_length(rwt.twin_partners, 1), 0) > 0 AS has_twin,
  ROW_NUMBER() OVER (PARTITION BY rwt.user_id ORDER BY rwt.roll_time ASC) AS user_roll_number,
  (
    EXISTS (
      SELECT 1
      FROM user_achievements ua
      WHERE ua.earned_on_roll_id = rwt.id
        AND ua.completed_at IS NOT NULL
        AND ua.achievement_id <> 'twinsies'
    )
    OR EXISTS (
      SELECT 1
      FROM punch_card_completions pcc
      WHERE pcc.earned_on_roll_id = rwt.id
    )
  ) AS has_achievement
FROM public.rolls_with_twins rwt;

GRANT SELECT ON public.rolls_with_flags TO authenticated;
