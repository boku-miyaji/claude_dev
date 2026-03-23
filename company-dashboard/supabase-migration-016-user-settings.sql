-- ============================================================
-- Migration 016: user_settings テーブル（GitHub ユーザーに紐づく設定）
-- ============================================================
-- 目的: ダッシュボードの Settings ページから設定を管理し、
-- GitHub OAuth ユーザーに紐づけて保存する。
-- どのデバイスからログインしても同じ設定が使える。
-- ============================================================

create table if not exists user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  github_username text,
  ingest_api_key text,
  preferences jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

create index if not exists idx_user_settings_user_id on user_settings(user_id);

-- Updated_at trigger
create or replace trigger user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at();

-- RLS
alter table user_settings enable row level security;

-- authenticated: own row only
create policy "user_settings_select_own"
  on user_settings for select to authenticated
  using (user_id = auth.uid());

create policy "user_settings_insert_own"
  on user_settings for insert to authenticated
  with check (user_id = auth.uid());

create policy "user_settings_update_own"
  on user_settings for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No anon access at all
-- No delete (prevent accidental deletion)
