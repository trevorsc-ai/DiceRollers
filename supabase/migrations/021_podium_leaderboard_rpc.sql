-- ============================================================
-- Podium leaderboard RPC — top 8 rollers with earned achievements
-- Returns achievements catalogue (first 10 by sort_order),
-- top 8 users ranked by total lifetime rolls, and total active
-- roller count.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_podium_leaderboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_ach_sort_orders int[];
BEGIN
  -- Capture the sort_order values of the first 10 achievements so we can
  -- filter consistently throughout the query.
  SELECT ARRAY(SELECT sort_order FROM achievements ORDER BY sort_order LIMIT 10)
  INTO v_ach_sort_orders;

  SELECT jsonb_build_object(

    'total_rollers', (
      SELECT COUNT(DISTINCT user_id)::int FROM rolls
    ),

    'achievements', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id',         a.id,
            'emoji',      a.emoji,
            'name',       a.name,
            'sort_order', a.sort_order
          ) ORDER BY a.sort_order
        ),
        '[]'::jsonb
      )
      FROM achievements a
      WHERE a.sort_order = ANY(v_ach_sort_orders)
    ),

    'rollers', (
      SELECT COALESCE(jsonb_agg(row_to_json(u)), '[]'::jsonb)
      FROM (
        SELECT
          p.id       AS user_id,
          p.username,
          r.roll_count AS rolls,
          COALESCE(
            (
              SELECT jsonb_agg(a.sort_order ORDER BY a.sort_order)
              FROM user_achievements ua
              JOIN achievements a ON a.id = ua.achievement_id
              WHERE ua.user_id        = p.id
                AND ua.completed_at IS NOT NULL
                AND a.sort_order      = ANY(v_ach_sort_orders)
            ),
            '[]'::jsonb
          ) AS earned_sort_orders
        FROM (
          SELECT user_id, COUNT(*)::int AS roll_count
          FROM rolls
          GROUP BY user_id
          ORDER BY roll_count DESC
          LIMIT 8
        ) r
        JOIN profiles p ON p.id = r.user_id
        ORDER BY r.roll_count DESC
      ) u
    )

  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_podium_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_podium_leaderboard() TO authenticated;
