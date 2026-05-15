-- Expand holiday achievement windows:
-- "Spirit of Giving" now earnable any day of Christmas week (Sun–Sat containing Dec 25)
-- "Grateful Dead" now earnable any day of Thanksgiving week (Sun–Sat containing Thanksgiving)
UPDATE achievements SET description = 'Roll during Christmas week'    WHERE id = 'christmas';
UPDATE achievements SET description = 'Roll during Thanksgiving week' WHERE id = 'thanksgiving';
