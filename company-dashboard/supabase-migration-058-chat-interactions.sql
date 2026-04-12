-- Migration 058: chat_interactions テーブル（AIチャットの応答記録と効果指標）
--
-- 目的:
--   AIチャットが「やる気」「幸せ」を成功指標として自己改善するための基盤。
--   各応答の内容と、翌日の日記・感情スコア変化・ユーザー行動を紐付けて、
--   何が効いたかを週次バッチで分析する。

CREATE TABLE IF NOT EXISTS chat_interactions (
  id bigserial PRIMARY KEY,
  user_id uuid,
  session_id text,                    -- 同じチャットセッション内の一連の往復
  created_at timestamptz NOT NULL DEFAULT now(),

  -- リクエスト側
  user_message text NOT NULL,
  entry_point text,                   -- 'today_partner' | 'diary_followup' | 'chat_page' | etc
  context_snapshot jsonb,             -- 判断材料の要約（どの日記を引いたか、どの大局傾向を見たか）

  -- 応答側
  assistant_message text NOT NULL,
  model text,
  tone_used text,                     -- LLM が使ったトーンの自己申告（後でプロンプト改善に使う）

  -- 効果指標（バッチで遅延埋め）
  post_action text,                   -- 'closed' | 'replied' | 'new_topic' | 'followed_suggestion'
  explicit_feedback text,             -- ユーザーの自然言語フィードバック抽出結果
  next_day_mood_delta numeric,        -- 翌日の感情スコア変化
  mentioned_in_next_diary boolean,    -- 翌日の日記でチャット内容に言及したか
  effectiveness_score numeric,        -- 総合スコア（週次バッチで算出）
  effectiveness_reason text           -- LLM が判定した効果の理由
);

CREATE INDEX IF NOT EXISTS idx_chat_interactions_user_created
  ON chat_interactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_interactions_session
  ON chat_interactions (session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_interactions_effectiveness
  ON chat_interactions (effectiveness_score DESC NULLS LAST);

-- RLS: ユーザー自身の記録のみ読める
ALTER TABLE chat_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_interactions_select_own" ON chat_interactions
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "chat_interactions_insert_own" ON chat_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

COMMENT ON TABLE chat_interactions IS 'AIチャットの応答記録。自己改善サイクルの元データ';
