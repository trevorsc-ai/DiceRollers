-- ============================================================
-- Migration 042: Remove is_public — all users are public
-- - Drop is_public column (all rows have been true since migration 002)
-- - Open profiles_select RLS to all authenticated users
-- - Open rolls_select RLS to all authenticated users
-- - Remove is_public gate from get_user_profile_stats
-- - Remove is_public filter from get_admin_dashboard_stats
-- - Strip is_public from handle_new_user trigger
-- ============================================================

-- Drop the column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_public;

-- ─── RLS: profiles ───────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- ─── RLS: rolls ──────────────────────────────────────────────
-- All authenticated users can now read all rolls (everyone is public)
DROP POLICY IF EXISTS "rolls_select" ON public.rolls;
CREATE POLICY "rolls_select" ON public.rolls
  FOR SELECT TO authenticated USING (true);

-- rolls_admin_select is now redundant (rolls_select covers all), drop it
DROP POLICY IF EXISTS "rolls_admin_select" ON public.rolls;

-- ─── Trigger: handle_new_user ────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    lower(COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── get_user_profile_stats: remove is_public gate ───────────
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

-- ─── get_admin_dashboard_stats: remove is_public filter ──────
-- public_users kept as a key for frontend compatibility — equals total_users now
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT jsonb_build_object(

    'total_users',  (SELECT COUNT(*)::int FROM profiles),
    'public_users', (SELECT COUNT(*)::int FROM profiles),
    'oath_users',   (SELECT COUNT(*)::int FROM profiles WHERE oath_accepted_at IS NOT NULL),

    'dau', (
      SELECT COUNT(DISTINCT user_id)::int FROM rolls
      WHERE roll_time >= NOW() - INTERVAL '24 hours'
    ),
    'wau', (
      SELECT COUNT(DISTINCT user_id)::int FROM rolls
      WHERE roll_time >= NOW() - INTERVAL '7 days'
    ),
    'mau', (
      SELECT COUNT(DISTINCT user_id)::int FROM rolls
      WHERE roll_time >= NOW() - INTERVAL '30 days'
    ),

    'total_rolls',    (SELECT COUNT(*)::int FROM rolls),
    'rolls_last_7d',  (SELECT COUNT(*)::int FROM rolls WHERE roll_time >= NOW() - INTERVAL '7 days'),
    'rolls_last_30d', (SELECT COUNT(*)::int FROM rolls WHERE roll_time >= NOW() - INTERVAL '30 days'),

    'signups_by_day', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day), '[]'::jsonb)
      FROM (
        SELECT DATE(created_at)::text AS day, COUNT(*)::int AS count
        FROM profiles
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      ) t
    ),

    'dau_by_day', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day), '[]'::jsonb)
      FROM (
        SELECT DATE(roll_time)::text AS day, COUNT(DISTINCT user_id)::int AS count
        FROM rolls
        WHERE roll_time >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(roll_time)
        ORDER BY DATE(roll_time)
      ) t
    ),

    'rolls_by_day', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day), '[]'::jsonb)
      FROM (
        SELECT DATE(roll_time)::text AS day, COUNT(*)::int AS count
        FROM rolls
        WHERE roll_time >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(roll_time)
        ORDER BY DATE(roll_time)
      ) t
    ),

    'user_growth_by_week', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.week), '[]'::jsonb)
      FROM (
        SELECT
          DATE_TRUNC('week', created_at)::date::text AS week,
          COUNT(*)::int AS new_users,
          SUM(COUNT(*)) OVER (ORDER BY DATE_TRUNC('week', created_at))::int AS cumulative
        FROM profiles
        GROUP BY DATE_TRUNC('week', created_at)
        ORDER BY DATE_TRUNC('week', created_at)
      ) t
    ),

    'top_users_30d', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.rolls DESC), '[]'::jsonb)
      FROM (
        SELECT p.username, COUNT(r.id)::int AS rolls
        FROM rolls r
        JOIN profiles p ON p.id = r.user_id
        WHERE r.roll_time >= NOW() - INTERVAL '30 days'
        GROUP BY p.username
        ORDER BY rolls DESC
        LIMIT 10
      ) t
    )

  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
