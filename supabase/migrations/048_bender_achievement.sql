-- Insert achievement definition only — no backfill
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'bender', 'Bender', '🤖',
  '3 nights in a row. You''re a machine.',
  'clocking_in', 'Clocking In', '⏰', NULL, 141
);
