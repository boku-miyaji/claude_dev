-- ============================================================
-- Migration 063: intelligence_suggestions テーブル
-- ============================================================
-- 目的: 情報収集部が出す「focus-you への示唆」を蓄積・管理する
-- 設計書: .company/departments/ai-dev/design/intelligence-suggestions-schema.md
--
-- ステータス: new → checked → adopted/rejected → implemented
--             [別ルート] new → dismissed
--
-- Note: tasks.id は integer のため task_id も integer で参照する
--       （設計書は UUID 想定だが実装で合わせる）
-- ============================================================

-- ============================================================
-- Step 1: テーブル作成
-- ============================================================
CREATE TABLE IF NOT EXISTS intelligence_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 本体
  title TEXT NOT NULL,
  description TEXT,

  -- 属性
  priority TEXT CHECK (priority IN ('high','medium','low')),
  effort TEXT CHECK (effort IN ('small','medium','large')),
  category TEXT, -- algorithm / architecture / ux / cost / competition / design / other

  -- ソース（どのレポートから来たか）
  source_report_path TEXT,
  source_report_date DATE,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ステータス
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','checked','adopted','rejected','implemented','dismissed')),

  -- tasks リンク（checked にしたとき INSERT される tasks.id）
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,

  -- タイムスタンプ
  checked_at TIMESTAMPTZ,
  adopted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  implemented_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Step 2: インデックス
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_intelligence_suggestions_status
  ON intelligence_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_intelligence_suggestions_source_date
  ON intelligence_suggestions(source_report_date DESC);
CREATE INDEX IF NOT EXISTS idx_intelligence_suggestions_priority
  ON intelligence_suggestions(priority);

-- 冪等性のための部分 UNIQUE（title + source_report_path の組が重複しない）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_intelligence_suggestions_source
  ON intelligence_suggestions(title, source_report_path)
  WHERE source_report_path IS NOT NULL;

-- ============================================================
-- Step 3: updated_at トリガー
-- ============================================================
DROP TRIGGER IF EXISTS intelligence_suggestions_updated_at ON intelligence_suggestions;
CREATE TRIGGER intelligence_suggestions_updated_at
  BEFORE UPDATE ON intelligence_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Step 4: RLS
-- ============================================================
ALTER TABLE intelligence_suggestions ENABLE ROW LEVEL SECURITY;

-- Owner は全操作可
DROP POLICY IF EXISTS "owner_full" ON intelligence_suggestions;
CREATE POLICY "owner_full" ON intelligence_suggestions
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- anon は x-ingest-key で INSERT / UPDATE / SELECT 可
-- （情報収集部の ingest スクリプト、ダッシュボードからの読み取り用）
DROP POLICY IF EXISTS "anon_insert_intelligence_suggestions_with_key" ON intelligence_suggestions;
CREATE POLICY "anon_insert_intelligence_suggestions_with_key"
  ON intelligence_suggestions FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_update_intelligence_suggestions_with_key" ON intelligence_suggestions;
CREATE POLICY "anon_update_intelligence_suggestions_with_key"
  ON intelligence_suggestions FOR UPDATE TO anon
  USING (public.check_ingest_key())
  WITH CHECK (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_select_intelligence_suggestions_with_key" ON intelligence_suggestions;
CREATE POLICY "anon_select_intelligence_suggestions_with_key"
  ON intelligence_suggestions FOR SELECT TO anon
  USING (public.check_ingest_key());

-- ============================================================
-- 確認用クエリ
-- ============================================================
-- SELECT policyname, tablename, cmd
-- FROM pg_policies
-- WHERE tablename = 'intelligence_suggestions'
-- ORDER BY policyname;
--
-- 期待される結果（4ポリシー）:
--   owner_full                                           | ALL
--   anon_insert_intelligence_suggestions_with_key        | INSERT
--   anon_update_intelligence_suggestions_with_key        | UPDATE
--   anon_select_intelligence_suggestions_with_key        | SELECT
-- ============================================================
