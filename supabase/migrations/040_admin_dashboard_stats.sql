-- ============================================================
-- Admin Dashboard Stats RPC — admin-only, bypasses RLS
-- Returns user counts, active users (DAU/WAU/MAU),
-- signups over time, rolls over time, and top users.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  -- Enforce admin-only access
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT jsonb_build_object(

    -- ── User totals ──────────────────────────────────────────
    'total_users',  (SELECT COUNT(*)::int FROM profiles),
    'public_users', (SELECT COUNT(*)::int FROM profiles WHERE is_public = true),
    'oath_users',   (SELECT COUNT(*)::int FROM profiles WHERE oath_accepted_at IS NOT NULL),

    -- ── Active users (based on roll activity) ────────────────
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

    -- ── Roll totals ──────────────────────────────────────────
    'total_rolls',       (SELECT COUNT(*)::int FROM rolls),
    'rolls_last_7d',     (SELECT COUNT(*)::int FROM rolls WHERE roll_time >= NOW() - INTERVAL '7 days'),
    'rolls_last_30d',    (SELECT COUNT(*)::int FROM rolls WHERE roll_time >= NOW() - INTERVAL '30 days'),

    -- ── New signups by day (last 30 days) ────────────────────
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

    -- ── Daily active unique rollers (last 30 days) ───────────
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

    -- ── Rolls per day (last 30 days) ─────────────────────────
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

    -- ── Cumulative user growth by week (all time) ────────────
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

    -- ── Top active users last 30 days ────────────────────────
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

-- Admin-only: only authenticated users can call, enforced inside the function too
REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
