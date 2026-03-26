-- Add Friday Night Lights achievement

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
('friday_night_lights', 'Friday Night Lights', '💡',
 'Roll dice on a Friday night',
 'clocking_in', 'Clocking In', '⏰', NULL, 142);

-- ── Backfill ──────────────────────────────────────────────────────────────────

-- Friday Night Lights: rolled on a Friday (DOW = 5 in Postgres: 0=Sun…6=Sat)
INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at)
SELECT user_id, 'friday_night_lights', 1, MIN(roll_time)
FROM rolls
WHERE EXTRACT(DOW FROM roll_date) = 5
GROUP BY user_id
ON CONFLICT (user_id, achievement_id) DO UPDATE
  SET progress = 1, completed_at = EXCLUDED.completed_at, updated_at = NOW();
