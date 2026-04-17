-- Migration 057: AIチャット v4 の呼び方・基本トーン設定
--
-- 背景: AIチャットの立ち位置を v4（未来のあなた・敬語・グラデーション判断）に変更。
-- ユーザーが呼び方と基本トーンを選べるようにする。
-- 詳細は scratch/design/ai-chat-positioning.md（壁打ち資料）

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS chat_user_label text,  -- 呼び方（例: "ゆうた", "ゆうたさん", "先輩", 空=呼ばない）
  ADD COLUMN IF NOT EXISTS chat_tone_mode text NOT NULL DEFAULT 'auto'
    CHECK (chat_tone_mode IN ('auto', 'soft', 'bold'));

COMMENT ON COLUMN user_settings.chat_user_label IS 'AIチャットでの呼び方。NULL/空なら呼ばない';
COMMENT ON COLUMN user_settings.chat_tone_mode IS 'AIチャットの基本トーン auto=状況適応 soft=常にやわらかく bold=常にはっきり';
