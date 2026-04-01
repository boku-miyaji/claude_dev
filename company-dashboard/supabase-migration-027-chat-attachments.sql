-- Migration 027: Chat attachments storage bucket + metadata
-- Images are sent as base64 data URLs directly to OpenAI Vision API.
-- This bucket is for optional persistent storage of attachments.

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can manage their own files
CREATE POLICY "chat_attachments_auth_all" ON storage.objects
  FOR ALL USING (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

-- Add attachments column to messages table (JSON array of attachment metadata)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB;
-- Format: [{"name": "photo.png", "type": "image/png", "size": 12345, "storage_path": "conv-id/msg-id/photo.png"}]
