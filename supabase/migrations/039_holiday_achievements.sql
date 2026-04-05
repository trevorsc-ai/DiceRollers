-- Step 1: Add hidden column to achievements table
ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 2: Insert 13 holiday achievements (all hidden)
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order, hidden)
VALUES
  ('new_years_day',    'New Year, New Roll',  '🥂', 'Roll on New Year''s Day',            'holiday', 'Holidays', '🎁', NULL, 300, TRUE),
  ('valentines_day',   'Drunk in Love',       '❤️', 'Roll on Valentine''s Day',           'holiday', 'Holidays', '🎁', NULL, 301, TRUE),
  ('leap_day',         'Leap of Faith',       '🐸', 'Roll on Leap Day (Feb 29)',          'holiday', 'Holidays', '🎁', NULL, 302, TRUE),
  ('pi_day',           'Easy as Pi',          '🥧', 'Roll on Pi Day (Mar 14)',            'holiday', 'Holidays', '🎁', NULL, 303, TRUE),
  ('st_patricks_day',  'Luck of the Dice',    '☘️', 'Roll on St. Patrick''s Day',         'holiday', 'Holidays', '🎁', NULL, 304, TRUE),
  ('april_fools',      'No Joke',             '🃏', 'Roll on April Fools'' Day',          'holiday', 'Holidays', '🎁', NULL, 305, TRUE),
  ('easter',           'Hoppy Hour',          '🐰', 'Roll on Easter Sunday',              'holiday', 'Holidays', '🎁', NULL, 306, TRUE),
  ('independence_day', 'Liberty Rolls',       '🇺🇸', 'Roll on the Fourth of July',        'holiday', 'Holidays', '🎁', NULL, 307, TRUE),
  ('halloween',        'Trick or Drink',      '🎃', 'Roll on Halloween',                  'holiday', 'Holidays', '🎁', NULL, 308, TRUE),
  ('thanksgiving',     'Grateful Dead',       '🦃', 'Roll on Thanksgiving',               'holiday', 'Holidays', '🎁', NULL, 309, TRUE),
  ('christmas',        'Spirit of Giving',    '🎄', 'Roll on Christmas Day',              'holiday', 'Holidays', '🎁', NULL, 310, TRUE),
  ('new_years_eve',    'Last Call',           '🥳', 'Roll on New Year''s Eve',            'holiday', 'Holidays', '🎁', NULL, 311, TRUE),
  ('friday_13th',      'Unlucky Roller',      '💀', 'Roll on a Friday the 13th',          'holiday', 'Holidays', '🎁', NULL, 312, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Backfill user_achievements for users who already rolled on past holiday dates
-- Uses earliest qualifying roll per user per achievement

-- New Year's Day (Jan 1)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'new_years_day', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 1 AND EXTRACT(DAY FROM roll_date) = 1
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Valentine's Day (Feb 14)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'valentines_day', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 2 AND EXTRACT(DAY FROM roll_date) = 14
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Leap Day (Feb 29)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'leap_day', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 2 AND EXTRACT(DAY FROM roll_date) = 29
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Pi Day (Mar 14)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'pi_day', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 3 AND EXTRACT(DAY FROM roll_date) = 14
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- St. Patrick's Day (Mar 17)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'st_patricks_day', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 3 AND EXTRACT(DAY FROM roll_date) = 17
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- April Fools' Day (Apr 1)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'april_fools', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 4 AND EXTRACT(DAY FROM roll_date) = 1
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Easter (variable date — enumerate known dates)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'easter', 1, roll_time, id, NOW()
FROM rolls
WHERE roll_date IN ('2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16')
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Independence Day (Jul 4)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'independence_day', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 7 AND EXTRACT(DAY FROM roll_date) = 4
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Halloween (Oct 31)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'halloween', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 10 AND EXTRACT(DAY FROM roll_date) = 31
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Thanksgiving (4th Thursday of November — enumerate known dates)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'thanksgiving', 1, roll_time, id, NOW()
FROM rolls
WHERE roll_date IN ('2024-11-28', '2025-11-27', '2026-11-27', '2027-11-25', '2028-11-23')
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Christmas (Dec 25)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'christmas', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 12 AND EXTRACT(DAY FROM roll_date) = 25
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- New Year's Eve (Dec 31)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'new_years_eve', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 12 AND EXTRACT(DAY FROM roll_date) = 31
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- Friday the 13th (day=13 and day-of-week=Friday)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'friday_13th', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(DAY FROM roll_date) = 13
  AND EXTRACT(DOW FROM roll_date) = 5
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;
