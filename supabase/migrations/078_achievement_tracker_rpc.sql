-- ============================================================
-- Achievement Tracker RPC — data for the feed "Tracker" tab.
--
-- Returns, in one round trip:
--   around_the_world       top 5 by combos rolled
--   double_trouble         users still working on it, closest first
--   malort_advent_calendar users still working on it, closest first
--   the_punch_card         users mid-cycle, closest first
--   twinsies               top 10 by twin events
--
-- SECURITY DEFINER is required: RLS on user_achievements only exposes
-- other users' rows once completed_at IS NOT NULL, but the tracker needs
-- in-progress rows of every user. Only username + progress data is returned.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_achievement_tracker()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(

    'around_the_world', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.progress DESC, t.updated_at ASC), '[]'::jsonb)
      FROM (
        SELECT
          ua.user_id,
          p.username,
          ua.progress,
          ua.completed_at,
          COALESCE(ua.progress_detail->'combos', '[]'::jsonb) AS combos,
          ua.updated_at
        FROM user_achievements ua
        JOIN profiles p ON p.id = ua.user_id
        WHERE ua.achievement_id = 'around_the_world'
          AND ua.progress > 0
        ORDER BY ua.progress DESC, ua.updated_at ASC
        LIMIT 5
      ) t
    ),

    'double_trouble', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.rolls_away ASC, t.progress DESC), '[]'::jsonb)
      FROM (
        SELECT
          ua.user_id,
          p.username,
          ua.progress,
          (8 - ua.progress) AS rolls_away,
          COALESCE(ua.progress_detail->'numbers', '[]'::jsonb) AS numbers
        FROM user_achievements ua
        JOIN profiles p ON p.id = ua.user_id
        WHERE ua.achievement_id = 'double_trouble'
          AND ua.completed_at IS NULL
          AND ua.progress > 0
        ORDER BY (8 - ua.progress) ASC, ua.progress DESC
        LIMIT 25
      ) t
    ),

    'malort_advent_calendar', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.rolls_away ASC, t.progress DESC), '[]'::jsonb)
      FROM (
        SELECT
          ua.user_id,
          p.username,
          ua.progress,
          (25 - ua.progress) AS rolls_away
        FROM user_achievements ua
        JOIN profiles p ON p.id = ua.user_id
        WHERE ua.achievement_id = 'malort_advent_calendar'
          AND ua.completed_at IS NULL
          AND ua.progress > 0
        ORDER BY (25 - ua.progress) ASC, ua.progress DESC
        LIMIT 25
      ) t
    ),

    'the_punch_card', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.rolls_away ASC, t.progress DESC), '[]'::jsonb)
      FROM (
        SELECT
          ua.user_id,
          p.username,
          ua.progress,
          GREATEST(
            8 - jsonb_array_length(COALESCE(ua.progress_detail->'red',   '[]'::jsonb)),
            8 - jsonb_array_length(COALESCE(ua.progress_detail->'white', '[]'::jsonb))
          ) AS rolls_away,
          COALESCE(ua.progress_detail->'red',   '[]'::jsonb) AS red,
          COALESCE(ua.progress_detail->'white', '[]'::jsonb) AS white
        FROM user_achievements ua
        JOIN profiles p ON p.id = ua.user_id
        WHERE ua.achievement_id = 'the_punch_card'
          AND ua.completed_at IS NULL
          AND ua.progress > 0
        ORDER BY
          GREATEST(
            8 - jsonb_array_length(COALESCE(ua.progress_detail->'red',   '[]'::jsonb)),
            8 - jsonb_array_length(COALESCE(ua.progress_detail->'white', '[]'::jsonb))
          ) ASC,
          ua.progress DESC
        LIMIT 25
      ) t
    ),

    'twinsies', (
      SELECT COALESCE(jsonb_agg(t ORDER BY t.progress DESC, t.updated_at ASC), '[]'::jsonb)
      FROM (
        SELECT
          ua.user_id,
          p.username,
          ua.progress,
          ua.updated_at
        FROM user_achievements ua
        JOIN profiles p ON p.id = ua.user_id
        WHERE ua.achievement_id = 'twinsies'
          AND ua.progress > 0
        ORDER BY ua.progress DESC, ua.updated_at ASC
        LIMIT 10
      ) t
    )

  );
$$;

REVOKE ALL ON FUNCTION public.get_achievement_tracker() FROM PUBLIC;
-- Supabase grants EXECUTE to anon directly on public functions; PUBLIC alone isn't enough.
REVOKE EXECUTE ON FUNCTION public.get_achievement_tracker() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_achievement_tracker() TO authenticated;
