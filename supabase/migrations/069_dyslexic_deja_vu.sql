-- Dyslexic Déjà Vu (craps_table) - roll a combo, then immediately roll its
-- exact inverse (red/white swapped), back-to-back in the same night.
-- Doubles don't count — a double's "inverse" is itself.

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
  ('dyslexic_deja_vu', 'Dyslexic Déjà Vu', '🪞',
   'Roll a combo, then immediately roll it backwards (doubles don''t count)',
   'craps_table', 'The Craps Table', '🎰', NULL, 55);
