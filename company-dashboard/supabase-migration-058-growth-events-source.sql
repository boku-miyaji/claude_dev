-- ============================================================
-- Migration 057: growth_events に source カラム追加
-- ============================================================
-- 目的: 記録元の区別（手動 / 自動検知 / 日次ダイジェスト / 過去backfill）
-- ============================================================

ALTER TABLE growth_events
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'detector', 'daily-digest', 'backfill'));

CREATE INDEX IF NOT EXISTS idx_growth_events_source ON growth_events(source);

COMMENT ON COLUMN growth_events.source IS
  'Record origin: manual (migration or UI), detector (keyword hook), daily-digest (daily batch), backfill (historical import)';
