-- Drop deprecated puzzles feature.
-- Replaces 020_puzzles_table.sql. The admin/puzzles page and MickeysPuzzleModal
-- have been removed from the app.

DROP TRIGGER IF EXISTS puzzles_updated_at ON public.puzzles;
DROP FUNCTION IF EXISTS update_puzzles_updated_at();
DROP TABLE IF EXISTS public.puzzles;
