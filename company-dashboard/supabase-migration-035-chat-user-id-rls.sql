-- ============================================================
-- Migration 035: Chat tables — add user_id + uid-based RLS
-- Adds user_id column to conversations, messages, chat_usage
-- and replaces role-based RLS with uid-based policies.
-- ============================================================

-- === Add user_id columns (default to current auth user) ===
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE chat_usage ADD COLUMN IF NOT EXISTS user_id UUID;

-- Backfill existing rows: set user_id to the first authenticated user
-- (single-user system — safe to assign all existing data to the owner)
DO $$
DECLARE owner_uid UUID;
BEGIN
  SELECT id INTO owner_uid FROM auth.users ORDER BY created_at LIMIT 1;
  IF owner_uid IS NOT NULL THEN
    UPDATE conversations SET user_id = owner_uid WHERE user_id IS NULL;
    UPDATE messages SET user_id = owner_uid WHERE user_id IS NULL;
    UPDATE chat_usage SET user_id = owner_uid WHERE user_id IS NULL;
  END IF;
END $$;

-- === Drop old role-based policies ===
DROP POLICY IF EXISTS "conversations_auth_all" ON conversations;
DROP POLICY IF EXISTS "messages_auth_all" ON messages;
DROP POLICY IF EXISTS "chat_usage_auth_all" ON chat_usage;

-- === Create uid-based policies ===
CREATE POLICY "conversations_owner" ON conversations
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "messages_owner" ON messages
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chat_usage_owner" ON chat_usage
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Keep ingest policies for Edge Function server-side writes (service role bypasses RLS anyway)
-- No changes needed for ingest policies.

-- === Indexes for user_id lookups ===
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_usage_user_date ON chat_usage(user_id, date);
