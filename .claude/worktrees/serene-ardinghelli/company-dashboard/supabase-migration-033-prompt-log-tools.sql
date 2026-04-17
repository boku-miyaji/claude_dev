-- Migration 033: Add tools_used to prompt_log
-- Stores which Claude Code tools were used for the PREVIOUS prompt
-- (flushed on next UserPromptSubmit)

ALTER TABLE prompt_log ADD COLUMN IF NOT EXISTS tools_used JSONB;
-- Format: {"Read": 5, "Edit": 2, "Bash": 3, "Grep": 1}
ALTER TABLE prompt_log ADD COLUMN IF NOT EXISTS tool_count INTEGER;
