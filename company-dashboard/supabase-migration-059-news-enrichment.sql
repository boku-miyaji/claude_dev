-- Migration 059: news_items に日本語化用カラムを追加
--
-- 目的:
--   Hacker News 等は title が英語で summary が「Score: X, Comments: Y」と
--   なっていて意味がない。記事 URL を後追いで取得 → LLM で日本語要約 +
--   タイトル翻訳を生成し、UI で表示できるようにする。
--
-- 設計:
--   - title_ja: 日本語に翻訳されたタイトル（なければ UI は title を表示）
--   - summary は enrichment 後に日本語要約で上書きする
--   - enriched_at: enrichment 済みかの判定（NULL = 未処理）

ALTER TABLE news_items
  ADD COLUMN IF NOT EXISTS title_ja text,
  ADD COLUMN IF NOT EXISTS enriched_at timestamptz;

-- 未 enrichment の行を高速に引くための部分 index
CREATE INDEX IF NOT EXISTS idx_news_items_enriched
  ON news_items (enriched_at) WHERE enriched_at IS NULL;

COMMENT ON COLUMN news_items.title_ja IS '日本語に翻訳されたタイトル。news-enrich Edge Function が生成';
COMMENT ON COLUMN news_items.enriched_at IS 'enrichment 実行日時。NULL なら未処理';
