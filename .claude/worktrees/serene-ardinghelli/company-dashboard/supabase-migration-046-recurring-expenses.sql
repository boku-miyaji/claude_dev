-- ============================================================
-- Migration 046: 固定費・サブスクリプション管理
-- ============================================================
-- expenses テーブルに定期支払い（recurring）の管理カラムを追加。
-- is_recurring = true のレコードは毎月の固定費として扱う。
-- ============================================================

-- 定期支払いフラグ
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false;

-- 繰り返し間隔（月単位が基本、年払いもある）
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_interval text DEFAULT 'monthly'
  CHECK (recurring_interval IN ('monthly', 'quarterly', 'yearly'));

-- サービス名（サブスクの場合）
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS service_name text;

-- 契約開始日・終了日
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS contract_start date;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS contract_end date;

-- ステータス（解約済みも管理）
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurring_status text DEFAULT 'active'
  CHECK (recurring_status IN ('active', 'paused', 'cancelled'));

-- Index
CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(is_recurring) WHERE is_recurring = true;
