-- ============================================================
-- Migration 007: Slash Commands テーブル
-- ============================================================
-- カスタムスキル（/company, /permission 等）の一覧を管理。
-- config-sync Hook が SKILL.md を走査して差分同期する。
-- ============================================================

create table if not exists slash_commands (
  id text primary key,                    -- スキル名（例: "company", "permission"）
  trigger text not null,                  -- トリガーコマンド（例: "/company"）
  description text,                       -- 説明
  category text not null default 'other'
    check (category in (
      'organization',   -- 組織・タスク管理（/company）
      'permission',     -- 権限・設定管理（/permission）
      'utility',        -- ユーティリティ（/no-edit）
      'workflow',       -- ワークフロー（/commit, /review-pr）
      'document',       -- ドキュメント・資料（/pptx, /pdf）
      'analysis',       -- 分析・可視化（/explain, /visualize）
      'development',    -- 開発支援（/fix, /implement）
      'communication',  -- コミュニケーション（/slack, /internal-comms）
      'other'           -- その他
    )),
  source text,                            -- プラグイン名（例: "company@ai-company"）
  source_path text,                       -- SKILL.md のパス
  args_example text,                      -- 引数の例（例: "/company ai"）
  status text not null default 'active'
    check (status in ('active', 'deprecated', 'disabled')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_slash_commands_category on slash_commands(category);
create index if not exists idx_slash_commands_status on slash_commands(status);

-- RLS
alter table slash_commands enable row level security;
create policy "auth_full" on slash_commands for all to authenticated using (true) with check (true);
create policy "anon_all_slash_commands" on slash_commands for all to anon using (true) with check (true);
