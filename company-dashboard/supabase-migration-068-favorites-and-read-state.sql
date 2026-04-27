-- ============================================================
-- Migration 068: お気に入り + 既読 + Zennまとめ参照
-- ============================================================
-- 目的:
--   - artifacts (research レポート) にお気に入り + 既読を追加
--   - interest_articles と news_items にも既読を追加（既読単位は全タブ統一）
--   - interest_articles → どの Zenn まとめ記事に含まれたかを参照できるように
--
-- 既存パターン:
--   - 全カラムに IF NOT EXISTS で冪等
--   - 既存 RLS / index は壊さない
-- ============================================================

-- artifacts: お気に入り + 既読
ALTER TABLE public.artifacts
  ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS read_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_artifacts_favorite
  ON public.artifacts(is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_artifacts_unread
  ON public.artifacts(read_at) WHERE read_at IS NULL;

-- interest_articles: 既読 + Zennまとめ参照
ALTER TABLE public.interest_articles
  ADD COLUMN IF NOT EXISTS read_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zenn_artifact_id INTEGER REFERENCES public.artifacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interest_articles_unread
  ON public.interest_articles(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_interest_articles_pending_zenn
  ON public.interest_articles(zenn_artifact_id) WHERE zenn_artifact_id IS NULL;

-- news_items: 既読
ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_news_items_unread
  ON public.news_items(read_at) WHERE read_at IS NULL;

-- ============================================================
-- 確認用クエリ
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public'
--   AND table_name IN ('artifacts','interest_articles','news_items')
--   AND column_name IN ('is_favorite','read_at','zenn_artifact_id')
-- ORDER BY table_name, column_name;
