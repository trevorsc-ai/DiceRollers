-- ============================================================
-- Punch Card emoji simplified to single fist 👊
-- Previously showed numbered ticket variants (2️⃣🎟️, 3️⃣🎟️, …).
-- Now the achievement always shows 👊 regardless of completion count.
-- ============================================================

UPDATE achievements SET emoji = '👊' WHERE id = 'the_punch_card';

-- ─── get_global_stats: remove numbered punch card flair ──────
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
              SELECT jsonb_agg(a.emoji ORDER BY rarity_count ASC, a.sort_order ASC)
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

-- ─── get_user_profile_stats: remove numbered punch card emoji ─
CREATE OR REPLACE FUNCTION get_user_profile_stats(p_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_total_rolls bigint;
  v_doubles_count bigint;
  v_most_rolled_beer text;
  v_most_rolled_shot text;
  v_achievements json;
BEGIN
  SELECT id INTO v_user_id
  FROM profiles
  WHERE username = p_username;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_total_rolls
  FROM rolls WHERE user_id = v_user_id;

  SELECT COUNT(*) INTO v_doubles_count
  FROM rolls WHERE user_id = v_user_id AND is_doubles = true;

  SELECT red_drink_name INTO v_most_rolled_beer
  FROM rolls
  WHERE user_id = v_user_id
  GROUP BY red_drink_name
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  SELECT white_drink_name INTO v_most_rolled_shot
  FROM rolls
  WHERE user_id = v_user_id
  GROUP BY white_drink_name
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  SELECT json_agg(
    json_build_object(
      'emoji', a.emoji,
      'name', a.name
    )
    ORDER BY COALESCE(rarity.unlock_count, 0) ASC, a.sort_order ASC
  )
  INTO v_achievements
  FROM user_achievements ua
  JOIN achievements a ON ua.achievement_id = a.id
  LEFT JOIN (
    SELECT achievement_id, COUNT(*) AS unlock_count
    FROM user_achievements
    WHERE completed_at IS NOT NULL
       OR (achievement_id = 'the_punch_card' AND times_completed > 0)
    GROUP BY achievement_id
  ) rarity ON rarity.achievement_id = a.id
  WHERE ua.user_id = v_user_id
    AND (
      ua.completed_at IS NOT NULL
      OR (ua.achievement_id = 'the_punch_card' AND ua.times_completed > 0)
    );

  RETURN json_build_object(
    'username', p_username,
    'total_rolls', v_total_rolls,
    'doubles_count', v_doubles_count,
    'doubles_pct', CASE
      WHEN v_total_rolls > 0
      THEN ROUND((v_doubles_count::numeric / v_total_rolls) * 100, 1)
      ELSE 0
    END,
    'most_rolled_beer', v_most_rolled_beer,
    'most_rolled_shot', v_most_rolled_shot,
    'achievements', COALESCE(v_achievements, '[]'::json)
  );
END;
$$;
