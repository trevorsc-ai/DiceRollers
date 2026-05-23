-- ============================================================
-- get_personal_stats(user_id)
--
-- Mirror of get_global_stats() but scoped to a single user. The
-- /stats page used to fetch every row of `rolls` for the current
-- user and aggregate client-side, which is expensive once a user
-- has hundreds of rolls. With this RPC the client just renders
-- the same shape it does for the All Rollers view.
--
-- Returns: total_rolls, total_doubles, red_die_freq, white_die_freq,
-- top_beers, top_shots, day_of_week, current_streak. Leaderboard
-- and Punch Card Club remain global-only.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_personal_stats(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_rolls',   (SELECT COUNT(*)::int FROM rolls WHERE user_id = target_user_id),
    'total_doubles', (SELECT COUNT(*)::int FROM rolls WHERE user_id = target_user_id AND is_doubles = true),

    'red_die_freq', (
      SELECT COALESCE(jsonb_object_agg(red_die_number, cnt), '{}'::jsonb)
      FROM (
        SELECT red_die_number, COUNT(*)::int AS cnt
        FROM rolls
        WHERE user_id = target_user_id
        GROUP BY red_die_number
      ) t
    ),

    'white_die_freq', (
      SELECT COALESCE(jsonb_object_agg(white_die_number, cnt), '{}'::jsonb)
      FROM (
        SELECT white_die_number, COUNT(*)::int AS cnt
        FROM rolls
        WHERE user_id = target_user_id
        GROUP BY white_die_number
      ) t
    ),

    'top_beers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
      FROM (
        SELECT red_drink_name AS drink_name, COUNT(*)::int AS count
        FROM rolls
        WHERE user_id = target_user_id
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
        WHERE user_id = target_user_id
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
        WHERE user_id = target_user_id
        GROUP BY day_num
      ) t
    ),

    -- Current streak: count of consecutive most-recent roll_dates ending today
    -- (or yesterday if no roll today). Uses gap detection via row_number().
    'current_streak', (
      WITH ordered_dates AS (
        SELECT DISTINCT roll_date
        FROM rolls
        WHERE user_id = target_user_id
        ORDER BY roll_date DESC
        LIMIT 365
      ),
      anchored AS (
        SELECT roll_date,
               (CURRENT_DATE - roll_date)::int AS days_back,
               ROW_NUMBER() OVER (ORDER BY roll_date DESC) - 1 AS rn
        FROM ordered_dates
      )
      SELECT COALESCE(COUNT(*)::int, 0)
      FROM anchored
      WHERE days_back = rn
        -- streak must start within the last day (today or yesterday)
        AND (SELECT MIN(days_back) FROM anchored) <= 1
    )
  )
  INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_personal_stats(uuid) TO authenticated;
