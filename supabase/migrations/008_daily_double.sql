-- ============================================================
-- Add daily_double flag to rolls + seed Daily Double menu items
-- ============================================================

-- Update die_color check constraint to allow 'daily_double'
ALTER TABLE menu_items DROP CONSTRAINT menu_items_die_color_check;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_die_color_check CHECK (die_color = ANY (ARRAY['red'::text, 'white'::text, 'daily_double'::text]));

-- Add is_daily_double column (false by default for all existing rolls)
ALTER TABLE rolls ADD COLUMN is_daily_double BOOLEAN NOT NULL DEFAULT false;

-- Add Daily Double menu items using die_color = 'daily_double'
INSERT INTO menu_items (die_color, die_number, drink_name, is_active)
VALUES
  ('daily_double', 1, 'Old Time Lager', true),
  ('daily_double', 2, 'Tullamore Dew', true);
