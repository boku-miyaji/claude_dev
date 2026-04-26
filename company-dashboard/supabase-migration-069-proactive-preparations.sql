-- ============================================================
-- Migration 069: proactive_preparations 受動 proactive 前奏
-- ============================================================
-- 目的:
--   silence-first 原則を維持したまま「気づいたら準備されている」体験を実装する。
--   夜間バッチ (Edge Function proactive-prep) が検知シグナルを semi-formal premise
--   で評価し、該当するときに 1日1件だけ Today 上部に出す前奏テキストを保存する。
--
--   このテーブルが空なら Today では何も表示されない（silence-first を壊さない）。
--
-- 設計参照:
--   - arXiv:2604.00842 (Pare): proactive agent の 4軸 (context / goal / timing / orch)
--   - Claude Managed Agents Memory (2026-04-23): audit log + rollback パターン
--   - Agentic Code Reasoning (arXiv:2603.01896): semi-formal reasoning
--
-- テーブル:
--   proactive_preparations  - 1ユーザー1日1件の前奏 (UNIQUE: user_id + delivery_date)
--
-- 既存パターン:
--   - RLS: is_owner() + check_ingest_key() (migration 066/067 に準拠)
--   - 配信冪等化: UNIQUE(user_id, delivery_date) (migration 066 と同じ)
--   - 監査: agent_sessions テーブルに proactive_intervention で別途追記する
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proactive_preparations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
                                          -- 単一ユーザー運用中は NULL 可
  delivery_date   DATE        NOT NULL,

  -- 4種の前奏タイプ。silence-first を壊さない範囲で使い分ける
  -- gentle_prelude        前夜の文脈から穏やかに今日へつなぐ短い言葉
  -- silence_acknowledge   N日無音の後の最初の声かけ（「待っていました」ではなく「居ますよ」）
  -- pattern_echo          過去の似た文脈の自分の言葉を引いて差し出す
  -- schedule_softener     カレンダー詰まりに対する余白の提案（タスク追加ではない）
  kind            TEXT        NOT NULL CHECK (kind IN (
                    'gentle_prelude',
                    'silence_acknowledge',
                    'pattern_echo',
                    'schedule_softener'
                  )),

  -- 表示テキスト（最小限・装飾ゼロ）
  body            TEXT        NOT NULL,
  hint            TEXT,                     -- 補足。任意（薄く表示）

  -- semi-formal premise (B = 監査可能)
  --   premise.signals[]            検知に使ったシグナル（何を見たか）
  --   premise.explicit_premise[]   明示前提（人間可読の箇条書き）
  premise         JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- 実行トレース（過去の似た記憶への参照など）
  --   trace.references[]           参照した diary_entry_id / pattern_id など
  --   trace.reasoning_steps[]      premise からの推論ステップ
  trace           JSONB       DEFAULT '{}'::jsonb,

  -- 「なぜ今この前奏を置いたか」を一言で
  conclusion      TEXT        NOT NULL,

  -- 由来
  source          TEXT        NOT NULL DEFAULT 'batch' CHECK (source IN ('batch','manual')),

  -- 表示状態
  status          TEXT        NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','viewed','dismissed')),
  shown_at        TIMESTAMPTZ,
  dismissed_at    TIMESTAMPTZ,

  -- 関連付け（後段の audit log と紐付け）
  agent_session_event_id UUID,             -- agent_sessions の対応イベント

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1日1件の冪等化（同日重複生成を防ぐ）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_proactive_preparations_daily
  ON public.proactive_preparations(user_id, delivery_date);

CREATE INDEX IF NOT EXISTS idx_proactive_preparations_user_date
  ON public.proactive_preparations(user_id, delivery_date DESC);

CREATE INDEX IF NOT EXISTS idx_proactive_preparations_kind
  ON public.proactive_preparations(kind);

-- updated_at トリガー（既存の共有関数を使う）
DROP TRIGGER IF EXISTS proactive_preparations_updated_at ON public.proactive_preparations;
CREATE TRIGGER proactive_preparations_updated_at
  BEFORE UPDATE ON public.proactive_preparations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS: owner full + anon (バッチ INSERT/UPDATE) は ingest key 必須
-- ============================================================
ALTER TABLE public.proactive_preparations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_full" ON public.proactive_preparations;
CREATE POLICY "owner_full" ON public.proactive_preparations
  FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "anon_insert_proactive_preparations_with_key" ON public.proactive_preparations;
CREATE POLICY "anon_insert_proactive_preparations_with_key" ON public.proactive_preparations
  FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_select_proactive_preparations_with_key" ON public.proactive_preparations;
CREATE POLICY "anon_select_proactive_preparations_with_key" ON public.proactive_preparations
  FOR SELECT TO anon
  USING (public.check_ingest_key());

DROP POLICY IF EXISTS "anon_update_proactive_preparations_with_key" ON public.proactive_preparations;
CREATE POLICY "anon_update_proactive_preparations_with_key" ON public.proactive_preparations
  FOR UPDATE TO anon
  USING (public.check_ingest_key()) WITH CHECK (public.check_ingest_key());

-- ============================================================
-- 確認用クエリ
-- ============================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename = 'proactive_preparations'
-- ORDER BY policyname;
--
-- 直近の前奏 1件 (Today で表示する想定):
-- SELECT id, kind, body, conclusion, status, shown_at
-- FROM proactive_preparations
-- WHERE delivery_date = CURRENT_DATE
-- ORDER BY created_at DESC LIMIT 1;
