-- Four new one-time achievements:
--   mark_of_the_devil (craps_table)   – three 6s in a single night
--   shot_roulette     (craps_table)   – three different shots from a white 7
--   common_man        (special_combos) – High Life + Jim Beam on the same roll
--   fire_and_ice      (special_combos) – Hot Hooch + Rumple Minze in the same night

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
  ('mark_of_the_devil', 'Mark of the Devil', '👹',
   'Roll three 6s in a single night',
   'craps_table', 'The Craps Table', '🎰', NULL, 78),

  ('shot_roulette', 'Shot Roulette', '🎰',
   'Roll three different shots from a white 7',
   'craps_table', 'The Craps Table', '🎰', NULL, 79),

  ('common_man', 'Common Man', '👷‍♂️',
   'Roll High Life and Jim Beam on the same roll',
   'special_combos', 'Special Combinations', '👯', NULL, 116),

  ('fire_and_ice', 'Fire and Ice', '🥶',
   'Roll Hot Hooch and Rumple Minze in the same night',
   'special_combos', 'Special Combinations', '👯', NULL, 117);
