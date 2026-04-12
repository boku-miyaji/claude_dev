-- Migration 061: diary_entries.embedding 列追加と類似検索 RPC
--
-- 目的:
--   「過去の自分カード」機能のため、各日記エントリを embedding ベクトルに変換し、
--   今書いている日記と意味が近い過去の日記を検索する。
--
--   コーチングが原理的にできない「ユーザーが忘れた範囲の自己」を提示する中核機能。
--   Embedding 検索のみで十分 (LLM 不要) なので、コストほぼゼロで実現できる。
--
-- モデル: OpenAI text-embedding-3-small (1536 次元)

-- pgvector 拡張は既に入っている (事前確認済み)
CREATE EXTENSION IF NOT EXISTS vector;

-- embedding 列 (nullable — バックフィル前は NULL)
ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 近似検索用の ivfflat インデックス (cosine distance)
-- 少数データでも機能する。データが増えたら lists を再調整する想定。
CREATE INDEX IF NOT EXISTS idx_diary_entries_embedding
  ON diary_entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- 類似日記検索 RPC
--   exclude_id: 自分自身を除外するため
--   days_ago_min: 直近ノイズを除く (デフォルト 14 日前より古いもののみ)
--   match_count: 返却件数
CREATE OR REPLACE FUNCTION match_similar_diary_entries(
  query_embedding vector(1536),
  exclude_id integer DEFAULT NULL,
  days_ago_min integer DEFAULT 14,
  match_count integer DEFAULT 3
)
RETURNS TABLE (
  id integer,
  entry_date date,
  body text,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    d.id,
    d.entry_date,
    d.body,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM diary_entries d
  WHERE d.embedding IS NOT NULL
    AND (exclude_id IS NULL OR d.id <> exclude_id)
    AND d.created_at < now() - (days_ago_min || ' days')::interval
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
$$;
