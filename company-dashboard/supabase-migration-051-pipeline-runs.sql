-- ============================================================
-- Migration 051: Pipeline runs + correction log
-- ============================================================
-- 目的: AlphaEvolve 進化ループのフィットネス評価に必要な
--       パイプライン実績データを蓄積するテーブルを作成する。
--
-- pipeline_runs: パイプライン実行ごとの記録
-- correction_log: 社長の差し戻し・修正指示の記録
-- ============================================================

-- ============================================================
-- 1. pipeline_runs テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id          serial PRIMARY KEY,
  company_id  text REFERENCES companies(id) ON DELETE SET NULL,
  pipeline_type text NOT NULL
    CHECK (pipeline_type IN ('A', 'B', 'C', 'D', 'E')),
  task_id     integer REFERENCES tasks(id) ON DELETE SET NULL,
  complexity  text NOT NULL DEFAULT 'medium'
    CHECK (complexity IN ('small', 'medium', 'large')),
  task_summary text,
  execution_mode text
    CHECK (execution_mode IN ('full-auto', 'checkpoint', 'step-by-step')),

  -- ステップ詳細: [{dept, step, estimated_min, actual_min, status}]
  steps       jsonb NOT NULL DEFAULT '[]',

  -- 時間計測
  total_estimated_minutes numeric,
  total_actual_minutes    numeric,
  accuracy_pct            numeric
    CHECK (accuracy_pct IS NULL OR (accuracy_pct >= 0 AND accuracy_pct <= 100)),

  -- 結果
  outcome              text CHECK (outcome IN ('success', 'partial', 'failure')),
  corrections_count    integer NOT NULL DEFAULT 0,
  first_time_ok        boolean,
  notes                text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- RLS
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

-- authenticated ユーザーは全操作可
CREATE POLICY "pipeline_runs_auth"
  ON pipeline_runs FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- anon + x-ingest-key でフック・スクリプトから書き込み可
CREATE POLICY "pipeline_runs_ingest"
  ON pipeline_runs FOR ALL TO anon
  USING  (public.check_ingest_key())
  WITH CHECK (public.check_ingest_key());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_type
  ON pipeline_runs (pipeline_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_task
  ON pipeline_runs (task_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_outcome
  ON pipeline_runs (outcome, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_created
  ON pipeline_runs (created_at DESC);

COMMENT ON TABLE pipeline_runs IS 'パイプライン（A/B/C/D/E）の実行記録。AlphaEvolve フィットネス評価の基礎データ。';
COMMENT ON COLUMN pipeline_runs.pipeline_type IS 'A:新機能開発 / B:バグ修正 / C:資料作成 / D:調査 / E:セキュリティ';
COMMENT ON COLUMN pipeline_runs.steps IS '[{dept, step, estimated_min, actual_min, status}] 形式のJSON';
COMMENT ON COLUMN pipeline_runs.accuracy_pct IS '見積もり精度 = (1 - |actual - estimated| / estimated) * 100';
COMMENT ON COLUMN pipeline_runs.first_time_ok IS '差し戻しなしで完了した場合 true';

-- ============================================================
-- 2. correction_log テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS correction_log (
  id              serial PRIMARY KEY,
  pipeline_run_id integer REFERENCES pipeline_runs(id) ON DELETE SET NULL,
  task_id         integer REFERENCES tasks(id) ON DELETE SET NULL,
  dept            text,  -- どの部署の成果物が差し戻されたか
  correction_type text
    CHECK (correction_type IN ('rework', 'style', 'logic', 'scope', 'missing')),
  description     text,  -- 何がダメだったか
  severity        text NOT NULL DEFAULT 'normal'
    CHECK (severity IN ('minor', 'normal', 'major')),
  source_prompt   text,  -- 社長の発言（先頭 500 文字）
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE correction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "correction_log_auth"
  ON correction_log FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "correction_log_ingest"
  ON correction_log FOR ALL TO anon
  USING  (public.check_ingest_key())
  WITH CHECK (public.check_ingest_key());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_correction_log_pipeline_run
  ON correction_log (pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_correction_log_dept
  ON correction_log (dept, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_correction_log_type
  ON correction_log (correction_type, created_at DESC);

COMMENT ON TABLE correction_log IS '社長の修正指示・差し戻し記録。部署ごとの一発OK率・連携効率の評価に使用。';
COMMENT ON COLUMN correction_log.correction_type IS 'rework:やり直し / style:スタイル修正 / logic:論理修正 / scope:スコープ逸脱 / missing:成果物不足';

-- ============================================================
-- 3. 便利ビュー: パイプライン統計サマリー
-- ============================================================

CREATE OR REPLACE VIEW pipeline_summary AS
SELECT
  pipeline_type,
  COUNT(*)                                              AS total_runs,
  COUNT(*) FILTER (WHERE outcome = 'success')          AS success_count,
  COUNT(*) FILTER (WHERE outcome = 'partial')          AS partial_count,
  COUNT(*) FILTER (WHERE outcome = 'failure')          AS failure_count,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE outcome = 'success') / NULLIF(COUNT(*), 0),
    1
  )                                                     AS success_rate_pct,
  ROUND(AVG(corrections_count), 2)                     AS avg_corrections,
  ROUND(100.0 * COUNT(*) FILTER (WHERE first_time_ok) / NULLIF(COUNT(*), 0), 1)
                                                        AS first_time_ok_rate_pct,
  ROUND(AVG(accuracy_pct), 1)                          AS avg_accuracy_pct,
  MAX(completed_at)                                    AS last_run_at
FROM pipeline_runs
GROUP BY pipeline_type
ORDER BY pipeline_type;

COMMENT ON VIEW pipeline_summary IS 'パイプライン種別ごとの成功率・一発OK率・見積もり精度サマリー';
