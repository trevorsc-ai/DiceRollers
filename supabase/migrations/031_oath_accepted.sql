-- Add oath_accepted_at to profiles so we know when users agreed to the Dice Roll Oath
ALTER TABLE public.profiles
  ADD COLUMN oath_accepted_at timestamptz DEFAULT NULL;

-- Backfill existing users: they implicitly agreed by already using the app
UPDATE public.profiles
  SET oath_accepted_at = created_at
  WHERE oath_accepted_at IS NULL;
