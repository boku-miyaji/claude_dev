-- ============================================================
-- Migration 067: interest_articles ユーザーが気になった記事を登録
-- ============================================================
-- 目的:
--   ユーザーが手動で気になった記事 URL + メモを登録し、
--   情報収集部の gap 分析結果（なぜ自動収集できなかったか）を蓄積する。
--
-- 既存パターン:
--   - RLS: is_owner() + check_ingest_key() の組合せ（migration 066 に準拠）
-- ============================================================

CREATE TABLE IF NOT EXISTS public.interest_articles (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  url             TEXT        NOT NULL,
  title           TEXT,
  notes           TEXT,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  source_domain   TEXT        GENERATED ALWAYS AS (
    CASE WHEN url ~ '^https?://'
    THEN regexp_replace(regexp_replace(url, '^https?://(www\.)?', ''), '/.*$', '')
    ELSE null END
  ) STORED,
  analyzed        BOOLEAN     NOT NULL DEFAULT false,
  gap_reason      TEXT,
  gap_type        TEXT        CHECK (gap_type IN ('missing_domain','missing_keyword','already_covered','missing_x_account')),
  added_to_sources BOOLEAN    NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interest_articles_user
  ON public.interest_articles(user_id, created_at DESC);

ALTER TABLE public.interest_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_articles" ON public.interest_articles;
CREATE POLICY "own_articles" ON public.interest_articles
  FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- gap 分析結果の PATCH をバッチ（anon + ingest key）から書き込む
DROP POLICY IF EXISTS "anon_insert_interest_articles_with_key" ON public.interest_articles;
CREATE POLICY "anon_insert_interest_articles_with_key" ON public.interest_articles
  FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_select_interest_articles_with_key" ON public.interest_articles;
CREATE POLICY "anon_select_interest_articles_with_key" ON public.interest_articles
  FOR SELECT TO anon
  USING (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_update_interest_articles_with_key" ON public.interest_articles;
CREATE POLICY "anon_update_interest_articles_with_key" ON public.interest_articles
  FOR UPDATE TO anon
  USING (public.check_ingest_key()) WITH CHECK (public.check_ingest_key());

-- ============================================================
-- 確認用クエリ
-- ============================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename = 'interest_articles'
-- ORDER BY policyname;
