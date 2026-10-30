-- Trick or Drink (halloween) now counts rolls on Oct 30 as well as Oct 31.
-- The roll-save engine and recalc script check both days; this updates the
-- description and backfills anyone who already rolled on an Oct 30.

UPDATE achievements
SET description = 'Roll on Halloween (Oct 30 or 31)'
WHERE id = 'halloween';

INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'halloween', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 10 AND EXTRACT(DAY FROM roll_date) IN (30, 31)
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- This file may be applied by hand in the SQL Editor; record it so
-- `supabase migration list` doesn't report drift.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('073', 'halloween_two_days')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
