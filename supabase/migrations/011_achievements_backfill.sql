-- ============================================================
-- Backfill aggregate + historical achievements for existing users
-- Skips streak/window-based ones (feeling_lucky, on_fire,
-- power_hour, slow_down) — those are earned going forward.
-- ============================================================

-- ── malort_advent_calendar: COUNT where white_die_number = 6 ─────────
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT
  user_id,
  'malort_advent_calendar',
  COUNT(*)::int,
  CASE WHEN COUNT(*) >= 25 THEN NOW() ELSE NULL END
FROM rolls
WHERE white_die_number = 6
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = EXCLUDED.progress,
      completed_at = EXCLUDED.completed_at,
      updated_at = NOW();

-- ── the_punch_card: distinct red + white numbers hit ─────────────────
INSERT INTO user_achievements (user_id, achievement_id, progress, progress_detail, completed_at)
SELECT
  user_id,
  'the_punch_card',
  (cardinality(red_nums) + cardinality(white_nums))::int,
  jsonb_build_object('red', to_jsonb(red_nums), 'white', to_jsonb(white_nums)),
  CASE WHEN (cardinality(red_nums) + cardinality(white_nums)) >= 16 THEN NOW() ELSE NULL END
FROM (
  SELECT
    user_id,
    ARRAY(
      SELECT DISTINCT unnest(array_agg(red_die_number)) ORDER BY 1
    ) AS red_nums,
    ARRAY(
      SELECT DISTINCT unnest(array_agg(white_die_number)) ORDER BY 1
    ) AS white_nums
  FROM rolls
  GROUP BY user_id
) t
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = EXCLUDED.progress,
      progress_detail = EXCLUDED.progress_detail,
      completed_at = EXCLUDED.completed_at,
      updated_at = NOW();

-- ── double_trouble: unique doubles rolled ────────────────────────────
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT
  user_id,
  'double_trouble',
  COUNT(DISTINCT red_die_number)::int,
  CASE WHEN COUNT(DISTINCT red_die_number) >= 8 THEN NOW() ELSE NULL END
FROM rolls
WHERE is_doubles = true
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = EXCLUDED.progress,
      completed_at = EXCLUDED.completed_at,
      updated_at = NOW();

-- ── around_the_world: unique (red, white) combos ────────────────────
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT
  user_id,
  'around_the_world',
  COUNT(DISTINCT (red_die_number, white_die_number))::int,
  CASE WHEN COUNT(DISTINCT (red_die_number, white_die_number)) >= 64 THEN NOW() ELSE NULL END
FROM rolls
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = EXCLUDED.progress,
      completed_at = EXCLUDED.completed_at,
      updated_at = NOW();

-- ── Special Combinations ─────────────────────────────────────────────
-- HIGH ABV
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'high_abv', 1, MIN(roll_time)
FROM rolls
WHERE red_drink_name = 'Raging Bitch' AND white_drink_name = 'Rumple Minze'
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- The Freshman
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'the_freshman', 1, MIN(roll_time)
FROM rolls
WHERE red_drink_name = 'Whiteclaw' AND white_drink_name = 'Espolon'
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Chicago Charcuterie
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'chicago_charcuterie', 1, MIN(roll_time)
FROM rolls
WHERE red_drink_name = 'High Life' AND white_drink_name = 'Malort'
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- The Regular
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'the_regular', 1, MIN(roll_time)
FROM rolls
WHERE red_drink_name = 'Mickeys' AND white_drink_name = 'Malort'
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- ── Clocking In ──────────────────────────────────────────────────────
-- Early Bird: 5:00–5:59 PM (hour = 17 in NY time)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'early_bird', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(HOUR FROM roll_time AT TIME ZONE 'America/New_York') = 17
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Night Owl: 1:00–3:59 AM (hours 1–3 in NY time)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'night_owl', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(HOUR FROM roll_time AT TIME ZONE 'America/New_York') BETWEEN 1 AND 3
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- ── Deja Vu: same combo twice in one night ───────────────────────────
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT DISTINCT ON (user_id) user_id, 'deja_vu', 1, MIN(roll_time) OVER (PARTITION BY user_id)
FROM (
  SELECT
    user_id,
    roll_date,
    red_die_number,
    white_die_number,
    roll_time,
    COUNT(*) OVER (
      PARTITION BY user_id, roll_date, red_die_number, white_die_number
    ) AS combo_count
  FROM rolls
) t
WHERE combo_count >= 2
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- ── Run It Back: 2+ rolls same night ────────────────────────────────
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT DISTINCT ON (user_id) user_id, 'run_it_back', 1, MIN(roll_time)
FROM (
  SELECT user_id, roll_date, MIN(roll_time) AS roll_time, COUNT(*) AS night_count
  FROM rolls
  GROUP BY user_id, roll_date
  HAVING COUNT(*) >= 2
) t
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();
