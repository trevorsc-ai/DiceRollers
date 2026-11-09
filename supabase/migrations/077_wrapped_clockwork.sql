-- ============================================================
-- Wrapped: "Clockwork" award metrics
--
-- Adds each roller's earliest and latest roll of the night to
-- get_wrapped_global's roller_metrics (min_night_min / max_night_min,
-- minutes since 5:00 AM, same scale as avg_night_min). The Clockwork award
-- in src/lib/wrapped.ts gives the narrowest time-of-day window to the
-- roller with the tightest schedule (8+ rolls to qualify).
--
-- This is migration 075's get_wrapped_global with exactly those two fields
-- added; nothing else in the function changes.
--
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- ============================================================


-- ─── BAR-WIDE WRAPPED + HEAVYWEIGHT + SUPERLATIVE METRICS ────
CREATE OR REPLACE FUNCTION public.get_wrapped_global(p_start date, p_end date, p_min_rolls int DEFAULT 15)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH
yr AS (
  SELECT r.*,
         EXTRACT(HOUR FROM r.roll_time AT TIME ZONE 'America/New_York')::int AS ny_hour,
         ((EXTRACT(HOUR FROM r.roll_time AT TIME ZONE 'America/New_York')::int * 60
           + EXTRACT(MINUTE FROM r.roll_time AT TIME ZONE 'America/New_York')::int
           - 300 + 1440) % 1440) AS night_min
  FROM rolls r
  WHERE r.roll_date BETWEEN p_start AND p_end
),
roller_counts AS (
  SELECT user_id, COUNT(*)::int AS cnt, MAX(roll_time) AS last_time
  FROM yr GROUP BY user_id
),
combo_names AS (
  -- Latest names for every combo ever rolled (so a combo that was rare this
  -- year still gets a readable name).
  SELECT red_die_number, white_die_number,
         (ARRAY_AGG(red_drink_name   ORDER BY roll_time DESC))[1] AS red_name,
         (ARRAY_AGG(white_drink_name ORDER BY roll_time DESC))[1] AS white_name,
         (ARRAY_AGG(red_drink_logo   ORDER BY roll_time DESC))[1] AS red_logo,
         (ARRAY_AGG(white_drink_logo ORDER BY roll_time DESC))[1] AS white_logo
  FROM rolls
  GROUP BY red_die_number, white_die_number
),
all_combos AS (
  SELECT r AS red_die_number, w AS white_die_number, COALESCE(c.cnt, 0) AS cnt
  FROM generate_series(1, 8) r
  CROSS JOIN generate_series(1, 8) w
  LEFT JOIN (SELECT red_die_number, white_die_number, COUNT(*)::int AS cnt
             FROM yr GROUP BY 1, 2) c
    ON c.red_die_number = r AND c.white_die_number = w
),
like_counts AS (
  SELECT l.roll_id, COUNT(*)::int AS likes
  FROM roll_likes l JOIN yr y ON y.id = l.roll_id
  GROUP BY l.roll_id
),
numbered AS (
  SELECT id, user_id, roll_date, red_die_number, white_die_number,
         red_drink_name, white_drink_name, red_drink_logo, white_drink_logo,
         ROW_NUMBER() OVER (ORDER BY roll_time, id)::int AS n
  FROM rolls
),
-- Who rolled on each night, in the order they first showed up.
night_arrivals AS (
  SELECT roll_date, user_id, MIN(roll_time) AS first_time, COUNT(*)::int AS rolls,
         ROW_NUMBER() OVER (PARTITION BY roll_date ORDER BY MIN(roll_time)) AS arrival
  FROM yr GROUP BY roll_date, user_id
),
night_sizes AS (
  SELECT roll_date, COUNT(*)::int AS rollers FROM night_arrivals GROUP BY roll_date
),
top2 AS (
  SELECT user_id, cnt, ROW_NUMBER() OVER (ORDER BY cnt DESC, last_time DESC) AS pos
  FROM roller_counts
  ORDER BY cnt DESC, last_time DESC
  LIMIT 2
),
eligible AS (
  SELECT user_id FROM roller_counts WHERE cnt >= p_min_rolls
),
-- Distinct nights per eligible roller with the gap to their previous night.
e_nights AS (
  SELECT na.user_id, na.roll_date,
         (na.roll_date - LAG(na.roll_date) OVER (PARTITION BY na.user_id ORDER BY na.roll_date))::int AS gap
  FROM night_arrivals na
  WHERE na.user_id IN (SELECT user_id FROM eligible)
),
-- Rolls with someone else rolling within 30 minutes. Joined per night so it
-- stays a hash join instead of scanning the whole year for every roll.
company AS (
  SELECT DISTINCT a.id
  FROM yr a
  JOIN yr o
    ON o.roll_date = a.roll_date
   AND o.user_id <> a.user_id
   AND o.roll_time BETWEEN a.roll_time - INTERVAL '30 minutes' AND a.roll_time + INTERVAL '30 minutes'
),
-- Each eligible roll, flagged if it had company and if it came right after
-- one of the same user's doubles.
e_rolls AS (
  SELECT y.*,
         (y.id IN (SELECT id FROM company)) AS has_company,
         LAG(y.is_doubles) OVER (PARTITION BY y.user_id ORDER BY y.roll_time, y.id) AS prev_doubles
  FROM yr y
  WHERE y.user_id IN (SELECT user_id FROM eligible)
),
halloween_names AS (
  SELECT DISTINCT drink_name FROM menu_items WHERE menu_set = 'halloween'
)
SELECT jsonb_build_object(
  'total_rolls', (SELECT COUNT(*)::int FROM yr),
  'rollers',     (SELECT COUNT(*)::int FROM roller_counts),
  'nights',      (SELECT COUNT(DISTINCT roll_date)::int FROM yr),
  'doubles',     (SELECT COUNT(*)::int FROM yr WHERE is_doubles),

  'red_freq', (
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY f)
    FROM generate_series(1, 8) f
    LEFT JOIN (SELECT red_die_number AS d, COUNT(*)::int AS cnt FROM yr GROUP BY 1) c ON c.d = f
  ),
  'white_freq', (
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY f)
    FROM generate_series(1, 8) f
    LEFT JOIN (SELECT white_die_number AS d, COUNT(*)::int AS cnt FROM yr GROUP BY 1) c ON c.d = f
  ),
  'hour_counts', (
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY h)
    FROM generate_series(0, 23) h
    LEFT JOIN (SELECT ny_hour AS d, COUNT(*)::int AS cnt FROM yr GROUP BY 1) c ON c.d = h
  ),

  'busiest_night', (
    SELECT jsonb_build_object('date', roll_date, 'rolls', COUNT(*)::int, 'rollers', COUNT(DISTINCT user_id)::int)
    FROM yr GROUP BY roll_date
    ORDER BY COUNT(*) DESC, roll_date DESC
    LIMIT 1
  ),

  'top_combo', (
    SELECT jsonb_build_object(
      'red', a.red_die_number, 'white', a.white_die_number, 'count', a.cnt,
      'red_name', n.red_name, 'white_name', n.white_name,
      'red_logo', n.red_logo, 'white_logo', n.white_logo)
    FROM all_combos a
    LEFT JOIN combo_names n USING (red_die_number, white_die_number)
    ORDER BY a.cnt DESC, a.red_die_number, a.white_die_number
    LIMIT 1
  ),
  'rarest_combo', (
    SELECT jsonb_build_object(
      'red', a.red_die_number, 'white', a.white_die_number, 'count', a.cnt,
      'red_name', n.red_name, 'white_name', n.white_name,
      'red_logo', n.red_logo, 'white_logo', n.white_logo)
    FROM all_combos a
    LEFT JOIN combo_names n USING (red_die_number, white_die_number)
    ORDER BY a.cnt ASC, a.red_die_number, a.white_die_number
    LIMIT 1
  ),
  'unrolled_combos', (SELECT COUNT(*)::int FROM all_combos WHERE cnt = 0),

  -- The biggest round-number roll (all-time numbering) that landed in the window.
  'milestone_roll', (
    SELECT jsonb_build_object(
      'number', nb.n, 'date', nb.roll_date, 'username', p.username,
      'red', nb.red_die_number, 'white', nb.white_die_number,
      'red_name', nb.red_drink_name, 'white_name', nb.white_drink_name,
      'red_logo', nb.red_drink_logo, 'white_logo', nb.white_drink_logo)
    FROM numbered nb
    JOIN profiles p ON p.id = nb.user_id
    WHERE nb.roll_date BETWEEN p_start AND p_end AND nb.n % 100 = 0
    ORDER BY (nb.n % 1000 = 0) DESC, (nb.n % 500 = 0) DESC, nb.n DESC
    LIMIT 1
  ),

  'first_roll', (
    SELECT jsonb_build_object('date', y.roll_date, 'username', p.username,
      'red_name', y.red_drink_name, 'white_name', y.white_drink_name)
    FROM yr y JOIN profiles p ON p.id = y.user_id
    ORDER BY y.roll_time, y.id LIMIT 1
  ),

  'most_liked_roll', (
    SELECT jsonb_build_object(
      'likes', lc.likes, 'date', y.roll_date, 'username', p.username,
      'is_doubles', y.is_doubles, 'is_daily_double', y.is_daily_double,
      'red', y.red_die_number, 'white', y.white_die_number,
      'red_name', y.red_drink_name, 'white_name', y.white_drink_name,
      'red_logo', y.red_drink_logo, 'white_logo', y.white_drink_logo)
    FROM like_counts lc
    JOIN yr y ON y.id = lc.roll_id
    JOIN profiles p ON p.id = y.user_id
    ORDER BY lc.likes DESC, y.roll_time DESC
    LIMIT 1
  ),

  'twinsies_events', (
    SELECT COUNT(*)::int FROM (
      SELECT 1 FROM yr GROUP BY roll_date, red_die_number, white_die_number
      HAVING COUNT(DISTINCT user_id) >= 2
    ) t
  ),
  -- Per multi-roller night, how many rolls each roller made. The client uses
  -- this to compute how many twinsies pure chance would produce.
  'night_roll_counts', (
    SELECT COALESCE(jsonb_agg(counts), '[]'::jsonb)
    FROM (
      SELECT jsonb_agg(na.rolls) AS counts
      FROM night_arrivals na
      JOIN night_sizes ns ON ns.roll_date = na.roll_date AND ns.rollers >= 2
      GROUP BY na.roll_date
    ) t
  ),

  -- ── Heavyweight Title Fight: the top 2 rollers by volume ──
  'heavyweight', (
    SELECT CASE WHEN (SELECT COUNT(*) FROM top2) < 2 THEN NULL ELSE jsonb_build_object(
      'fighters', (
        SELECT jsonb_agg(jsonb_build_object(
          'user_id', t.user_id,
          'username', p.username,
          'rolls', t.cnt,
          'nights',   (SELECT COUNT(DISTINCT roll_date)::int FROM yr WHERE user_id = t.user_id),
          'doubles',  (SELECT COUNT(*)::int FROM yr WHERE user_id = t.user_id AND is_doubles),
          'malort',   (SELECT COUNT(*)::int FROM yr WHERE user_id = t.user_id
                       AND (white_drink_name ILIKE '%malort%' OR white_drink_name ILIKE '%malört%')),
          'combos',   (SELECT COUNT(DISTINCT (red_die_number, white_die_number))::int FROM yr WHERE user_id = t.user_id),
          'months', (
            SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY m)
            FROM generate_series(1, 12) m
            LEFT JOIN (SELECT EXTRACT(MONTH FROM roll_date)::int AS d, COUNT(*)::int AS cnt
                       FROM yr WHERE user_id = t.user_id GROUP BY 1) c ON c.d = m
          ),
          'first_on_shared', (
            SELECT COUNT(*)::int FROM night_arrivals a
            WHERE a.user_id = t.user_id
              AND a.roll_date IN (
                SELECT roll_date FROM night_arrivals
                WHERE user_id IN (SELECT user_id FROM top2)
                GROUP BY roll_date HAVING COUNT(*) = 2)
              AND a.first_time < (
                SELECT b.first_time FROM night_arrivals b
                WHERE b.roll_date = a.roll_date AND b.user_id <> a.user_id
                  AND b.user_id IN (SELECT user_id FROM top2))
          )
        ) ORDER BY t.pos)
        FROM top2 t JOIN profiles p ON p.id = t.user_id
      ),
      'shared_nights', (
        SELECT COUNT(*)::int FROM (
          SELECT roll_date FROM night_arrivals
          WHERE user_id IN (SELECT user_id FROM top2)
          GROUP BY roll_date HAVING COUNT(*) = 2
        ) s
      ),
      'twinsies', (
        SELECT COUNT(*)::int FROM (
          SELECT roll_date, red_die_number, white_die_number FROM yr
          WHERE user_id IN (SELECT user_id FROM top2)
          GROUP BY roll_date, red_die_number, white_die_number
          HAVING COUNT(DISTINCT user_id) = 2
        ) s
      )
    ) END
  ),

  -- ── Raw per-roller metrics for the yearbook superlatives ──
  'roller_metrics', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', e.user_id,
      'username', p.username,
      'rolls', rc.cnt,
      'nights', (SELECT COUNT(*)::int FROM e_nights n WHERE n.user_id = e.user_id),
      'doubles', (SELECT COUNT(*)::int FROM e_rolls r WHERE r.user_id = e.user_id AND r.is_doubles),
      'double_pairs', (SELECT COUNT(*)::int FROM e_rolls r WHERE r.user_id = e.user_id AND r.is_doubles AND r.prev_doubles),
      'snake_eyes', (SELECT COUNT(*)::int FROM e_rolls r WHERE r.user_id = e.user_id
                     AND r.red_die_number = 1 AND r.white_die_number = 1),
      'malort', (SELECT COUNT(*)::int FROM e_rolls r WHERE r.user_id = e.user_id
                 AND (r.white_drink_name ILIKE '%malort%' OR r.white_drink_name ILIKE '%malört%')),
      'spooky', (SELECT COUNT(*)::int FROM e_rolls r WHERE r.user_id = e.user_id
                 AND r.white_drink_name IN (SELECT drink_name FROM halloween_names)),
      'with_company', (SELECT COUNT(*)::int FROM e_rolls r WHERE r.user_id = e.user_id AND r.has_company),
      'distinct_combos', (SELECT COUNT(DISTINCT (r.red_die_number, r.white_die_number))::int
                          FROM e_rolls r WHERE r.user_id = e.user_id),
      'red_freq', (
        SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY f) FROM generate_series(1, 8) f
        LEFT JOIN (SELECT red_die_number AS d, COUNT(*)::int AS cnt FROM e_rolls
                   WHERE user_id = e.user_id GROUP BY 1) c ON c.d = f
      ),
      'white_freq', (
        SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY f) FROM generate_series(1, 8) f
        LEFT JOIN (SELECT white_die_number AS d, COUNT(*)::int AS cnt FROM e_rolls
                   WHERE user_id = e.user_id GROUP BY 1) c ON c.d = f
      ),
      'gap_mean', (SELECT AVG(gap)::float FROM e_nights n WHERE n.user_id = e.user_id AND gap IS NOT NULL),
      'gap_sd',   (SELECT STDDEV_SAMP(gap)::float FROM e_nights n WHERE n.user_id = e.user_id AND gap IS NOT NULL),
      'max_gap',  (SELECT MAX(gap)::int FROM e_nights n WHERE n.user_id = e.user_id),
      'max_gap_return', (
        SELECT jsonb_build_object('date', n.roll_date, 'white_name', (
          SELECT r.white_drink_name FROM e_rolls r
          WHERE r.user_id = e.user_id AND r.roll_date = n.roll_date
          ORDER BY r.roll_time LIMIT 1))
        FROM e_nights n WHERE n.user_id = e.user_id AND n.gap IS NOT NULL
        ORDER BY n.gap DESC, n.roll_date DESC LIMIT 1
      ),
      'solo_nights', (
        SELECT COUNT(*)::int FROM night_arrivals a JOIN night_sizes s USING (roll_date)
        WHERE a.user_id = e.user_id AND s.rollers = 1
      ),
      'third_wheel_nights', (
        SELECT COUNT(*)::int FROM night_arrivals a WHERE a.user_id = e.user_id AND a.arrival = 3
      ),
      'monday_nights', (
        SELECT COUNT(*)::int FROM e_nights n WHERE n.user_id = e.user_id AND EXTRACT(DOW FROM n.roll_date) = 1
      ),
      'avg_night_min', (SELECT AVG(night_min)::float FROM e_rolls r WHERE r.user_id = e.user_id),
      -- Earliest and latest roll of the night (minutes since 5 AM) for the
      -- "Clockwork" award: the narrowest time-of-day window wins.
      'min_night_min', (SELECT MIN(night_min)::int FROM e_rolls r WHERE r.user_id = e.user_id),
      'max_night_min', (SELECT MAX(night_min)::int FROM e_rolls r WHERE r.user_id = e.user_id),
      'likes_given', (
        SELECT COUNT(*)::int FROM roll_likes l JOIN yr y ON y.id = l.roll_id
        WHERE l.user_id = e.user_id AND y.user_id <> e.user_id
      ),
      'likes_received', (
        SELECT COUNT(*)::int FROM roll_likes l JOIN yr y ON y.id = l.roll_id
        WHERE y.user_id = e.user_id AND l.user_id <> e.user_id
      )
    ) ORDER BY p.username), '[]'::jsonb)
    FROM eligible e
    JOIN roller_counts rc ON rc.user_id = e.user_id
    JOIN profiles p ON p.id = e.user_id
  )
);
$$;

REVOKE ALL ON FUNCTION public.get_wrapped_global(date, date, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped_global(date, date, int) TO authenticated;


-- This file may be applied by hand in the SQL Editor; record it so
-- `supabase migration list` doesn't report drift.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('077', 'wrapped_clockwork')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
