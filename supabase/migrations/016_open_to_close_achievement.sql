-- Add "Open to Close" achievement to the Clocking In category

INSERT INTO achievements (id, name, emoji, description, category, category_name, category_emoji, target_count, sort_order)
VALUES
('open_to_close', 'Open to Close', '⏱️',
 'Do a dice roll between 5–6 PM and 1–2 AM in the same night',
 'clocking_in', 'Clocking In', '⏰', NULL, 135);
