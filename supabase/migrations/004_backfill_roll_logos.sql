-- ============================================================
-- Jackie Lee's Dice Roll Tracker — Backfill roll logos
-- Updates rolls.red_drink_logo and rolls.white_drink_logo
-- using the current logo_url from menu_items, matched by drink name.
-- ============================================================

-- Update red drink logos
UPDATE public.rolls r
SET red_drink_logo = m.logo_url
FROM public.menu_items m
WHERE r.red_drink_name = m.drink_name
  AND m.logo_url IS NOT NULL
  AND (r.red_drink_logo IS NULL OR r.red_drink_logo <> m.logo_url);

-- Update white drink logos
UPDATE public.rolls r
SET white_drink_logo = m.logo_url
FROM public.menu_items m
WHERE r.white_drink_name = m.drink_name
  AND m.logo_url IS NOT NULL
  AND (r.white_drink_logo IS NULL OR r.white_drink_logo <> m.logo_url);
