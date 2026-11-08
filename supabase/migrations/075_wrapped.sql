-- ============================================================
-- DiceRollers Wrapped 🎁
--
-- Year-in-review story deck. Two read-only RPCs feed /wrapped:
--
--   get_wrapped(p_user, p_start, p_end)
--     Personal numbers for one roller inside the window.
--
--   get_wrapped_global(p_start, p_end, p_min_rolls)
--     Bar-wide numbers, the top-2 "Heavyweight" head-to-head, and
--     the per-roller metrics the client scores into superlatives
--     (one award per roller, see src/lib/wrapped.ts).
--
-- Both return raw counts. All the statistics (z-scores, chi-square
-- p-values, expected counts) are computed client-side in
-- src/lib/wrapped.ts so the math lives in one testable place.
--
-- Times: a "night" runs 5:00 AM to 4:59 AM America/New_York (see
-- 007_datetime_convention). `night_min` is minutes since 5:00 AM,
-- so 5 PM = 720 and 1 AM = 1200. That keeps after-midnight rolls
-- ordered after the evening ones.
--
-- Also adds `app_flags` with a `wrapped_live` row so an admin can
-- release Wrapped to everyone from /admin.
--
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- ============================================================


-- ─── RELEASE FLAG ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_flags_select" ON public.app_flags;
CREATE POLICY "app_flags_select" ON public.app_flags
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_flags (key, enabled)
VALUES ('wrapped_live', false)
ON CONFLICT (key) DO NOTHING;

-- Writes go through this RPC only (no UPDATE policy on the table).
CREATE OR REPLACE FUNCTION public.set_app_flag(flag_key text, flag_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can change app flags';
  END IF;

  UPDATE public.app_flags
  SET enabled = flag_enabled, updated_at = NOW()
  WHERE key = flag_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown app flag: %', flag_key;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_app_flag(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_app_flag(text, boolean) TO authenticated;


-- ─── PERSONAL WRAPPED ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_wrapped(p_user uuid, p_start date, p_end date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH
yr AS (
  SELECT r.*,
         ((EXTRACT(HOUR FROM r.roll_time AT TIME ZONE 'America/New_York')::int * 60
           + EXTRACT(MINUTE FROM r.roll_time AT TIME ZONE 'America/New_York')::int
           - 300 + 1440) % 1440) AS night_min
  FROM rolls r
  WHERE r.roll_date BETWEEN p_start AND p_end
),
mine AS (SELECT * FROM yr WHERE user_id = p_user),
like_counts AS (
  SELECT l.roll_id, COUNT(*)::int AS likes
  FROM roll_likes l
  JOIN mine m ON m.id = l.roll_id
  GROUP BY l.roll_id
),
-- Combo counts across the whole bar, with the newest drink names/logos
-- used for that combo (menus change, so "latest" is what people recognise).
bar_combos AS (
  SELECT red_die_number, white_die_number, COUNT(*)::int AS cnt,
         (ARRAY_AGG(red_drink_name   ORDER BY roll_time DESC))[1] AS red_name,
         (ARRAY_AGG(white_drink_name ORDER BY roll_time DESC))[1] AS white_name,
         (ARRAY_AGG(red_drink_logo   ORDER BY roll_time DESC))[1] AS red_logo,
         (ARRAY_AGG(white_drink_logo ORDER BY roll_time DESC))[1] AS white_logo
  FROM yr
  GROUP BY red_die_number, white_die_number
),
my_combos AS (
  SELECT red_die_number, white_die_number, COUNT(*)::int AS cnt, MAX(roll_time) AS last_time,
         (ARRAY_AGG(red_drink_name   ORDER BY roll_time DESC))[1] AS red_name,
         (ARRAY_AGG(white_drink_name ORDER BY roll_time DESC))[1] AS white_name,
         (ARRAY_AGG(red_drink_logo   ORDER BY roll_time DESC))[1] AS red_logo,
         (ARRAY_AGG(white_drink_logo ORDER BY roll_time DESC))[1] AS white_logo
  FROM mine
  GROUP BY red_die_number, white_die_number
),
my_nights AS (SELECT DISTINCT roll_date FROM mine),
islands AS (
  SELECT roll_date, roll_date - (ROW_NUMBER() OVER (ORDER BY roll_date))::int AS grp
  FROM my_nights
),
gaps AS (
  SELECT roll_date AS back_date, prev_date, (roll_date - prev_date)::int AS gap_days
  FROM (SELECT roll_date, LAG(roll_date) OVER (ORDER BY roll_date) AS prev_date FROM my_nights) t
  WHERE prev_date IS NOT NULL
),
-- Every roll this user has ever made, numbered, for the collection races
-- (those achievements are all-time, so the race is measured all-time too).
alltime AS (
  SELECT roll_date, red_die_number, white_die_number,
         ROW_NUMBER() OVER (ORDER BY roll_time, id)::int AS n
  FROM rolls
  WHERE user_id = p_user
),
combo_firsts AS (
  SELECT red_die_number, white_die_number, MIN(n) AS first_n
  FROM alltime GROUP BY red_die_number, white_die_number
),
red_firsts   AS (SELECT red_die_number   AS face, MIN(n) AS first_n FROM alltime GROUP BY 1),
white_firsts AS (SELECT white_die_number AS face, MIN(n) AS first_n FROM alltime GROUP BY 1),
twin_events AS (
  SELECT DISTINCT b.user_id AS partner, a.roll_date, a.red_die_number, a.white_die_number
  FROM mine a
  JOIN yr b
    ON b.roll_date = a.roll_date
   AND b.red_die_number = a.red_die_number
   AND b.white_die_number = a.white_die_number
   AND b.user_id <> a.user_id
),
rarity AS (
  SELECT achievement_id, COUNT(*)::int AS unlock_count
  FROM user_achievements
  WHERE completed_at IS NOT NULL
  GROUP BY achievement_id
),
roller_counts AS (
  SELECT user_id, COUNT(*)::int AS cnt FROM yr GROUP BY user_id
)
SELECT jsonb_build_object(
  'username',      (SELECT username FROM profiles WHERE id = p_user),
  'total_rolls',   (SELECT COUNT(*)::int FROM mine),
  'nights',        (SELECT COUNT(*)::int FROM my_nights),
  'doubles',       (SELECT COUNT(*)::int FROM mine WHERE is_doubles),
  'snake_eyes',    (SELECT COUNT(*)::int FROM mine WHERE red_die_number = 1 AND white_die_number = 1),
  'malort',        (SELECT COUNT(*)::int FROM mine
                    WHERE white_drink_name ILIKE '%malort%' OR white_drink_name ILIKE '%malört%'),
  'after_midnight',(SELECT COUNT(*)::int FROM mine WHERE night_min >= 1140),

  'red_freq', (
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY f)
    FROM generate_series(1, 8) f
    LEFT JOIN (SELECT red_die_number AS d, COUNT(*)::int AS cnt FROM mine GROUP BY 1) c ON c.d = f
  ),
  'white_freq', (
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY f)
    FROM generate_series(1, 8) f
    LEFT JOIN (SELECT white_die_number AS d, COUNT(*)::int AS cnt FROM mine GROUP BY 1) c ON c.d = f
  ),
  -- Nights per weekday, 0 = Sunday (by bar-night date).
  'dow_nights', (
    SELECT jsonb_agg(COALESCE(c.cnt, 0) ORDER BY f)
    FROM generate_series(0, 6) f
    LEFT JOIN (SELECT EXTRACT(DOW FROM roll_date)::int AS d, COUNT(*)::int AS cnt
               FROM my_nights GROUP BY 1) c ON c.d = f
  ),

  'rollers',        (SELECT COUNT(*)::int FROM roller_counts),
  'rollers_ahead',  (SELECT COUNT(*)::int FROM roller_counts
                     WHERE cnt > (SELECT COUNT(*) FROM mine)),

  'signature_combo', (
    SELECT jsonb_build_object(
      'red', red_die_number, 'white', white_die_number, 'count', cnt,
      'red_name', red_name, 'white_name', white_name,
      'red_logo', red_logo, 'white_logo', white_logo)
    FROM my_combos
    ORDER BY cnt DESC, last_time DESC
    LIMIT 1
  ),
  'combos_seen', (SELECT COUNT(*)::int FROM my_combos),
  'ghosted_combo', (
    SELECT jsonb_build_object(
      'red', b.red_die_number, 'white', b.white_die_number, 'count', b.cnt,
      'red_name', b.red_name, 'white_name', b.white_name,
      'red_logo', b.red_logo, 'white_logo', b.white_logo)
    FROM bar_combos b
    WHERE NOT EXISTS (
      SELECT 1 FROM my_combos m
      WHERE m.red_die_number = b.red_die_number AND m.white_die_number = b.white_die_number
    )
    ORDER BY b.cnt DESC
    LIMIT 1
  ),

  -- Collection races. `done_at` = the user's all-time roll number when the
  -- set was completed (null if not yet), `done_date` = that roll's night.
  'around_the_world', (
    SELECT jsonb_build_object(
      'seen', COUNT(*)::int,
      'done_at', CASE WHEN COUNT(*) = 64 THEN MAX(first_n) END,
      'done_date', CASE WHEN COUNT(*) = 64 THEN
        (SELECT roll_date FROM alltime WHERE n = (SELECT MAX(first_n) FROM combo_firsts)) END)
    FROM combo_firsts
  ),
  'double_trouble', (
    SELECT jsonb_build_object(
      'seen', COUNT(*)::int,
      'done_at', CASE WHEN COUNT(*) = 8 THEN MAX(first_n) END,
      'done_date', CASE WHEN COUNT(*) = 8 THEN
        (SELECT roll_date FROM alltime WHERE n = MAX(cf.first_n)) END,
      'missing', (SELECT COALESCE(jsonb_agg(f ORDER BY f), '[]'::jsonb)
                  FROM generate_series(1, 8) f
                  WHERE NOT EXISTS (SELECT 1 FROM combo_firsts x
                                    WHERE x.red_die_number = f AND x.white_die_number = f)))
    FROM combo_firsts cf
    WHERE cf.red_die_number = cf.white_die_number
  ),
  'punch_card', (
    SELECT jsonb_build_object(
      'seen', (SELECT COUNT(*) FROM red_firsts) + (SELECT COUNT(*) FROM white_firsts),
      'done_at', done_at,
      'done_date', (SELECT roll_date FROM alltime WHERE n = done_at))
    FROM (
      SELECT CASE WHEN (SELECT COUNT(*) FROM red_firsts) = 8 AND (SELECT COUNT(*) FROM white_firsts) = 8
                  THEN GREATEST((SELECT MAX(first_n) FROM red_firsts), (SELECT MAX(first_n) FROM white_firsts))
             END AS done_at
    ) t
  ),

  'clock', (
    SELECT jsonb_build_object(
      'median_min', ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY night_min))::int,
      'earliest_min', MIN(night_min),
      'latest_min', MAX(night_min))
    FROM mine
  ),
  'earliest_roll', (
    SELECT jsonb_build_object('date', roll_date, 'night_min', night_min)
    FROM mine ORDER BY night_min, roll_time LIMIT 1
  ),
  'latest_roll', (
    SELECT jsonb_build_object('date', roll_date, 'night_min', night_min)
    FROM mine ORDER BY night_min DESC, roll_time LIMIT 1
  ),

  'longest_streak', (
    SELECT jsonb_build_object('start', MIN(roll_date), 'end', MAX(roll_date), 'nights', COUNT(*)::int)
    FROM islands
    GROUP BY grp
    ORDER BY COUNT(*) DESC, MIN(roll_date)
    LIMIT 1
  ),
  'longest_drought', (
    SELECT jsonb_build_object(
      'from', g.prev_date, 'to', g.back_date, 'days', g.gap_days,
      'comeback', (
        SELECT jsonb_build_object(
          'red', m.red_die_number, 'white', m.white_die_number,
          'red_name', m.red_drink_name, 'white_name', m.white_drink_name,
          'red_logo', m.red_drink_logo, 'white_logo', m.white_drink_logo)
        FROM mine m WHERE m.roll_date = g.back_date
        ORDER BY m.roll_time LIMIT 1))
    FROM gaps g
    ORDER BY g.gap_days DESC, g.back_date DESC
    LIMIT 1
  ),

  'twinsies_events', (
    SELECT COUNT(*)::int FROM (SELECT DISTINCT roll_date, red_die_number, white_die_number FROM twin_events) t
  ),
  'twin_partner', (
    SELECT jsonb_build_object('username', p.username, 'events', t.cnt)
    FROM (SELECT partner, COUNT(*)::int AS cnt FROM twin_events GROUP BY partner) t
    JOIN profiles p ON p.id = t.partner
    ORDER BY t.cnt DESC, p.username
    LIMIT 1
  ),
  'night_partner', (
    SELECT jsonb_build_object('username', p.username, 'nights', t.cnt)
    FROM (
      SELECT y.user_id, COUNT(DISTINCT y.roll_date)::int AS cnt
      FROM yr y
      WHERE y.user_id <> p_user AND y.roll_date IN (SELECT roll_date FROM my_nights)
      GROUP BY y.user_id
    ) t
    JOIN profiles p ON p.id = t.user_id
    ORDER BY t.cnt DESC, p.username
    LIMIT 1
  ),

  'likes_received', (SELECT COALESCE(SUM(likes), 0)::int FROM like_counts),
  'likes_given', (
    SELECT COUNT(*)::int FROM roll_likes l JOIN yr y ON y.id = l.roll_id
    WHERE l.user_id = p_user AND y.user_id <> p_user
  ),
  'most_liked_roll', (
    SELECT jsonb_build_object(
      'likes', lc.likes, 'date', m.roll_date, 'is_doubles', m.is_doubles,
      'is_daily_double', m.is_daily_double,
      'red', m.red_die_number, 'white', m.white_die_number,
      'red_name', m.red_drink_name, 'white_name', m.white_drink_name,
      'red_logo', m.red_drink_logo, 'white_logo', m.white_drink_logo)
    FROM like_counts lc JOIN mine m ON m.id = lc.roll_id
    ORDER BY lc.likes DESC, m.roll_time DESC
    LIMIT 1
  ),

  'achievements', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', a.id, 'name', a.name, 'emoji', a.emoji,
      'category_name', a.category_name, 'category_emoji', a.category_emoji,
      'completed_at', ua.completed_at,
      'unlock_count', COALESCE(r.unlock_count, 0)
    ) ORDER BY ua.completed_at), '[]'::jsonb)
    FROM user_achievements ua
    JOIN achievements a ON a.id = ua.achievement_id
    LEFT JOIN rarity r ON r.achievement_id = ua.achievement_id
    WHERE ua.user_id = p_user
      AND ua.completed_at >= p_start
      AND ua.completed_at < p_end + 1
  ),
  'punch_cards_this_year', (
    SELECT COUNT(*)::int FROM punch_card_completions
    WHERE user_id = p_user AND earned_at >= p_start AND earned_at < p_end + 1
  ),
  'total_users', (SELECT COUNT(*)::int FROM profiles)
);
$$;

REVOKE ALL ON FUNCTION public.get_wrapped(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_wrapped(uuid, date, date) TO authenticated;


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
    VALUES ('075', 'wrapped')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
