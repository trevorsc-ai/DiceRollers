-- Add 13 new achievements across all categories

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES

-- ── YOU'RE A REGULAR ──────────────────────────────────────────────────
('ring_gong', 'Hit the Gong', '🔔',
 'Roll for the first time',
 'youre_a_regular', 'You''re a Regular', '💎', NULL, 5),

('fifty_fabulous', 'Fifty & Fabulous', '🌟',
 'Record 50 total rolls',
 'youre_a_regular', 'You''re a Regular', '💎', 50, 42),

('century_club', 'Century Club', '💯',
 'Record 100 total rolls',
 'youre_a_regular', 'You''re a Regular', '💎', 100, 43),

('daily_double_devotee', 'Daily Double Devotee', '💛',
 'Take the Daily Double 10 times',
 'youre_a_regular', 'You''re a Regular', '💎', 10, 44),

('the_contrarian', 'The Contrarian', '🙅',
 'Decline the Daily Double 10 times',
 'youre_a_regular', 'You''re a Regular', '💎', 10, 45),

-- ── THE CRAPS TABLE ───────────────────────────────────────────────────
('snake_eyes', 'Snake Eyes', '🐍',
 'Roll double 1s',
 'craps_table', 'The Craps Table', '🎰', NULL, 75),

('boxcars', 'Boxcars', '🚃',
 'Roll double 8s',
 'craps_table', 'The Craps Table', '🎰', NULL, 76),

('hot_dice', 'Hot Dice', '♨️',
 'Roll 3 or more doubles in a single night',
 'craps_table', 'The Craps Table', '🎰', NULL, 77),

-- ── CLOCKING IN ──────────────────────────────────────────────────────
('sunday_funday', 'Sunday Funday', '☀️',
 'Roll on a Sunday',
 'clocking_in', 'Clocking In', '⏰', NULL, 136),

('taco_tuesday', 'Taco Tuesday', '🌮',
 'Roll on a Tuesday',
 'clocking_in', 'Clocking In', '⏰', NULL, 137),

('trivia_thursday', 'Trivia Thursday', '🧠',
 'Roll on a Thursday',
 'clocking_in', 'Clocking In', '⏰', NULL, 138),

-- ── DANGER ZONE ──────────────────────────────────────────────────────
('the_legend', 'The Legend', '👑',
 'Roll 5 or more times in one night',
 'danger_zone', 'Danger Zone', '⚠️', NULL, 147),

('malort_three_peat', 'Malort Three-Peat', '😰',
 'Roll Malort 3 times in one night',
 'danger_zone', 'Danger Zone', '⚠️', NULL, 148);
