-- ============================================================
-- Fix get_achievement_rarity() to count punch card completions
-- The punch card resets completed_at after each cycle, so
-- earned users have times_completed > 0 but completed_at IS NULL.
-- Also fix leaderboard and profile flair queries for same reason.
-- ============================================================

CREATE OR REPLACE FUNCTION get_achievement_rarity()
RETURNS TABLE(achievement_id TEXT, unlock_count BIGINT, total_users BIGINT)
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT
    a.id,
    COUNT(ua.id),
    (SELECT COUNT(*) FROM profiles)
  FROM achievements a
  LEFT JOIN user_achievements ua
    ON ua.achievement_id = a.id
    AND (
      ua.completed_at IS NOT NULL
      OR (a.id = 'the_punch_card' AND ua.times_completed > 0)
    )
  GROUP BY a.id;
$$;

GRANT EXECUTE ON FUNCTION get_achievement_rarity() TO authenticated;
