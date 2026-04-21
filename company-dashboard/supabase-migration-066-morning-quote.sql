-- ============================================================
-- Migration 066: Morning Quote 朝イチ名言機能
-- ============================================================
-- 目的:
--   朝6:30 JST のバッチが、前日の日記・感情分析からテーマを抽出し、
--   Claude CLI + WebSearch で名言を取得→スコアリング→ユーザー毎に1件/日を配信する。
--   お気に入り保存と Journal での一覧閲覧もサポート。
--
-- テーブル:
--   quotes                 - 名言マスタ（全ユーザー共有キャッシュ）
--   user_quote_deliveries  - 日次配信履歴 (冪等化: user_id + delivery_date UNIQUE)
--   user_quote_favorites   - お気に入り
--
-- 仕様上の重要な前提:
--   - 日記0件ユーザーにはフォールバック名言を配信しない（スターター名言プールは作らない）
--   - ユーザーが当日の名言を手動で再取得・再生成することはない（morning batch のみが配信する）
--   - diary_entries.id は INTEGER、emotion_analysis.diary_entry_id は BIGINT（既存の型を踏襲）
--
-- 既存パターン:
--   - RLS: is_owner() + check_ingest_key() の組合せ（migration 063 に準拠）
--   - updated_at トリガー: public.update_updated_at() を使用
-- ============================================================

-- ============================================================
-- テーブル 1: quotes（名言マスタ / キャッシュ）
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 名言本体
  body            TEXT        NOT NULL,
  body_lang       TEXT        NOT NULL CHECK (body_lang IN ('ja','en')),
  author          TEXT        NOT NULL,
  author_era      TEXT,                       -- "1960s" / "古代ギリシア" / "不明"
  source          TEXT,                       -- "小説『沈黙』より" など
  source_url      TEXT,                       -- Web検索で見つけた引用元URL

  -- 正規化・dedup
  -- dedup_key = SHA256(normalize(body) + '|' + normalize(author))
  -- 完全一致ではなく、引用符・句読点・敬称の差を吸収して重複判定する
  dedup_key       TEXT        NOT NULL,
  body_normalized TEXT        NOT NULL,       -- 検索用（正規化済み本文）

  -- LLM 付与タグ（バッチの Step 3c で付与）
  emotion_tags    TEXT[]      NOT NULL DEFAULT '{}',
                                              -- Plutchik ラベル（例: {'joy','trust'}）
  voice_tags      TEXT[]      NOT NULL DEFAULT '{}',
                                              -- needed_voice と対応: cheer/calm/challenge/company/permission/reframe
  theme_tags      TEXT[]      NOT NULL DEFAULT '{}',

  -- 検索キャッシュ（この名言に辿り着いた検索クエリの蓄積）
  source_queries  TEXT[]      NOT NULL DEFAULT '{}',

  -- 品質管理
  source_reliability REAL     NOT NULL DEFAULT 0.3 CHECK (source_reliability BETWEEN 0 AND 1),
  quality_score   REAL        NOT NULL DEFAULT 0.5,
  is_banned       BOOLEAN     NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- dedup
CREATE UNIQUE INDEX IF NOT EXISTS uniq_quotes_dedup ON quotes(dedup_key);

-- 配列検索（バッチのキャッシュ問合せで使う）
CREATE INDEX IF NOT EXISTS idx_quotes_emotion_tags ON quotes USING GIN (emotion_tags);
CREATE INDEX IF NOT EXISTS idx_quotes_voice_tags   ON quotes USING GIN (voice_tags);
CREATE INDEX IF NOT EXISTS idx_quotes_theme_tags   ON quotes USING GIN (theme_tags);
CREATE INDEX IF NOT EXISTS idx_quotes_queries      ON quotes USING GIN (source_queries);

-- updated_at トリガー
DROP TRIGGER IF EXISTS quotes_updated_at ON quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: quotes は全ユーザー共有マスタ
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_full" ON quotes;
CREATE POLICY "owner_full" ON quotes
  FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- authenticated は SELECT 自由（マスタなので owner に限らず読み取りOK）
DROP POLICY IF EXISTS "auth_read_quotes" ON quotes;
CREATE POLICY "auth_read_quotes" ON quotes
  FOR SELECT TO authenticated
  USING (true);

-- anon は x-ingest-key 前提（バッチの INSERT / SELECT / UPDATE 用）
DROP POLICY IF EXISTS "anon_insert_quotes_with_key" ON quotes;
CREATE POLICY "anon_insert_quotes_with_key" ON quotes
  FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_select_quotes_with_key" ON quotes;
CREATE POLICY "anon_select_quotes_with_key" ON quotes
  FOR SELECT TO anon
  USING (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_update_quotes_with_key" ON quotes;
CREATE POLICY "anon_update_quotes_with_key" ON quotes
  FOR UPDATE TO anon
  USING (public.check_ingest_key()) WITH CHECK (public.check_ingest_key());


-- ============================================================
-- テーブル 2: user_quote_deliveries（日次配信履歴）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_quote_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
                                              -- 単一ユーザー運用中は NULL 可
  quote_id          UUID REFERENCES quotes(id) ON DELETE SET NULL,
  delivery_date     DATE NOT NULL,

  -- スコアリング詳細（デバッグ用途）
  score             REAL,
  score_breakdown   JSONB,

  -- 由来（どの日記から選定したか）
  trigger_diary_entry_id INTEGER REFERENCES diary_entries(id) ON DELETE SET NULL,

  -- NULL = 通常フロー / 'no_diary' / 'llm_failed' / 'web_search_empty' / ...
  fallback_reason   TEXT,

  -- 将来のユーザー行動ログ用（現状の UI では未使用）
  shown_at          TIMESTAMPTZ,
  dismissed_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 冪等性: 同じ日に二重配信しない
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_quote_deliveries_daily
  ON user_quote_deliveries(user_id, delivery_date);

CREATE INDEX IF NOT EXISTS idx_user_quote_deliveries_user_date
  ON user_quote_deliveries(user_id, delivery_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_quote_deliveries_quote
  ON user_quote_deliveries(quote_id);

-- RLS
ALTER TABLE user_quote_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_full" ON user_quote_deliveries;
CREATE POLICY "owner_full" ON user_quote_deliveries
  FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "anon_insert_user_quote_deliveries_with_key" ON user_quote_deliveries;
CREATE POLICY "anon_insert_user_quote_deliveries_with_key" ON user_quote_deliveries
  FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_select_user_quote_deliveries_with_key" ON user_quote_deliveries;
CREATE POLICY "anon_select_user_quote_deliveries_with_key" ON user_quote_deliveries
  FOR SELECT TO anon
  USING (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_update_user_quote_deliveries_with_key" ON user_quote_deliveries;
CREATE POLICY "anon_update_user_quote_deliveries_with_key" ON user_quote_deliveries
  FOR UPDATE TO anon
  USING (public.check_ingest_key()) WITH CHECK (public.check_ingest_key());


-- ============================================================
-- テーブル 3: user_quote_favorites（お気に入り）
-- ============================================================
CREATE TABLE IF NOT EXISTS user_quote_favorites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  quote_id      UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  note          TEXT,                          -- 将来のユーザーメモ（任意）
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_quote_favorites
  ON user_quote_favorites(user_id, quote_id);
CREATE INDEX IF NOT EXISTS idx_user_quote_favorites_user
  ON user_quote_favorites(user_id, created_at DESC);

-- RLS: 原則ダッシュボード(authenticated)から操作。anon 不要
ALTER TABLE user_quote_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_full" ON user_quote_favorites;
CREATE POLICY "owner_full" ON user_quote_favorites
  FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============================================================
-- 確認用クエリ
-- ============================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('quotes','user_quote_deliveries','user_quote_favorites')
-- ORDER BY tablename, policyname;
