-- Stuck in the Matrix (craps_table) - roll the exact same combo three times in
-- the same night. Natural escalation of Deja Vu (twice in a night).

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
  ('stuck_in_the_matrix', 'Stuck in the Matrix', '💻',
   'Roll the exact same combo three times in the same night',
   'craps_table', 'The Craps Table', '🎰', NULL, 61);
