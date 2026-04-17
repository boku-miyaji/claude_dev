-- Migration 056: ceo_insights に source カラム追加
--
-- 背景:
--   ceo_insights には HD（仕事の組織運営）由来のものと、
--   focus-you（個人プロダクト）由来のものが混在していた。
--   AIチャットには product 由来のみ注入したいので区別する。
--
-- 区分:
--   work    - HD/組織運営由来（claude_code prompt_log、/company hook 等）
--   product - focus-you 由来（diary 分析、ai_chat prompt_log 分析）

ALTER TABLE ceo_insights
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'work'
    CHECK (source IN ('work', 'product'));

CREATE INDEX IF NOT EXISTS idx_ceo_insights_source ON ceo_insights(source);

-- 既存レコードはすべて 'work' 扱い（DEFAULT で自動適用）
