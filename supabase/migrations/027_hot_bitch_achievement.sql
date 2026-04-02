-- Add the Hot Bitch achievement (Raging Bitch red=1 + Hot Hooch white=8)

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'hot_bitch', 'Hot Bitch', '💋',
  'Roll Raging Bitch + Hot Hooch in one roll',
  'special_combos', 'Special Combinations', '👯', NULL, 115
);

-- Backfill: award to any user who has already rolled this combo
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'hot_bitch', 1, MIN(roll_time)
FROM rolls
WHERE red_drink_name = 'Raging Bitch'
  AND white_drink_name = 'Hot Hooch'
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();
