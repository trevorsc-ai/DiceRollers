-- ============================================================
-- Jackie Lee's Dice Roll Tracker — Storage: drink-logos bucket
-- ============================================================

-- Create the drink-logos bucket (public so logo URLs are accessible without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('drink-logos', 'drink-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read logos (needed for public URLs to work)
CREATE POLICY "logos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'drink-logos');

-- Only admins can upload logos
CREATE POLICY "logos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'drink-logos' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can update (upsert) logos
CREATE POLICY "logos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'drink-logos' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Only admins can delete logos
CREATE POLICY "logos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'drink-logos' AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
