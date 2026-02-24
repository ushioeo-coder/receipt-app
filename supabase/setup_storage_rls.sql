-- Supabase Storage RLS ポリシー設定
-- Supabase SQL Editor で実行してください

-- ① videos バケット
CREATE POLICY "videos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "videos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "videos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ② receipt-images バケット
CREATE POLICY "receipt_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipt-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "receipt_images_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipt-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ③ exports バケット
CREATE POLICY "exports_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "exports_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);
