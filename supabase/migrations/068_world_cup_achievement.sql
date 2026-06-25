-- Once Every Four Years: roll during the FIFA World Cup (hidden/secret)
INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order, hidden)
VALUES (
  'world_cup', 'Once Every Four Years', '🏟️',
  'Roll during the FIFA World Cup',
  'holiday', 'Holidays', '🎁', NULL, 313, TRUE
);

-- Backfill: grant to users who already rolled during the 2026 World Cup (Jun 11 – Jul 19)
-- Add future date ranges here when announced (2030, 2034, etc.)
WITH first_match AS (
  SELECT DISTINCT ON (user_id) user_id, id AS roll_id, roll_time
  FROM rolls
  WHERE roll_date BETWEEN '2026-06-11' AND '2026-07-19'
  ORDER BY user_id, roll_time ASC
)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at, earned_on_roll_id)
SELECT user_id, 'world_cup', 1, roll_time, roll_id
FROM first_match
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress           = 1,
      completed_at       = EXCLUDED.completed_at,
      earned_on_roll_id  = EXCLUDED.earned_on_roll_id,
      updated_at         = NOW();
