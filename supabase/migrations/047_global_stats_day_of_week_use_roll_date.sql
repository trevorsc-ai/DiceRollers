-- ============================================================
-- Use roll_date (date the roll counts toward) instead of roll_time
-- for the day-of-week breakdown in get_global_stats. Matches the
-- personal-mode client logic so both views agree on the bucketing.
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
              SELECT jsonb_agg(display_emoji ORDER BY rarity_count ASC, sort_order ASC)
              FROM (
                SELECT
                  a.sort_order,
                  COALESCE(rarity.unlock_count, 0) AS rarity_count,
                  CASE
                    WHEN ua.achievement_id = 'the_punch_card' AND ua.times_completed >= 2 THEN
                      CASE ua.times_completed
                        WHEN 2  THEN '2️⃣🎟️'
                        WHEN 3  THEN '3️⃣🎟️'
                        WHEN 4  THEN '4️⃣🎟️'
                        WHEN 5  THEN '5️⃣🎟️'
                        WHEN 6  THEN '6️⃣🎟️'
                        WHEN 7  THEN '7️⃣🎟️'
                        WHEN 8  THEN '8️⃣🎟️'
                        WHEN 9  THEN '9️⃣🎟️'
                        WHEN 10 THEN '🔟🎟️'
                        ELSE ua.times_completed::text || '🎟️'
                      END
                    ELSE a.emoji
                  END AS display_emoji
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
              ) flair_rows
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
