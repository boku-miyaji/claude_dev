-- ============================================================
-- Migration 009: マルチサーバー対応
-- ============================================================
-- claude_settings に server_host カラムを追加。
-- scope が hostname:dir 形式になり、複数サーバー・ディレクトリを区別。
-- ============================================================

-- Add server_host column
alter table claude_settings add column if not exists server_host text;

-- Index for filtering by host
create index if not exists idx_claude_settings_host on claude_settings(server_host);
