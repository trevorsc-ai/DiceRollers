-- ============================================================
-- Wrapped: "The Pour" slides (ounces poured)
--
-- Wrapped turns each roll into ounces: a beer is 12 oz, a Daily Double
-- beer is 16 oz, a shot is 1.5 oz. Total rolls already come back from
-- get_wrapped / get_wrapped_global; the one number they don't return is
-- how many of those rolls took the Daily Double.
--
--   get_wrapped_pour(p_user, p_start, p_end)
--     -> { personal_daily_doubles, bar_daily_doubles }
--
-- Additive on purpose: get_wrapped and get_wrapped_global are untouched.
-- The ounce math lives in src/lib/wrapped.ts.
--
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_wrapped_pour(p_user uuid, p_start date, p_end date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'personal_daily_doubles', COUNT(*) FILTER (WHERE is_daily_double AND user_id = p_user)::int,
    'bar_daily_doubles',      COUNT(*) FILTER (WHERE is_daily_double)::int
  )
  FROM rolls
  WHERE roll_date BETWEEN p_start AND p_end;
$$;

REVOKE ALL ON FUNCTION public.get_wrapped_pour(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped_pour(uuid, date, date) TO authenticated;


-- This file may be applied by hand in the SQL Editor; record it so
-- `supabase migration list` doesn't report drift.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('076', 'wrapped_pour')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
