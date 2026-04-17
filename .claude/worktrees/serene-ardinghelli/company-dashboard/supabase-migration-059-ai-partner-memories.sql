-- Migration 059: ai_partner_memories テーブル（AIパートナーの長期記憶）
--
-- 目的:
--   AIパートナーとの会話で言及された制約・好み・生活文脈を LLM が抽出し、
--   次回以降のプロンプトに注入して「同じ提案を繰り返さない／相棒として覚えている」状態を作る。
--
-- 例:
--   ユーザー: "サックスはそんなに簡単に吹けないです。場所の確保が必要で"
--   → content: "サックスは気軽に吹けない（音量・場所の制約）"
--     category: "constraint"
--
-- 抽出は partner_chat レスポンスと並行して gpt-5-nano で行う。
-- 「忘れて」系の発言も同じ抽出ステップで active=false にする。

CREATE TABLE IF NOT EXISTS ai_partner_memories (
  id bigserial PRIMARY KEY,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_referenced_at timestamptz NOT NULL DEFAULT now(),

  -- 記憶内容（1文・日本語・理由込み）
  content text NOT NULL,

  -- 分類
  --   constraint  : 物理的・実務的制約（「〜は場所がないとできない」）
  --   preference  : 好み（「静かな場所が好き」）
  --   context     : 生活文脈（「平日は朝が忙しい」）
  --   fact        : 安定した事実（「サックスを練習している」）
  category text NOT NULL CHECK (category IN ('constraint','preference','context','fact')),

  -- 抽出元
  source_message text,          -- 元のユーザー発言（参考）
  source_session_id text,       -- どのセッションで覚えたか

  -- 信頼度と運用
  confidence real NOT NULL DEFAULT 0.5,
  reinforced_count int NOT NULL DEFAULT 1,  -- 同じ趣旨が再確認された回数
  active boolean NOT NULL DEFAULT true       -- 「忘れて」で false
);

CREATE INDEX IF NOT EXISTS idx_ai_partner_memories_active_recent
  ON ai_partner_memories (active, last_referenced_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_partner_memories_user
  ON ai_partner_memories (user_id, active, last_referenced_at DESC);

-- RLS: ユーザー自身の記憶のみ読み書きできる（user_id IS NULL は互換のため許容）
ALTER TABLE ai_partner_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_partner_memories_select_own" ON ai_partner_memories
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "ai_partner_memories_insert_own" ON ai_partner_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "ai_partner_memories_update_own" ON ai_partner_memories
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL);

COMMENT ON TABLE ai_partner_memories IS 'AIパートナーの長期記憶。会話から抽出された制約・好み・文脈。次回以降のプロンプトに注入される';
