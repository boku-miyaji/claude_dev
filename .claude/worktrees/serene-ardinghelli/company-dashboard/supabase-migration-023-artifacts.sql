-- ============================================================
-- Migration 023: artifacts テーブル + artifact_comments テーブル
-- ============================================================
-- 目的: ファイルパスを登録し、内容をSupabaseに同期。
--       ダッシュボードで閲覧・コメント・Claude Codeで作業再開。
-- ============================================================

-- === artifacts: 登録されたファイル ===
create table if not exists artifacts (
  id serial primary key,
  company_id text references companies(id) on delete set null,
  title text not null,
  file_path text not null unique,           -- /workspace/project-scotch-care/docs/...
  file_type text not null default 'md'      -- md / html / yaml / json
    check (file_type in ('md', 'html', 'yaml', 'json', 'txt', 'pptx')),
  content text,                             -- ファイルの内容（Hook が同期）
  content_hash text,                        -- SHA256 hash（変更検知用）
  last_synced_at timestamptz,               -- 最終同期日時
  status text not null default 'active'
    check (status in ('active', 'archived')),
  tags text[] not null default '{}',
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === artifact_comments: 成果物へのコメント ===
create table if not exists artifact_comments (
  id serial primary key,
  artifact_id int not null references artifacts(id) on delete cascade,
  body text not null,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'wontfix')),
  source text not null default 'dashboard'
    check (source in ('dashboard', 'claude', 'mobile')),
  resolved_by text,                         -- 'claude' / 'manual'
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- === RLS policies ===
alter table artifacts enable row level security;
alter table artifact_comments enable row level security;

-- Owner (authenticated)
create policy "owner_full" on artifacts for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "owner_full" on artifact_comments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Hook (anon + ingest key)
create policy "anon_insert_artifacts_with_key"
  on artifacts for insert to anon with check (public.check_ingest_key());
create policy "anon_update_artifacts_with_key"
  on artifacts for update to anon
  using (public.check_ingest_key()) with check (public.check_ingest_key());
create policy "anon_select_artifacts_with_key"
  on artifacts for select to anon using (public.check_ingest_key());

create policy "anon_insert_artifact_comments_with_key"
  on artifact_comments for insert to anon with check (public.check_ingest_key());
create policy "anon_update_artifact_comments_with_key"
  on artifact_comments for update to anon
  using (public.check_ingest_key()) with check (public.check_ingest_key());
create policy "anon_select_artifact_comments_with_key"
  on artifact_comments for select to anon using (public.check_ingest_key());

-- Indexes
create index idx_artifacts_company on artifacts(company_id);
create index idx_artifacts_status on artifacts(status);
create index idx_artifact_comments_artifact on artifact_comments(artifact_id);
create index idx_artifact_comments_status on artifact_comments(status);
