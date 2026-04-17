-- ============================================================
-- Migration 047: messages テーブルに tool_call_id カラム追加
-- ============================================================
-- OpenAI API の tool message は tool_call_id が必須。
-- これがないとツール使用後の会話履歴を正しく復元できない。
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_call_id text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_input jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_tool_call_id ON messages(tool_call_id) WHERE tool_call_id IS NOT NULL;
