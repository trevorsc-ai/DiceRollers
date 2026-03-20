-- ============================================================
-- Backfill progress_detail for double_trouble achievement
-- Stores which specific doubles (1–8) each user has rolled
-- ============================================================

UPDATE user_achievements ua
SET progress_detail = sub.detail,
    updated_at = NOW()
FROM (
  SELECT
    user_id,
    jsonb_build_object(
      'numbers',
      to_jsonb(ARRAY(
        SELECT DISTINCT red_die_number
        FROM rolls r2
        WHERE r2.user_id = r.user_id AND r2.is_doubles = true
        ORDER BY 1
      ))
    ) AS detail
  FROM rolls r
  WHERE is_doubles = true
  GROUP BY user_id
) sub
WHERE ua.user_id = sub.user_id
  AND ua.achievement_id = 'double_trouble';
