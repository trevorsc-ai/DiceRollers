-- ============================================================
-- Update global stats RPC to split drinks into beers (red die)
-- and shots (white die) instead of a combined top_drinks list
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
        SELECT EXTRACT(DOW FROM roll_time)::int AS day_num, COUNT(*)::int AS count
        FROM rolls
        GROUP BY day_num
      ) t
    ),

    'leaderboard', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
      FROM (
        SELECT p.username, COUNT(r.id)::int AS count
        FROM rolls r
        JOIN profiles p ON p.id = r.user_id
        GROUP BY p.username
        ORDER BY count DESC
        LIMIT 10
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Only authenticated users may call this function
REVOKE ALL ON FUNCTION public.get_global_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_global_stats() TO authenticated;
