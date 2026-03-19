-- ============================================================
-- Make is_public default to true for all users
-- ============================================================

-- Change column default so new signups are public
ALTER TABLE public.profiles
  ALTER COLUMN is_public SET DEFAULT true;

-- Update the trigger to explicitly set is_public = true for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, is_public)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make all existing private users public
UPDATE public.profiles
  SET is_public = true
  WHERE is_public = false;
