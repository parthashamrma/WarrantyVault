-- ====================================================================
-- WarrantyVault: Storage Configuration and Policies
-- Private "warranty-docs" bucket (Max 5MB, PDF/JPG/PNG only)
-- Restricted folder access: {user_id}/{warranty_id}/{random_file}
-- ====================================================================

-- 1. CREATE PRIVATE STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'warranty-docs',
  'warranty-docs',
  false,
  5242880, -- 5 MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

-- 2. STORAGE OBJECT POLICIES (Users can only touch files in their own user_id directory)
DROP POLICY IF EXISTS "Users can read own warranty documents" ON storage.objects;
CREATE POLICY "Users can read own warranty documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can upload own warranty documents" ON storage.objects;
CREATE POLICY "Users can upload own warranty documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own warranty documents" ON storage.objects;
CREATE POLICY "Users can update own warranty documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own warranty documents" ON storage.objects;
CREATE POLICY "Users can delete own warranty documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'warranty-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

