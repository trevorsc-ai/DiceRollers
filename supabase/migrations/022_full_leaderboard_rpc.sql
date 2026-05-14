-- ============================================================
-- Full leaderboard RPC — all rollers ranked by lifetime rolls
-- Used by the /stats/leaderboard full-list page.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_full_leaderboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(

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
    ),

    'rollers', (
      SELECT COALESCE(jsonb_agg(row_to_json(u)), '[]'::jsonb)
      FROM (
        SELECT
          p.id         AS user_id,
          p.username,
          r.roll_count AS rolls,
          COALESCE(
            (
              SELECT jsonb_agg(a.sort_order ORDER BY a.sort_order)
              FROM user_achievements ua
              JOIN achievements a ON a.id = ua.achievement_id
              WHERE ua.user_id       = p.id
                AND ua.completed_at IS NOT NULL
            ),
            '[]'::jsonb
          ) AS earned_sort_orders
        FROM (
          SELECT user_id, COUNT(*)::int AS roll_count
          FROM rolls
          GROUP BY user_id
          ORDER BY roll_count DESC
        ) r
        JOIN profiles p ON p.id = r.user_id
        ORDER BY r.roll_count DESC
      ) u
    )

  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_full_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_full_leaderboard() TO authenticated;
