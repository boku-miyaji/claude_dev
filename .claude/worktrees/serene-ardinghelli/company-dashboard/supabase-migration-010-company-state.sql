-- ============================================================
-- Migration 010: .company/ ローカル状態の Supabase 移行
-- ============================================================
-- secretary/inbox, secretary/notes, hr/proposals, hr/retrospectives を
-- Supabase で管理し、マルチサーバー同時開発を実現する。
-- .company/ ディレクトリはローカルキャッシュとして残す（オプション）。
-- ============================================================

-- 1. secretary_notes: inbox + notes + decisions + learnings を統合管理
create table if not exists secretary_notes (
  id serial primary key,
  company_id text references companies(id) on delete set null,  -- null = HD level
  type text not null
    check (type in ('inbox', 'decision', 'learning', 'note')),
  title text,
  body text not null,
  note_date date not null default current_date,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_secretary_notes_company on secretary_notes(company_id);
create index if not exists idx_secretary_notes_type on secretary_notes(type);
create index if not exists idx_secretary_notes_date on secretary_notes(note_date desc);
create index if not exists idx_secretary_notes_tags on secretary_notes using gin(tags);

create or replace trigger secretary_notes_updated_at
  before update on secretary_notes
  for each row execute function update_updated_at();

-- 2. hr_proposals: 組織改編提案
create table if not exists hr_proposals (
  id serial primary key,
  company_id text references companies(id) on delete set null,
  proposal_type text not null
    check (proposal_type in ('restructure', 'merge', 'dissolve', 'improve_claude_md', 'new_department', 'other')),
  title text not null,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'proposed', 'approved', 'rejected', 'implemented')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_proposals_company on hr_proposals(company_id);
create index if not exists idx_hr_proposals_status on hr_proposals(status);
create index if not exists idx_hr_proposals_type on hr_proposals(proposal_type);

create or replace trigger hr_proposals_updated_at
  before update on hr_proposals
  for each row execute function update_updated_at();

-- 3. hr_retrospectives: KPTレトロスペクティブ
create table if not exists hr_retrospectives (
  id serial primary key,
  company_id text references companies(id) on delete set null,
  period text not null,               -- "2026-W12", "2026-03" etc.
  keep text,
  problem text,
  try_next text,
  summary text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hr_retrospectives_company on hr_retrospectives(company_id);
create index if not exists idx_hr_retrospectives_period on hr_retrospectives(period);

create or replace trigger hr_retrospectives_updated_at
  before update on hr_retrospectives
  for each row execute function update_updated_at();

-- 4. claude_settings 拡張: HD設定を保持
alter table claude_settings
  add column if not exists company_claude_md text,
  add column if not exists hd_config jsonb not null default '{}';

-- 5. RLS policies (authenticated + anon)
alter table secretary_notes enable row level security;
alter table hr_proposals enable row level security;
alter table hr_retrospectives enable row level security;

drop policy if exists "auth_full" on secretary_notes;
create policy "auth_full" on secretary_notes for all to authenticated using (true) with check (true);
drop policy if exists "auth_full" on hr_proposals;
create policy "auth_full" on hr_proposals for all to authenticated using (true) with check (true);
drop policy if exists "auth_full" on hr_retrospectives;
create policy "auth_full" on hr_retrospectives for all to authenticated using (true) with check (true);

-- Anon policies: new tables (hooks and skills use anon key)
drop policy if exists "anon_all_secretary_notes" on secretary_notes;
create policy "anon_all_secretary_notes" on secretary_notes for all to anon using (true) with check (true);
drop policy if exists "anon_all_hr_proposals" on hr_proposals;
create policy "anon_all_hr_proposals" on hr_proposals for all to anon using (true) with check (true);
drop policy if exists "anon_all_hr_retrospectives" on hr_retrospectives;
create policy "anon_all_hr_retrospectives" on hr_retrospectives for all to anon using (true) with check (true);

-- 6. Anon write policies for existing tables
-- /company スキルは anon key で Supabase REST API を呼ぶため、
-- 会社作成・タスク追加等に書き込み権限が必要。
-- migration-006 では SELECT のみだったテーブルに全権限を付与する。
drop policy if exists "anon_select_companies" on companies;
drop policy if exists "anon_all_companies" on companies;
create policy "anon_all_companies" on companies for all to anon using (true) with check (true);

drop policy if exists "anon_select_departments" on departments;
drop policy if exists "anon_all_departments" on departments;
create policy "anon_all_departments" on departments for all to anon using (true) with check (true);

drop policy if exists "anon_select_tasks" on tasks;
drop policy if exists "anon_all_tasks" on tasks;
create policy "anon_all_tasks" on tasks for all to anon using (true) with check (true);

drop policy if exists "anon_select_comments" on comments;
drop policy if exists "anon_all_comments" on comments;
create policy "anon_all_comments" on comments for all to anon using (true) with check (true);

drop policy if exists "anon_select_evaluations" on evaluations;
drop policy if exists "anon_all_evaluations" on evaluations;
create policy "anon_all_evaluations" on evaluations for all to anon using (true) with check (true);

drop policy if exists "anon_select_ceo_insights" on ceo_insights;
drop policy if exists "anon_all_ceo_insights" on ceo_insights;
create policy "anon_all_ceo_insights" on ceo_insights for all to anon using (true) with check (true);

drop policy if exists "anon_select_knowledge_base" on knowledge_base;
drop policy if exists "anon_all_knowledge_base" on knowledge_base;
create policy "anon_all_knowledge_base" on knowledge_base for all to anon using (true) with check (true);

drop policy if exists "anon_select_categories" on categories;
drop policy if exists "anon_all_categories" on categories;
create policy "anon_all_categories" on categories for all to anon using (true) with check (true);
