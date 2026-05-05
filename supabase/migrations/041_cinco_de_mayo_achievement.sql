-- Add Cinco de Mayo hidden achievement
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order, hidden)
VALUES
  ('cinco_de_mayo', 'Cinco de Drinko', '🇲🇽', 'Roll on Cinco de Mayo (May 5)', 'holiday', 'Holidays', '🎁', NULL, 313, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Backfill for users who already rolled on May 5
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id, updated_at)
SELECT DISTINCT ON (user_id)
  user_id, 'cinco_de_mayo', 1, roll_time, id, NOW()
FROM rolls
WHERE EXTRACT(MONTH FROM roll_date) = 5 AND EXTRACT(DAY FROM roll_date) = 5
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;
