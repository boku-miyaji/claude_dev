-- ============================================================
-- Migration 034: 請求書PDFストレージ
-- ============================================================
-- Supabase Storage に invoices バケットを作成し、
-- ダッシュボードからのPDFアップロードを可能にする。
-- ============================================================

-- バケット作成（非公開）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760,  -- 10MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anon ユーザーによるアップロード・読み取り許可
CREATE POLICY "anon_upload_invoices" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "anon_select_invoices" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'invoices');

CREATE POLICY "anon_delete_invoices" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'invoices');
