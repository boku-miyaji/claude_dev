-- ============================================================
-- Migration 065: ideas テーブル
-- ============================================================
-- 目的: focus-you にアイデア（仕事のメモ的なもの）を貯める置き場を作る。
--        1行で速く書き、後でタグ付け・状態管理ができるハイブリッド型。
--        デフォルトは raw（書き捨て）、育てたいものだけ review→adopted へ昇格。
--        rejected で却下ログ、物理削除もできる（UI 側で削除ボタン）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'review', 'adopted', 'rejected')),
  tags TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ideas_owner_created
  ON public.ideas (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ideas_owner_status
  ON public.ideas (owner_id, status);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION public.touch_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_ideas ON public.ideas;
CREATE TRIGGER trg_touch_ideas
  BEFORE UPDATE ON public.ideas
  FOR EACH ROW EXECUTE FUNCTION public.touch_ideas_updated_at();

-- RLS
ALTER TABLE public.ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all" ON public.ideas;
CREATE POLICY "owner_all"
  ON public.ideas
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "ingest_all" ON public.ideas;
CREATE POLICY "ingest_all"
  ON public.ideas
  FOR ALL
  USING (
    ((current_setting('request.headers'::text, true))::json ->> 'x-ingest-key'::text)
      = current_setting('app.settings.ingest_api_key'::text, true)
  )
  WITH CHECK (
    ((current_setting('request.headers'::text, true))::json ->> 'x-ingest-key'::text)
      = current_setting('app.settings.ingest_api_key'::text, true)
  );

COMMENT ON TABLE public.ideas IS
  'focus-you のアイデア置き場。仕事のメモ・思いつきを raw で貯め、育てたいものだけ status 遷移。';
