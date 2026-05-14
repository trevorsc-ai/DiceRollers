-- ============================================================
-- Fix get_global_stats(): migration 052 referenced rarity_count
-- in the ORDER BY inside jsonb_agg, but that alias no longer
-- existed after the punch-card flair was simplified. PostgreSQL
-- silently accepted the CREATE FUNCTION but threw
-- "column rarity_count does not exist" at runtime, causing the
-- RPC to return an error and the All Rollers stats page to show
-- all zeros with no charts.
-- Fix: replace rarity_count with COALESCE(rarity.unlock_count, 0).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_global_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_rolls',   (SELECT COUNT(*)::int FROM rolls),
    'total_doubles', (SELECT COUNT(*)::int FROM rolls WHERE is_doubles = true),

    'red_die_freq', (
      SELECT jsonb_object_agg(red_die_number, cnt)
      FROM (
        SELECT red_die_number, COUNT(*)::int AS cnt
        FROM rolls
        GROUP BY red_die_number
      ) t
    ),

    'white_die_freq', (
      SELECT jsonb_object_agg(white_die_number, cnt)
      FROM (
        SELECT white_die_number, COUNT(*)::int AS cnt
        FROM rolls
        GROUP BY white_die_number
      ) t
    ),

    'top_beers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
      FROM (
        SELECT red_drink_name AS drink_name, COUNT(*)::int AS count
        FROM rolls
        GROUP BY red_drink_name
        ORDER BY count DESC
        LIMIT 8
      ) t
    ),

    'top_shots', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
      FROM (
        SELECT white_drink_name AS drink_name, COUNT(*)::int AS count
        FROM rolls
        GROUP BY white_drink_name
        ORDER BY count DESC
        LIMIT 8
      ) t
    ),

    'day_of_week', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day_num), '[]'::jsonb)
      FROM (
        SELECT EXTRACT(DOW FROM roll_date)::int AS day_num, COUNT(*)::int AS count
        FROM rolls
        GROUP BY day_num
      ) t
    ),

    'leaderboard', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
      FROM (
        SELECT
          p.username,
          COUNT(r.id)::int AS count,
          COALESCE(
            (
              SELECT jsonb_agg(a.emoji ORDER BY COALESCE(rarity.unlock_count, 0) ASC, a.sort_order ASC)
              FROM user_achievements ua
              JOIN achievements a ON a.id = ua.achievement_id
              LEFT JOIN (
                SELECT achievement_id, COUNT(*) AS unlock_count
                FROM user_achievements
                WHERE completed_at IS NOT NULL
                   OR (achievement_id = 'the_punch_card' AND times_completed > 0)
                GROUP BY achievement_id
              ) rarity ON rarity.achievement_id = a.id
              WHERE ua.user_id = p.id
                AND (
                  ua.completed_at IS NOT NULL
                  OR (ua.achievement_id = 'the_punch_card' AND ua.times_completed > 0)
                )
            ),
            '[]'::jsonb
          ) AS flair
        FROM rolls r
        JOIN profiles p ON p.id = r.user_id
        GROUP BY p.id, p.username
        ORDER BY count DESC
        LIMIT 10
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_global_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_stats() TO authenticated;
