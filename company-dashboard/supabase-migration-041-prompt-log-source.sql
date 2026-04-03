-- Migration 041: Add source column to prompt_log to distinguish origin
-- Values: 'claude_code' (Hook), 'ai_chat' (Dashboard AI Chat)

ALTER TABLE prompt_log ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'claude_code';

CREATE INDEX IF NOT EXISTS idx_prompt_log_source ON prompt_log(source);
