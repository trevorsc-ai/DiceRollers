-- New one-time achievement:
--   gen_alpha (special_combos) – roll a red 6 and white 7 on the same roll

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
  ('gen_alpha', 'Gen Alpha', '🙄',
   'Roll a red 6 and a white 7 in the same roll',
   'special_combos', 'Special Combinations', '👯', NULL, 118);
