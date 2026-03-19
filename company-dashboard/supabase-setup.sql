-- ============================================================
-- 宮路HD Dashboard - Supabase Schema
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Execute all at once. Do not split.
-- ============================================================

-- ============================================================
-- 1. Tables
-- ============================================================
-- All tables have user_id for per-user data isolation.
-- default auth.uid() auto-fills when inserting via Supabase API.

-- カテゴリ（大分類: xx, yy, zz）
create table if not exists categories (
  id text primary key,
  user_id uuid default auth.uid(),
  name text not null,
  description text,
  server_dir text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- PJ会社
create table if not exists companies (
  id text primary key,
  user_id uuid default auth.uid(),
  category_id text references categories(id) on delete set null,
  name text not null,
  description text,
  server_path text,
  git_repo_url text,
  status text not null default 'active'
    check (status in ('active', 'archived', 'paused')),
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 部署
create table if not exists departments (
  id serial primary key,
  user_id uuid default auth.uid(),
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  slug text not null,
  type text not null,
  teams jsonb not null default '[]',
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(company_id, slug)
);

-- タスク
create table if not exists tasks (
  id serial primary key,
  user_id uuid default auth.uid(),
  company_id text not null references companies(id) on delete cascade,
  department_id int references departments(id) on delete set null,
  type text not null default 'todo'
    check (type in ('todo', 'task', 'request', 'milestone')),
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority in ('high', 'normal', 'low')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'done', 'cancelled')),
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- コメント
create table if not exists comments (
  id serial primary key,
  user_id uuid default auth.uid(),
  task_id int references tasks(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  body text not null,
  source text not null default 'web'
    check (source in ('web', 'mobile', 'claude', 'dashboard')),
  created_at timestamptz not null default now(),
  check (task_id is not null or company_id is not null)
);

-- 評価
create table if not exists evaluations (
  id serial primary key,
  user_id uuid default auth.uid(),
  company_id text not null references companies(id) on delete cascade,
  department_id int references departments(id) on delete set null,
  autonomy text check (autonomy in ('◎','○','△','×','-')),
  quality text check (quality in ('◎','○','△','×','-')),
  collaboration text check (collaboration in ('◎','○','△','×','-')),
  goal_alignment text check (goal_alignment in ('◎','○','△','×','-')),
  usage_rate text check (usage_rate in ('◎','○','△','×','-')),
  total_score text check (total_score in ('S','A','B','C','D','-')),
  notes text,
  period text not null,
  created_at timestamptz not null default now()
);

-- アクティビティログ
create table if not exists activity_log (
  id serial primary key,
  user_id uuid default auth.uid(),
  company_id text references companies(id) on delete set null,
  action text not null,
  description text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Claude Code 設定
create table if not exists claude_settings (
  id text primary key,
  user_id uuid default auth.uid(),
  scope text not null,
  server_path text,
  settings_json jsonb not null default '{}',
  plugins jsonb not null default '{}',
  permissions jsonb not null default '{}',
  skills jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2. Indexes
-- ============================================================

create index if not exists idx_categories_user on categories(user_id);
create index if not exists idx_companies_user on companies(user_id);
create index if not exists idx_companies_category on companies(category_id);
create index if not exists idx_companies_status on companies(status);
create index if not exists idx_departments_user on departments(user_id);
create index if not exists idx_departments_company on departments(company_id);
create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_tasks_company on tasks(company_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_priority on tasks(priority);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_comments_user on comments(user_id);
create index if not exists idx_comments_task on comments(task_id);
create index if not exists idx_comments_company on comments(company_id);
create index if not exists idx_evaluations_user on evaluations(user_id);
create index if not exists idx_evaluations_company on evaluations(company_id);
create index if not exists idx_activity_log_user on activity_log(user_id);
create index if not exists idx_activity_log_company on activity_log(company_id);
create index if not exists idx_activity_log_created on activity_log(created_at desc);
create index if not exists idx_claude_settings_user on claude_settings(user_id);

-- ============================================================
-- 3. Updated_at trigger
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger companies_updated_at
  before update on companies
  for each row execute function update_updated_at();

create or replace trigger tasks_updated_at
  before update on tasks
  for each row execute function update_updated_at();

-- ============================================================
-- 4. RLS (Row Level Security)
-- ============================================================
-- Per-user isolation: each user can only access their own data.

alter table categories enable row level security;
alter table companies enable row level security;
alter table departments enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table evaluations enable row level security;
alter table activity_log enable row level security;
alter table claude_settings enable row level security;

create policy "own_data" on categories for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_data" on companies for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_data" on departments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_data" on tasks for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_data" on comments for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_data" on evaluations for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_data" on activity_log for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_data" on claude_settings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 5. Views (security_invoker = true respects RLS of caller)
-- ============================================================

create or replace view company_task_summary with (security_invoker = true) as
select
  c.id as company_id,
  c.name as company_name,
  c.status as company_status,
  c.category_id,
  count(t.id) filter (where t.status = 'open') as open_tasks,
  count(t.id) filter (where t.status = 'in_progress') as in_progress_tasks,
  count(t.id) filter (where t.status = 'done'
    and t.completed_at > now() - interval '7 days') as done_this_week,
  count(t.id) filter (where t.due_date < current_date
    and t.status in ('open', 'in_progress')) as overdue_tasks,
  max(t.updated_at) as last_activity
from companies c
left join tasks t on t.company_id = c.id
group by c.id, c.name, c.status, c.category_id;

create or replace view recent_activity with (security_invoker = true) as
select
  al.id,
  al.company_id,
  c.name as company_name,
  al.action,
  al.description,
  al.created_at
from activity_log al
left join companies c on c.id = al.company_id
order by al.created_at desc
limit 50;

-- ============================================================
-- 6. Helper function: log activity
-- ============================================================

create or replace function log_activity(
  p_company_id text,
  p_action text,
  p_description text,
  p_metadata jsonb default '{}'
) returns void as $$
begin
  insert into activity_log (company_id, action, description, metadata, user_id)
  values (p_company_id, p_action, p_description, p_metadata, auth.uid());
end;
$$ language plpgsql security definer;
