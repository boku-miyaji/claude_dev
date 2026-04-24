-- app_config: アプリ全体の設定値を管理するキーバリューテーブル。
-- 主な用途: バッチで使うLLMモデル名など、設定ページから変更したい値。
CREATE TABLE IF NOT EXISTS app_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  label       TEXT,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- service_role は全操作可
CREATE POLICY "service_role_all" ON app_config
  FOR ALL USING (auth.role() = 'service_role');

-- 認証済みユーザーは読み書き可（単一ユーザー運用前提）
CREATE POLICY "authenticated_select" ON app_config
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_update" ON app_config
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_insert" ON app_config
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- デフォルト値
INSERT INTO app_config (key, value, label, description) VALUES
  ('batch.narrator_model',      'claude-opus-4-7',          'Narrator モデル',        'Arc Reader / Theme Finder / Self Analysis で使用'),
  ('batch.morning_quote_model', 'claude-opus-4-7',          'モーニングクォートモデル', 'テーマ抽出・名言検索で使用')
ON CONFLICT (key) DO NOTHING;
