-- ============================================================
-- Migration 047: story_memory / story_moments / shared_stories
-- ============================================================
-- 目的: Narrator（物語知性）機能の基盤テーブルを作成する。
-- LLMが生成する深い自己理解・物語の転機・共有ストーリーを管理する。
-- ============================================================

-- ============================================================
-- Step 1: story_memory テーブル作成（LLMが生成する深い理解）
-- ============================================================
CREATE TABLE IF NOT EXISTS story_memory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type   TEXT NOT NULL CHECK (memory_type IN (
    'identity',       -- 人生テーマ、原型
    'current_arc',    -- 今のフェーズ
    'chapter',        -- 物語の章
    'emotional_dna',  -- 感情パターン
    'aspirations'     -- 欲求の深層理解
  )),
  content           JSONB         NOT NULL,
  narrative_text    TEXT,
  data_range        TSTZRANGE,
  source_data_count INT           DEFAULT 0,
  model_used        TEXT,
  created_at        TIMESTAMPTZ   DEFAULT now(),
  updated_at        TIMESTAMPTZ   DEFAULT now(),
  version           INT           DEFAULT 1
);

COMMENT ON TABLE story_memory IS 'Narrator機能: LLMが生成する深い自己理解（人生テーマ・フェーズ・感情DNA等）';
COMMENT ON COLUMN story_memory.memory_type IS 'identity: 人生テーマ/原型, current_arc: 今のフェーズ, chapter: 物語の章, emotional_dna: 感情パターン, aspirations: 欲求の深層理解';
COMMENT ON COLUMN story_memory.content IS 'memory_typeに応じた構造化データ（JSONB）';
COMMENT ON COLUMN story_memory.narrative_text IS 'LLMが生成した自然言語の物語テキスト';
COMMENT ON COLUMN story_memory.data_range IS '分析対象期間（tstzrange）';
COMMENT ON COLUMN story_memory.source_data_count IS '分析に使用したデータ件数';
COMMENT ON COLUMN story_memory.version IS '同一memory_typeの世代番号（更新のたびにインクリメント）';

-- ============================================================
-- Step 2: story_moments テーブル作成（物語の転機）
-- ============================================================
CREATE TABLE IF NOT EXISTS story_moments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_type       TEXT NOT NULL CHECK (moment_type IN (
    'decision',     -- 意思決定の瞬間
    'realization',  -- 気づき・洞察
    'breakthrough', -- ブレークスルー
    'connection',   -- 人や出来事との繋がり
    'setback'       -- 挫折・困難
  )),
  title             TEXT        NOT NULL,
  description       TEXT        NOT NULL,
  diary_entry_id    INT         REFERENCES diary_entries(id) ON DELETE SET NULL,
  emotion_snapshot  JSONB,
  chapter_id        UUID        REFERENCES story_memory(id) ON DELETE SET NULL,
  user_confirmed    BOOLEAN     DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE story_moments IS 'Narrator機能: LLMまたはユーザーが記録する物語の転機イベント';
COMMENT ON COLUMN story_moments.moment_type IS 'decision: 意思決定, realization: 気づき, breakthrough: 突破, connection: 繋がり, setback: 挫折';
COMMENT ON COLUMN story_moments.diary_entry_id IS '転機の起点となった日記エントリーへの参照';
COMMENT ON COLUMN story_moments.emotion_snapshot IS '転機発生時の感情状態スナップショット（Plutchik 8感情等）';
COMMENT ON COLUMN story_moments.chapter_id IS 'この転機が属する story_memory の章（chapter）';
COMMENT ON COLUMN story_moments.user_confirmed IS 'ユーザーが転機として確認・承認したか';

-- ============================================================
-- Step 3: shared_stories テーブル作成（Courage Board用共有ストーリー）
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_stories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  story_type        TEXT NOT NULL CHECK (story_type IN (
    'card',          -- 短いカード形式
    'chapter',       -- 章全体の共有
    'growth_story'   -- 成長ストーリー
  )),
  title             TEXT        NOT NULL,
  content           TEXT        NOT NULL,
  source_chapter_id UUID        REFERENCES story_memory(id) ON DELETE SET NULL,
  anonymized        BOOLEAN     DEFAULT true,
  empathy_count     INT         DEFAULT 0,
  is_public         BOOLEAN     DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE shared_stories IS 'Narrator機能: Courage Boardに投稿される共有ストーリー。匿名化可能';
COMMENT ON COLUMN shared_stories.story_type IS 'card: カード形式, chapter: 章全体, growth_story: 成長ストーリー';
COMMENT ON COLUMN shared_stories.source_chapter_id IS '元になった story_memory の章';
COMMENT ON COLUMN shared_stories.anonymized IS 'trueの場合は個人情報を匿名化して公開';
COMMENT ON COLUMN shared_stories.empathy_count IS '共感ボタンの累積カウント';
COMMENT ON COLUMN shared_stories.is_public IS 'Courage Board（公開フィード）に表示するか';

-- ============================================================
-- Step 4: インデックス
-- ============================================================
-- story_memory
CREATE INDEX IF NOT EXISTS idx_story_memory_user_type    ON story_memory(user_id, memory_type);
CREATE INDEX IF NOT EXISTS idx_story_memory_updated_at   ON story_memory(updated_at DESC);

-- story_moments
CREATE INDEX IF NOT EXISTS idx_story_moments_user_created ON story_moments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_moments_diary        ON story_moments(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_story_moments_chapter      ON story_moments(chapter_id);

-- shared_stories
CREATE INDEX IF NOT EXISTS idx_shared_stories_public      ON shared_stories(is_public, created_at DESC);

-- ============================================================
-- Step 5: RLS
-- ============================================================
ALTER TABLE story_memory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_moments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_stories  ENABLE ROW LEVEL SECURITY;

-- story_memory: authenticated owner
CREATE POLICY "owner_full_story_memory" ON story_memory
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- story_memory: anon insert via ingest key (Hook/自動化用)
CREATE POLICY "anon_insert_story_memory" ON story_memory
  FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

-- story_moments: authenticated owner
CREATE POLICY "owner_full_story_moments" ON story_moments
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- story_moments: anon insert via ingest key
CREATE POLICY "anon_insert_story_moments" ON story_moments
  FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

-- shared_stories: authenticated owner
CREATE POLICY "owner_full_shared_stories" ON shared_stories
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- shared_stories: anon insert via ingest key
CREATE POLICY "anon_insert_shared_stories" ON shared_stories
  FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

-- shared_stories: public SELECT for is_public = true (誰でも閲覧可能)
CREATE POLICY "public_read_shared_stories" ON shared_stories
  FOR SELECT
  USING (is_public = true);
