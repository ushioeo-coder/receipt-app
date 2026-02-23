-- ============================================================
-- Supabase Storage バケット初期設定
-- Supabaseダッシュボード > SQL Editor で実行してください
-- ============================================================

-- 1. 動画アップロード用バケット（非公開）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  false,
  209715200,  -- 200MB
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- 2. 領収書画像バケット（非公開）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipt-images',
  'receipt-images',
  false,
  10485760,  -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Excel/CSV出力バケット（非公開）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,
  52428800,  -- 50MB
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Row Level Security (RLS) ポリシー
-- ※ service_role_key で操作するためポリシーは最小限に設定
-- ============================================================

-- videos バケット: service_role のみ
CREATE POLICY "service_role_all_videos"
  ON storage.objects FOR ALL
  USING (bucket_id = 'videos')
  WITH CHECK (bucket_id = 'videos');

-- receipt-images バケット: service_role のみ
CREATE POLICY "service_role_all_receipt_images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'receipt-images')
  WITH CHECK (bucket_id = 'receipt-images');

-- exports バケット: service_role のみ
CREATE POLICY "service_role_all_exports"
  ON storage.objects FOR ALL
  USING (bucket_id = 'exports')
  WITH CHECK (bucket_id = 'exports');
