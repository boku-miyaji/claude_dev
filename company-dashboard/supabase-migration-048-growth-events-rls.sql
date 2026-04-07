-- ============================================================
-- Migration 048: growth_events の RLS ポリシー追加
-- ============================================================
-- growth_events テーブルは RLS 有効だがポリシーが未設定だったため
-- 全てのINSERT/SELECTが拒否されていた。

-- Authenticated users
CREATE POLICY "growth_events_owner" ON growth_events
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Ingest key (hooks/scripts)
CREATE POLICY "growth_events_ingest" ON growth_events
  FOR ALL USING (
    current_setting('request.headers', true)::json->>'x-ingest-key' IS NOT NULL
  );
