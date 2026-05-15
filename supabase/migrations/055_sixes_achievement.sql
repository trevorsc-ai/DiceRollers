-- Add SIXES!! achievement to The Craps Table group
-- Sits between Snake Eyes (75) and Boxcars (76→77), Hot Dice (77→78)

UPDATE achievements SET sort_order = 78 WHERE id = 'hot_dice';
UPDATE achievements SET sort_order = 77 WHERE id = 'boxcars';

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'sixes',
  'SIXES!!',
  '6️⃣',
  'SIXES!!',
  'craps_table', 'The Craps Table', '🎰',
  NULL,
  76
);

-- Backfill: award to each user whose earliest double 6s roll
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT DISTINCT ON (user_id)
  user_id,
  'sixes',
  1,
  roll_time,
  id
FROM rolls
WHERE is_doubles = true
  AND red_die_number = 6
ORDER BY user_id, roll_time ASC
ON CONFLICT (user_id, achievement_id) DO NOTHING;
