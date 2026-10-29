-- ============================================================
-- Halloween shots menu
--
-- Adds a menu_set column so the white die can swap between the
-- regular shots and a special Halloween set. Halloween mode is
-- "on" whenever any active row has menu_set = 'halloween'.
-- Toggled from /admin/menu via set_halloween_menu(enabled).
--
-- Idempotent: safe to re-run in the Supabase SQL Editor.
-- ============================================================

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS menu_set TEXT NOT NULL DEFAULT 'regular';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'menu_items_menu_set_check'
  ) THEN
    ALTER TABLE public.menu_items
      ADD CONSTRAINT menu_items_menu_set_check
      CHECK (menu_set IN ('regular', 'halloween', 'archived'));
  END IF;
END $$;

-- Stale inactive rows are kept out of the toggle swap so re-activating the
-- regular set can never collide with menu_items_active_slot_idx.
UPDATE public.menu_items
SET menu_set = 'archived'
WHERE is_active = false AND menu_set = 'regular';

-- Seed the Halloween shots (inactive until toggled on)
INSERT INTO public.menu_items (die_color, die_number, drink_name, is_active, menu_set)
SELECT 'white', v.die_number, v.drink_name, false, 'halloween'
FROM (VALUES
  (1, 'Barrel-Aged Malört'),
  (2, 'Ferrari (Campari + Fernet)'),
  (3, 'Ryenar (Rye + Cynar)'),
  (4, 'Compromise (Tully + GM)'),
  (5, 'Newport (Mezcal + Fernet)'),
  (6, 'Rumnar (Aged Rum + Cynar)'),
  (7, 'Mini Mind Eraser'),
  (8, 'Amaro di Angostura')
) AS v(die_number, drink_name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.menu_items m
  WHERE m.menu_set = 'halloween' AND m.die_color = 'white' AND m.die_number = v.die_number
);

-- Swap the active white-die set. SECURITY INVOKER so menu_items RLS
-- (admin-only update) still applies; the explicit check gives a clear error.
CREATE OR REPLACE FUNCTION public.set_halloween_menu(enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can change the menu';
  END IF;

  -- Deactivate the outgoing set first so the active-slot unique index never sees two rows.
  UPDATE public.menu_items
  SET is_active = false
  WHERE die_color = 'white'
    AND menu_set = CASE WHEN enabled THEN 'regular' ELSE 'halloween' END
    AND is_active = true;

  UPDATE public.menu_items
  SET is_active = true
  WHERE die_color = 'white'
    AND menu_set = CASE WHEN enabled THEN 'halloween' ELSE 'regular' END
    AND is_active = false;
END;
$$;

REVOKE ALL ON FUNCTION public.set_halloween_menu(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_halloween_menu(boolean) TO authenticated;

-- This file may be applied by hand in the SQL Editor; record it so
-- `supabase migration list` doesn't report drift.
DO $$
BEGIN
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('072', 'halloween_menu')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;
