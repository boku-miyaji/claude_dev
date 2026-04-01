-- Migration 028: Chat personalization settings
-- Stores user preferences for AI Chat response style (ChatGPT-inspired)

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_nickname TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_occupation TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_about TEXT;          -- free-text about the user
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_style TEXT DEFAULT 'default';  -- default/formal/casual/concise/detailed
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_warmth TEXT DEFAULT 'default'; -- default/warm/neutral/direct
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_emoji TEXT DEFAULT 'default';  -- default/none/some/lots
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_custom_instructions TEXT;      -- free-text custom instructions
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_memory_enabled BOOLEAN DEFAULT true;  -- use knowledge_base + insights
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS chat_diary_enabled BOOLEAN DEFAULT true;   -- use diary entries for context
