-- Returns high-level stats and earned achievements for a public user by username.
-- Used by the leaderboard profile modal.
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
    json_build_object('emoji', a.emoji, 'name', a.name)
    ORDER BY a.sort_order
  )
  INTO v_achievements
  FROM user_achievements ua
  JOIN achievements a ON ua.achievement_id = a.id
  WHERE ua.user_id = v_user_id AND ua.completed_at IS NOT NULL;

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
