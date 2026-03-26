-- Add Hump Day, Saturday Night Fever, and Case of the Mondays achievements

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
('case_of_the_mondays', 'Case of the Mondays', '🤒',
 'Roll on a Monday',
 'clocking_in', 'Clocking In', '⏰', NULL, 139),

('hump_day', 'Hump Day', '🐪',
 'Roll on a Wednesday',
 'clocking_in', 'Clocking In', '⏰', NULL, 140),

('saturday_night_fever', 'Saturday Night Fever', '🪩',
 'Roll on a Saturday',
 'clocking_in', 'Clocking In', '⏰', NULL, 141);

-- ── Backfill ──────────────────────────────────────────────────────────────

-- Case of the Mondays: rolled on a Monday (DOW = 1 in Postgres: 0=Sun…6=Sat)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'case_of_the_mondays', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 1
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Hump Day: rolled on a Wednesday (DOW = 3)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'hump_day', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 3
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();

-- Saturday Night Fever: rolled on a Saturday (DOW = 6)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'saturday_night_fever', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 6
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();
