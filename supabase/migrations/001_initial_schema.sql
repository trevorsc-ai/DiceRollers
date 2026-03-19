-- ============================================================
-- Jackie Lee's Dice Roll Tracker — Initial Schema
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE NOT NULL,
  is_admin    BOOLEAN NOT NULL DEFAULT false,
  is_public   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── MENU ITEMS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.menu_items (
  id          SERIAL PRIMARY KEY,
  die_color   TEXT NOT NULL CHECK (die_color IN ('red', 'white')),
  die_number  INT NOT NULL CHECK (die_number BETWEEN 1 AND 8),
  drink_name  TEXT NOT NULL,
  logo_url    TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active drink per die slot
CREATE UNIQUE INDEX IF NOT EXISTS menu_items_active_slot_idx
  ON public.menu_items (die_color, die_number)
  WHERE is_active = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS menu_items_updated_at ON public.menu_items;
CREATE TRIGGER menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ─── ROLLS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rolls (
  id                SERIAL PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  roll_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  roll_time         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  red_die_number    INT NOT NULL CHECK (red_die_number BETWEEN 1 AND 8),
  white_die_number  INT NOT NULL CHECK (white_die_number BETWEEN 1 AND 8),
  red_drink_name    TEXT NOT NULL,
  white_drink_name  TEXT NOT NULL,
  red_drink_logo    TEXT,
  white_drink_logo  TEXT,
  is_doubles        BOOLEAN NOT NULL GENERATED ALWAYS AS (red_die_number = white_die_number) STORED,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rolls_user_id_idx ON public.rolls (user_id);
CREATE INDEX IF NOT EXISTS rolls_roll_date_idx ON public.rolls (roll_date DESC);


-- ─── ROLL LIKES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roll_likes (
  id          SERIAL PRIMARY KEY,
  roll_id     INT NOT NULL REFERENCES public.rolls(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (roll_id, user_id)
);


-- ─── ROW LEVEL SECURITY ──────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_likes ENABLE ROW LEVEL SECURITY;

-- profiles: users can read their own profile always, and any public profile
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR is_public = true
  );

-- profiles: users can update only their own non-admin fields
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- profiles: admin bypass (service role can do anything via service key)

-- menu_items: all authenticated users can read
CREATE POLICY "menu_items_select" ON public.menu_items
  FOR SELECT TO authenticated USING (true);

-- menu_items: only admins can insert/update/delete
CREATE POLICY "menu_items_admin_insert" ON public.menu_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "menu_items_admin_update" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "menu_items_admin_delete" ON public.menu_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- rolls: users can insert their own rolls
CREATE POLICY "rolls_insert_own" ON public.rolls
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- rolls: users can always read their own rolls
-- rolls: users can read others' rolls only if that user is public
CREATE POLICY "rolls_select" ON public.rolls
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = rolls.user_id AND p.is_public = true
    )
  );

-- rolls: admins can read all rolls
CREATE POLICY "rolls_admin_select" ON public.rolls
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- roll_likes: authenticated users can insert/delete own likes
CREATE POLICY "roll_likes_insert" ON public.roll_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "roll_likes_delete" ON public.roll_likes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- roll_likes: anyone authenticated can read likes
CREATE POLICY "roll_likes_select" ON public.roll_likes
  FOR SELECT TO authenticated USING (true);


-- ─── SEED: DEFAULT MENU ──────────────────────────────────────

INSERT INTO public.menu_items (die_color, die_number, drink_name) VALUES
  ('red', 1, 'Raging Bitch'),
  ('red', 2, 'All Day IPA'),
  ('red', 3, 'District Commons'),
  ('red', 4, 'Duckpin'),
  ('red', 5, 'White Claw'),
  ('red', 6, 'Mickeys'),
  ('red', 7, 'Sea Quench'),
  ('red', 8, 'High Life'),
  ('white', 1, 'Jim Beam'),
  ('white', 2, 'Mezcal'),
  ('white', 3, 'Chacho'),
  ('white', 4, 'Jaegermeister'),
  ('white', 5, 'Rumple Minze'),
  ('white', 6, 'Malort'),
  ('white', 7, 'Bacardi Lime'),
  ('white', 8, 'Hot Hooch')
ON CONFLICT DO NOTHING;


-- ─── SEED: ADMIN USER ────────────────────────────────────────
-- NOTE: Run this via Supabase Dashboard → Authentication → Add User
-- then manually set is_admin=true, or use the service role key.
-- The admin user is: travis.scavone@protonmail.com / username: double6s
-- PASSWORD IS NOT STORED HERE — set it via Supabase Auth UI or CLI.

-- After creating the auth user, run this to grant admin:
-- UPDATE public.profiles SET is_admin = true WHERE username = 'double6s';
