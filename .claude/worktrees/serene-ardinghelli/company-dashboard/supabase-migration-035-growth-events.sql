-- ============================================================
-- Migration 035: growth_events テーブル（成長記録）
-- ============================================================
-- 目的: 会社運営の「失敗→対策→進化」の軌跡を構造化して記録する
-- タイムラインUIで時系列表示し、因果関係を parent_id で紐づける
-- ============================================================

-- ============================================================
-- Step 1: growth_events テーブル作成
-- ============================================================
CREATE TABLE IF NOT EXISTS growth_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  event_date DATE NOT NULL,

  -- 分類
  event_type TEXT NOT NULL CHECK (event_type IN ('failure', 'countermeasure', 'milestone')),
  category TEXT NOT NULL CHECK (category IN ('security', 'architecture', 'devops', 'automation', 'tooling', 'organization', 'process', 'quality', 'communication')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  phase TEXT,

  -- ストーリー
  title TEXT NOT NULL,
  what_happened TEXT NOT NULL,
  root_cause TEXT,
  countermeasure TEXT,
  result TEXT,

  -- 紐づき
  parent_id UUID REFERENCES growth_events(id),
  company_id TEXT,
  related_commits TEXT[] DEFAULT '{}',
  related_migrations TEXT[] DEFAULT '{}',

  -- メトリクス（対策前後の比較）
  metric_before JSONB,
  metric_after JSONB,

  -- メタ
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'recurring'))
);

-- ============================================================
-- Step 2: インデックス
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_growth_events_date ON growth_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_growth_events_type ON growth_events(event_type);
CREATE INDEX IF NOT EXISTS idx_growth_events_category ON growth_events(category);
CREATE INDEX IF NOT EXISTS idx_growth_events_parent ON growth_events(parent_id);
CREATE INDEX IF NOT EXISTS idx_growth_events_phase ON growth_events(phase);

-- ============================================================
-- Step 3: RLS
-- ============================================================
ALTER TABLE growth_events ENABLE ROW LEVEL SECURITY;

-- authenticated (owner) can do everything
CREATE POLICY "owner_all_growth_events" ON growth_events
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- anon can insert with ingest key (for Hook/automation)
CREATE POLICY "anon_insert_growth_events" ON growth_events
  FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

-- ============================================================
-- Step 4: コメント
-- ============================================================
COMMENT ON TABLE growth_events IS '会社運営の成長記録。失敗→対策→進化の軌跡をタイムラインで可視化';
COMMENT ON COLUMN growth_events.event_type IS 'failure: 問題発生, countermeasure: 対策実施, milestone: 成果達成';
COMMENT ON COLUMN growth_events.parent_id IS 'failure→countermeasure→milestone の因果チェーン';
COMMENT ON COLUMN growth_events.phase IS '時期区分（例: Phase 1: 誕生期）';
