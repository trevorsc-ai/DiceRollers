-- ============================================================
-- Update get_punch_card_club() to return ALL completions
-- (not just the fastest per user), ranked by fewest rolls.
-- Each row includes the completion_number (which card it was)
-- and both unique member count + total completion count.
-- ============================================================

CREATE OR REPLACE FUNCTION get_punch_card_club()
RETURNS TABLE (
  user_id           uuid,
  username          text,
  completion_number int,
  best_rolls        int,
  earned_at         timestamptz,
  total_members     bigint,
  total_completions bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  WITH completions AS (
    SELECT
      pcc.user_id,
      pcc.completion_number,
      pcc.rolls_to_complete,
      pcc.earned_at
    FROM punch_card_completions pcc
    WHERE pcc.rolls_to_complete IS NOT NULL
  ),
  counts AS (
    SELECT
      COUNT(DISTINCT user_id) AS total_members,
      COUNT(*)                AS total_completions
    FROM completions
  )
  SELECT
    c.user_id,
    p.username,
    c.completion_number,
    c.rolls_to_complete  AS best_rolls,
    c.earned_at,
    cnt.total_members,
    cnt.total_completions
  FROM completions c
  JOIN profiles p ON p.id = c.user_id
  CROSS JOIN counts cnt
  ORDER BY c.rolls_to_complete ASC, c.earned_at ASC
  LIMIT 10
$$;

GRANT EXECUTE ON FUNCTION get_punch_card_club() TO authenticated, anon;
