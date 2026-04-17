-- ============================================================
-- Migration 048: self_analysis に analysis_context カラム追加
-- ============================================================
-- 目的: ハイブリッド分析方式の中間根拠を保存する。
-- 次回分析時に「前回の結論 + 根拠 + 新データ」で効率的に更新できるようにする。
-- ============================================================

ALTER TABLE self_analysis ADD COLUMN IF NOT EXISTS analysis_context JSONB;

COMMENT ON COLUMN self_analysis.analysis_context IS 'ハイブリッド分析の中間根拠。key_evidence(核心引用), data_stats(統計スナップショット), confidence_notes(確信度メモ)を保存。次回分析のコンテキストとして使用';
