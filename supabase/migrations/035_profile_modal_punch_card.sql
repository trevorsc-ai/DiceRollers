-- ============================================================
-- Fix get_user_profile_stats to show Punch Card achievement
-- Punch Card uses times_completed for repeat tracking and keeps
-- completed_at = NULL, so it was invisible in the profile modal.
-- Apply the same fix already in get_global_stats (migration 033).
-- ============================================================

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
  -- Only expose stats for public profiles
  SELECT id INTO v_user_id
  FROM profiles
  WHERE username = p_username AND is_public = true;

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
      'emoji', display_emoji,
      'name', a_name
    )
    ORDER BY unlock_count ASC, sort_order ASC
  )
  INTO v_achievements
  FROM (
    SELECT
      a.name AS a_name,
      a.sort_order,
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
      END AS display_emoji,
      COALESCE(rarity.unlock_count, 0) AS unlock_count
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
      )
  ) sub;

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
