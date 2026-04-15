-- Migration 062: request attachments
-- Adds attachments JSONB to tasks and creates request-attachments storage bucket.
-- Attachment shape: [{"path": "<uid>/<ts>-<idx>.<ext>", "type": "image/png", "size": 12345, "name": "screenshot.png"}]

-- 1. Column on tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Storage bucket (private, user-scoped via RLS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('request-attachments', 'request-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies — first path segment must equal auth.uid()
DROP POLICY IF EXISTS "request-attachments-select" ON storage.objects;
CREATE POLICY "request-attachments-select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "request-attachments-insert" ON storage.objects;
CREATE POLICY "request-attachments-insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'request-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "request-attachments-update" ON storage.objects;
CREATE POLICY "request-attachments-update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

DROP POLICY IF EXISTS "request-attachments-delete" ON storage.objects;
CREATE POLICY "request-attachments-delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'request-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );
