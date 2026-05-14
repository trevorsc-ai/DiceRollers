-- Insert achievement definition only — no backfill (0 users currently qualify)
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'my_new_home', 'My New Home', '🏠',
  '7 days straight of rolling.... Sheesh',
  'clocking_in', 'Clocking In', '⏰', NULL, 142
);
