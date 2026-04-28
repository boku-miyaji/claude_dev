-- Migration 070: user_manual_edits — Manual カード編集履歴
--
-- 目的:
--   AI が生成した seed が「自分の言葉」になっていく過程を可視化する。
--   編集前の値を破棄せず保存することで「他人事 → 自分のもの」への変化を辿れる。
--
-- 設計:
--   - 全ての Manual 操作（カード編集 / 追加 / アーカイブ / proposal 編集 / 承認 / 却下）を記録
--   - card_id と pending_update_id は片方または両方が NULL でも OK（archive 後の参照断絶を許容）
--   - seed_index は proposal の seeds[i] 編集時のみ使う
--   - RLS: focus-you は単一ユーザー前提なので user_manual_cards と同じ "FOR ALL USING (true)" パターン

CREATE TABLE IF NOT EXISTS user_manual_edits (
  id bigserial PRIMARY KEY,
  card_id bigint REFERENCES user_manual_cards(id) ON DELETE CASCADE,
  pending_update_id bigint REFERENCES pending_updates(id) ON DELETE SET NULL,
  seed_index integer,  -- proposal 編集時の proposed_content.seeds 配列の位置
  edit_type text NOT NULL CHECK (edit_type IN (
    'card_edit',          -- 既存カードの本文を編集
    'card_create',        -- 手動でカード追加
    'card_archive',       -- カードをアーカイブ
    'proposal_seed_edit', -- 承認前の AI 提案 seed を編集
    'proposal_accept',    -- proposal を承認
    'proposal_reject'     -- proposal を却下
  )),
  before_text text,
  after_text text,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_manual_edits_card_id
  ON user_manual_edits(card_id) WHERE card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_manual_edits_pending_id
  ON user_manual_edits(pending_update_id) WHERE pending_update_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_manual_edits_edited_at
  ON user_manual_edits(edited_at DESC);

ALTER TABLE user_manual_edits ENABLE ROW LEVEL SECURITY;

-- focus-you は単一ユーザー前提（個人アプリ）。user_manual_cards と同じパターンで全開放
DROP POLICY IF EXISTS "user_manual_edits_all" ON user_manual_edits;
CREATE POLICY "user_manual_edits_all" ON user_manual_edits
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE user_manual_edits IS 'Manual カードの編集履歴。AI seed → 自分の言葉への変化を記録。';
