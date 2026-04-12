-- Migration 060: user_manual_cards テーブル（自分の取扱説明書）
--
-- 目的:
--   Layer 2 (言語化) と Layer 3 (行動) の橋渡し。
--   Theme Finder が日記から生成した「種カード」を、ユーザーが自分の言葉に編集して
--   自分の取扱説明書として手元に置く。AI 生成だけだと他人事のままで行動が変わらない。
--   ユーザーが編集した瞬間に「自分の言葉」になり、行動の土台になる。
--
-- 参照: .company/design-philosophy.md「コーチングを超える」セクション
--
-- 設計:
--   - AI が seed_text を生成 → ユーザーが user_text を編集 → 表示は user_text 優先
--   - カテゴリ別に複数カードを持てる (values は複数可、identity は 1 枚想定)
--   - user_edited_at がセットされているカードは AI が上書きしない
--   - pinned: ユーザーが特に残したいカードを明示

CREATE TABLE IF NOT EXISTS user_manual_cards (
  id bigserial PRIMARY KEY,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- カテゴリ（取扱説明書のセクション）
  --   identity          : 自分を一言で表すテーマ (Theme Finder の identity)
  --   values            : 価値観・譲れないもの
  --   joy_trigger       : 喜びを感じる瞬間
  --   energy_source     : エネルギーの源泉
  --   failure_pattern   : 失敗パターン・躓くクセ
  --   recovery_style    : 疲れた時の回復スタイル
  --   aspiration        : 深層の志向性
  --   custom            : ユーザー任意
  category text NOT NULL CHECK (category IN (
    'identity','values','joy_trigger','energy_source',
    'failure_pattern','recovery_style','aspiration','custom'
  )),

  -- カード本文
  --   seed_text: Theme Finder が生成した下書き (AI の言葉)
  --   user_text: ユーザーが編集した本文 (自分の言葉)
  --   user_text が NULL なら seed_text を表示
  seed_text text,
  user_text text,

  -- 根拠: この洞察が日記のどの記述から来たか (Theme Finder が抽出した引用)
  evidence jsonb DEFAULT '[]'::jsonb,

  -- メタ
  source text NOT NULL DEFAULT 'theme_finder' CHECK (source IN ('theme_finder','manual','diary_import')),
  confidence text DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  pinned boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,

  -- 編集履歴
  user_edited_at timestamptz,
  last_reviewed_at timestamptz,

  -- 順序
  display_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_manual_cards_category
  ON user_manual_cards(category) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_user_manual_cards_pinned
  ON user_manual_cards(pinned) WHERE archived = false;

-- RLS (single-user project pattern — anon key で読み書き可)
ALTER TABLE user_manual_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_manual_cards_all" ON user_manual_cards;
CREATE POLICY "user_manual_cards_all" ON user_manual_cards
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION trg_user_manual_cards_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_manual_cards_updated_at ON user_manual_cards;
CREATE TRIGGER user_manual_cards_updated_at
  BEFORE UPDATE ON user_manual_cards
  FOR EACH ROW EXECUTE FUNCTION trg_user_manual_cards_updated_at();
