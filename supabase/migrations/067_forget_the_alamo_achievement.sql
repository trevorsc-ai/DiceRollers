-- Forget the Alamo: roll a Modelo (red die) + Espolón (white die) on the same roll
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES (
  'forget_the_alamo', 'Forget the Alamo', '🏯',
  'Roll a Modelo and an Espolón in the same roll',
  'special_combos', 'Special Combinations', '👯', NULL, 120
);

-- Backfill: grant to users who already rolled this combo (earliest qualifying roll per user)
WITH first_match AS (
  SELECT DISTINCT ON (user_id) user_id, id AS roll_id, roll_time
  FROM rolls
  WHERE red_drink_name = 'Modelo' AND white_drink_name = 'Espolon'
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'forget_the_alamo', 1, roll_time, roll_id
FROM first_match
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress           = 1,
      completed_at       = EXCLUDED.completed_at,
      earned_on_roll_id  = EXCLUDED.earned_on_roll_id,
      updated_at         = NOW();
