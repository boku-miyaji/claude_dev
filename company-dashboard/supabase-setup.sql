-- ============================================================
-- HD Company Dashboard - Supabase Schema
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================

-- ============================================================
-- 1. Tables
-- ============================================================

-- カテゴリ（大分類: xx, yy, zz）
create table if not exists categories (
  id text primary key,
  name text not null,
  description text,
  server_dir text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- PJ会社
create table if not exists companies (
  id text primary key,
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
  task_id int references tasks(id) on delete cascade,
  company_id text references companies(id) on delete cascade,
  body text not null,
  source text not null default 'web'
    check (source in ('web', 'mobile', 'claude', 'dashboard')),
  created_at timestamptz not null default now(),
  -- task_id or company_id must be set
  check (task_id is not null or company_id is not null)
);

-- 評価
create table if not exists evaluations (
  id serial primary key,
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
  company_id text references companies(id) on delete set null,
  action text not null,
  description text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Claude Code 設定
create table if not exists claude_settings (
  id text primary key,
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

create index if not exists idx_companies_category on companies(category_id);
create index if not exists idx_companies_status on companies(status);
create index if not exists idx_departments_company on departments(company_id);
create index if not exists idx_tasks_company on tasks(company_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_priority on tasks(priority);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_comments_task on comments(task_id);
create index if not exists idx_comments_company on comments(company_id);
create index if not exists idx_evaluations_company on evaluations(company_id);
create index if not exists idx_activity_log_company on activity_log(company_id);
create index if not exists idx_activity_log_created on activity_log(created_at desc);

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
-- Personal tool: authenticated users get full access

alter table categories enable row level security;
alter table companies enable row level security;
alter table departments enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table evaluations enable row level security;
alter table activity_log enable row level security;
alter table claude_settings enable row level security;

-- Policy: authenticated users can do everything
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'categories', 'companies', 'departments', 'tasks',
    'comments', 'evaluations', 'activity_log', 'claude_settings'
  ])
  loop
    execute format(
      'create policy if not exists "auth_full_%1$s" on %1$s
       for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 5. Views
-- ============================================================

-- タスクサマリー（会社ごとの集計）
create or replace view company_task_summary as
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

-- 直近のアクティビティ
create or replace view recent_activity as
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
  insert into activity_log (company_id, action, description, metadata)
  values (p_company_id, p_action, p_description, p_metadata);
end;
$$ language plpgsql;
