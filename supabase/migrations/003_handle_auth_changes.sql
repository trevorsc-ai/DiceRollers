-- ============================================================
-- Migration 003: Handle-only auth changes
-- - Case-insensitive uniqueness on profiles.username
-- - Add optional recovery_email column
-- - Update handle_new_user trigger to lowercase username
-- ============================================================

-- ─── CASE-INSENSITIVE UNIQUENESS ─────────────────────────────
-- Drop the old btree unique constraint (case-sensitive)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;

-- Add a case-insensitive unique index instead
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
  ON public.profiles (lower(username));

-- ─── RECOVERY EMAIL ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recovery_email TEXT;

-- ─── UPDATE TRIGGER: LOWERCASE USERNAME ──────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    lower(COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── NORMALIZE EXISTING USERNAMES ────────────────────────────
-- Lowercase any existing usernames to avoid case conflicts
UPDATE public.profiles SET username = lower(username)
  WHERE username != lower(username);
