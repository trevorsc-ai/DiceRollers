-- ============================================================
-- Seed all 16 achievement definitions
-- ============================================================

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES

-- ── YOU'RE A REGULAR ──────────────────────────────────────────────────
('malort_advent_calendar', 'Malort Advent Calendar', '📅',
 'Get Malort 25 times',
 'youre_a_regular', "You're a Regular", '💎', 25, 10),

('the_punch_card', 'The Punch Card', '🎟️',
 'Roll each number 1–8 on both the red and white die',
 'youre_a_regular', "You're a Regular", '💎', 16, 20),

('double_trouble', 'Double Trouble', '😈',
 'Roll all 8 unique doubles (1-1 through 8-8)',
 'youre_a_regular', "You're a Regular", '💎', 8, 30),

('around_the_world', 'Around the World', '🌎',
 'Roll all 64 unique die combinations',
 'youre_a_regular', "You're a Regular", '💎', 64, 40),

-- ── THE CRAPS TABLE ──────────────────────────────────────────────────
('feeling_lucky', 'Feeling Lucky', '🍀',
 'Roll doubles twice in a row',
 'craps_table', 'The Craps Table', '🎰', NULL, 50),

('on_fire', 'On Fire', '🔥',
 'Roll doubles three times in a row',
 'craps_table', 'The Craps Table', '🎰', NULL, 60),

('deja_vu', 'Deja Vu', '🔮',
 'Roll the exact same combo twice in the same night',
 'craps_table', 'The Craps Table', '🎰', NULL, 70),

-- ── SPECIAL COMBINATIONS ─────────────────────────────────────────────
('high_abv', 'HIGH ABV', '🥴',
 'Roll Raging Bitch + Rumple Minze in one roll',
 'special_combos', 'Special Combinations', '👯', NULL, 80),

('the_freshman', 'The Freshman', '📓',
 'Roll Whiteclaw + Espolon in one roll',
 'special_combos', 'Special Combinations', '👯', NULL, 90),

('chicago_charcuterie', 'Chicago Charcuterie', '🌭',
 'Roll High Life + Malort in one roll',
 'special_combos', 'Special Combinations', '👯', NULL, 100),

('the_regular', 'The Regular', '🤙',
 'Roll Mickeys + Malort in one roll',
 'special_combos', 'Special Combinations', '👯', NULL, 110),

-- ── CLOCKING IN ──────────────────────────────────────────────────────
('early_bird', 'Early Bird', '🐦',
 'Roll between 5:00–5:59 PM',
 'clocking_in', 'Clocking In', '⏰', NULL, 120),

('night_owl', 'Night Owl', '🦉',
 'Roll between 1:00–3:59 AM',
 'clocking_in', 'Clocking In', '⏰', NULL, 130),

-- ── DANGER ZONE ──────────────────────────────────────────────────────
('run_it_back', 'Run It Back', '🏃',
 'Roll twice in one night',
 'danger_zone', 'Danger Zone', '⚠️', NULL, 140),

('power_hour', 'Power Hour', '⏳',
 'Roll twice within 60 minutes',
 'danger_zone', 'Danger Zone', '⚠️', NULL, 150),

('slow_down', 'Slow Down', '😵‍💫',
 'Roll three times within 60 minutes',
 'danger_zone', 'Danger Zone', '⚠️', NULL, 160);
