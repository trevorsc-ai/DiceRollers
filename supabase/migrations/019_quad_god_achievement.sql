-- Add "The Quad God" achievement to the Danger Zone category

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
('the_quad_god', 'The Quad God', '⛸️',
 'Roll quad times in one night',
 'danger_zone', 'Danger Zone', '⚠️', NULL, 146);
