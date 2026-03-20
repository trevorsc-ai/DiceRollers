-- ============================================================
-- Backfill progress_detail for around_the_world
-- Adds { combos: ["red-white", ...] } to existing rows
-- ============================================================

UPDATE user_achievements ua
SET
  progress_detail = t.detail,
  updated_at      = NOW()
FROM (
  SELECT
    user_id,
    jsonb_build_object(
      'combos',
      jsonb_agg(DISTINCT (red_die_number::text || '-' || white_die_number::text))
    ) AS detail
  FROM rolls
  GROUP BY user_id
) t
WHERE ua.user_id        = t.user_id
  AND ua.achievement_id = 'around_the_world';
