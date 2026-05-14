-- ============================================================
-- Punch Card Club leaderboard RPC
-- Returns the top 8 users ranked by fewest rolls to complete
-- The Punch Card achievement. Ties broken by earliest completion.
-- Also returns the total count of unique club members.
-- ============================================================

CREATE OR REPLACE FUNCTION get_punch_card_club()
RETURNS TABLE (
  user_id   uuid,
  username  text,
  best_rolls int,
  earned_at  timestamptz,
  total_members bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  WITH best_per_user AS (
    -- One row per user: their fastest (lowest-roll) punch card completion
    SELECT DISTINCT ON (pcc.user_id)
      pcc.user_id,
      pcc.rolls_to_complete AS best_rolls,
      pcc.earned_at
    FROM punch_card_completions pcc
    WHERE pcc.rolls_to_complete IS NOT NULL
    ORDER BY pcc.user_id, pcc.rolls_to_complete ASC, pcc.earned_at ASC
  ),
  total AS (
    SELECT COUNT(*) AS cnt FROM best_per_user
  )
  SELECT
    bpu.user_id,
    p.username,
    bpu.best_rolls,
    bpu.earned_at,
    t.cnt AS total_members
  FROM best_per_user bpu
  JOIN profiles p ON p.id = bpu.user_id
  CROSS JOIN total t
  ORDER BY bpu.best_rolls ASC, bpu.earned_at ASC
  LIMIT 8
$$;

GRANT EXECUTE ON FUNCTION get_punch_card_club() TO authenticated, anon;
