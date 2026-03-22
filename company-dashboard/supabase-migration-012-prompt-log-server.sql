-- ============================================================
-- Migration 012: Add server tracking to prompt_log
-- ============================================================
-- Adds server_host and cwd columns to prompt_log so we can
-- identify which server/directory each prompt originated from.
-- Also enables company_id inference from cwd path.
-- ============================================================

-- Add server tracking columns
alter table prompt_log add column if not exists server_host text;
alter table prompt_log add column if not exists cwd text;

-- Index for server-based analysis
create index if not exists idx_prompt_log_server on prompt_log(server_host);
