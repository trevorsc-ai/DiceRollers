-- Add "Hat Trick" achievement to the Danger Zone category

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
('hat_trick', 'Hat Trick', '⚽',
 'Roll thrice in one night',
 'danger_zone', 'Danger Zone', '⚠️', NULL, 145);
