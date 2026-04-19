-- ============================================================
-- Migration 064: life_story_user_stages テーブル
-- ============================================================
-- 目的: Roots（人生の棚卸し）のステージを user ごとに動的管理する。
--        現行の固定 STAGES（childhood..recent）を preset として持ち、
--        情報量が増えたら AI が「1社目」「2社目」「○年目」等に分割提案し、
--        ユーザー承認でカスタムステージとして追加できるようにする。
--
-- life_story_entries.stage は TEXT のまま。preset/custom の key を入れる。
-- 既存データ（early_career 等）は preset としてそのまま表示される。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.life_story_user_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  key TEXT NOT NULL,           -- 例: "childhood", "company_accenture", "company_1_year_3"
  label TEXT NOT NULL,         -- 例: "幼少期", "1社目（アクセンチュア）", "独立後1年目"
  kind TEXT NOT NULL DEFAULT 'custom' CHECK (kind IN ('preset', 'custom')),

  sort_order NUMERIC NOT NULL DEFAULT 0,  -- NUMERIC: 後から間に挿入できる

  year_start INTEGER,  -- 任意（カスタムで使う）
  year_end INTEGER,    -- 任意

  parent_key TEXT,     -- 分割元の preset key（e.g. "early_career" → "company_1"）

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (owner_id, key)
);

CREATE INDEX IF NOT EXISTS idx_life_story_user_stages_owner_sort
  ON public.life_story_user_stages (owner_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_life_story_user_stages_parent
  ON public.life_story_user_stages (owner_id, parent_key);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION public.touch_life_story_user_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_life_story_user_stages ON public.life_story_user_stages;
CREATE TRIGGER trg_touch_life_story_user_stages
  BEFORE UPDATE ON public.life_story_user_stages
  FOR EACH ROW EXECUTE FUNCTION public.touch_life_story_user_stages_updated_at();

-- RLS
ALTER TABLE public.life_story_user_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "life_story_user_stages_owner_all" ON public.life_story_user_stages;
CREATE POLICY "life_story_user_stages_owner_all"
  ON public.life_story_user_stages
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

COMMENT ON TABLE public.life_story_user_stages IS
  'Roots のステージ（時期カテゴリ）を user ごとに保持。preset + AI が提案した custom。';
