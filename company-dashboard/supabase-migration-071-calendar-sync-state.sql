-- supabase-migration-071-calendar-sync-state.sql
-- Calendar sync watermark テーブル。
--
-- 用途:
--   /backfill (Edge Function google-calendar-proxy) が calendar_id ごとに
--   upsert する watermark。/company ブリーフィングや freshness-policy が
--   「最後に同期したのはいつか」「成功したか」を確認して stale 検知に使う。
--
-- 設計判断:
--   - PRIMARY KEY = (user_id, calendar_id) で 1 ユーザー × 1 カレンダー = 1 行
--   - last_sync_status は 'success' | 'partial' | 'error' の 3値
--   - last_error は 200 文字以内の error 概要（詳細ログは Edge Function ログ参照）
--   - RLS は select_own のみ。書き込みは service_role（Edge Function 内）から行う
--   - service_role は RLS bypass されるので明示ポリシー不要

CREATE TABLE IF NOT EXISTS calendar_sync_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id text NOT NULL,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  last_sync_status text NOT NULL DEFAULT 'success',
  last_error text,
  fetched_count int NOT NULL DEFAULT 0,
  saved_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, calendar_id)
);

COMMENT ON TABLE calendar_sync_state IS
  'Calendar sync watermark. /backfill が calendar_id ごとに upsert する。stale 検知用。';
COMMENT ON COLUMN calendar_sync_state.last_sync_status IS
  'success/partial/error。partial=一部カレンダーで HTTP エラーがあったが他は OK';
COMMENT ON COLUMN calendar_sync_state.last_error IS
  'エラー時のメッセージ概要（200文字以内）。詳細は Edge Function ログ参照';

ALTER TABLE calendar_sync_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calendar_sync_state_select_own" ON calendar_sync_state;
CREATE POLICY "calendar_sync_state_select_own"
  ON calendar_sync_state FOR SELECT
  USING (user_id = auth.uid());
