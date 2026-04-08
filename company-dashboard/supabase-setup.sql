-- ============================================================
-- focus-you Dashboard - Supabase Schema
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- Execute all at once. Do not split.
-- ============================================================
-- Each user deploys their own Supabase project.
-- RLS: authenticated = full access (single-tenant per Supabase project).
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
  mcp_servers jsonb not null default '{}',
  claude_md_content text,
  updated_at timestamptz not null default now()
);

-- 社長プロンプト履歴（入力のみ記録）
create table if not exists prompt_log (
  id serial primary key,
  company_id text references companies(id) on delete set null,
  prompt text not null,
  context text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 社長分析（行動パターン・好み・傾向）
create table if not exists ceo_insights (
  id serial primary key,
  category text not null
    check (category in ('pattern', 'preference', 'strength', 'tendency', 'feedback')),
  insight text not null,
  evidence text,
  company_id text references companies(id) on delete set null,
  confidence text not null default 'medium'
    check (confidence in ('high', 'medium', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ナレッジベース（LLMデフォルトとの差分を蓄積）
create table if not exists knowledge_base (
  id serial primary key,
  category text not null
    check (category in ('coding', 'documentation', 'communication', 'design',
                         'process', 'quality', 'tools', 'domain', 'other')),
  rule text not null,
  reason text,
  source_prompt text,
  scope text not null default 'global'
    check (scope in ('global', 'company')),
  company_id text references companies(id) on delete set null,
  confidence int not null default 1,
  auto_apply boolean not null default true,
  status text not null default 'active'
    check (status in ('active', 'deprecated', 'promoted')),
  promoted_to text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- サービスメニュー（提供可能なサービス）
create table if not exists services (
  id serial primary key,
  name text not null,
  category text not null
    check (category in ('development', 'consulting', 'research', 'design',
                         'training', 'operation', 'other')),
  description text,
  deliverables text,
  target_audience text,
  status text not null default 'active'
    check (status in ('active', 'planned', 'discontinued')),
  company_id text references companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 実績（過去の案件・プロジェクト）
create table if not exists portfolio_projects (
  id serial primary key,
  title text not null,
  client text,
  description text,
  outcome text,
  tech_stack text[] not null default '{}',
  period_start date,
  period_end date,
  status text not null default 'completed'
    check (status in ('completed', 'ongoing', 'cancelled')),
  company_id text references companies(id) on delete set null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

-- 技術スタック
create table if not exists tech_stack (
  id serial primary key,
  name text not null,
  category text not null
    check (category in ('language', 'framework', 'infrastructure', 'ai_ml',
                         'database', 'tool', 'platform', 'other')),
  proficiency text not null default 'intermediate'
    check (proficiency in ('expert', 'advanced', 'intermediate', 'beginner')),
  years_experience numeric(3,1),
  notes text,
  created_at timestamptz not null default now()
);

-- キャリア管理
create table if not exists career (
  id serial primary key,
  type text not null
    check (type in ('goal', 'milestone', 'strength', 'weakness',
                     'market_insight', 'reflection', 'action_item')),
  title text not null,
  description text,
  target_date date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'on_hold', 'dropped')),
  priority text not null default 'normal'
    check (priority in ('high', 'normal', 'low')),
  created_at timestamptz not null default now(),
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
create index if not exists idx_prompt_log_company on prompt_log(company_id);
create index if not exists idx_prompt_log_created on prompt_log(created_at desc);
create index if not exists idx_prompt_log_tags on prompt_log using gin(tags);
create index if not exists idx_ceo_insights_category on ceo_insights(category);
create index if not exists idx_ceo_insights_company on ceo_insights(company_id);
create index if not exists idx_knowledge_base_category on knowledge_base(category);
create index if not exists idx_knowledge_base_scope on knowledge_base(scope);
create index if not exists idx_knowledge_base_status on knowledge_base(status);
create index if not exists idx_knowledge_base_company on knowledge_base(company_id);
create index if not exists idx_services_category on services(category);
create index if not exists idx_services_company on services(company_id);
create index if not exists idx_portfolio_projects_company on portfolio_projects(company_id);
create index if not exists idx_portfolio_projects_status on portfolio_projects(status);
create index if not exists idx_tech_stack_category on tech_stack(category);
create index if not exists idx_career_type on career(type);
create index if not exists idx_career_status on career(status);

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

create or replace trigger ceo_insights_updated_at
  before update on ceo_insights
  for each row execute function update_updated_at();

create or replace trigger knowledge_base_updated_at
  before update on knowledge_base
  for each row execute function update_updated_at();

create or replace trigger services_updated_at
  before update on services
  for each row execute function update_updated_at();

create or replace trigger career_updated_at
  before update on career
  for each row execute function update_updated_at();

-- ============================================================
-- 4. RLS (Row Level Security)
-- ============================================================
-- Single-tenant: each user has their own Supabase project.
-- RLS ensures only authenticated users can access data.

alter table categories enable row level security;
alter table companies enable row level security;
alter table departments enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table evaluations enable row level security;
alter table activity_log enable row level security;
alter table claude_settings enable row level security;
alter table prompt_log enable row level security;
alter table ceo_insights enable row level security;
alter table knowledge_base enable row level security;

create policy "auth_full" on categories for all to authenticated using (true) with check (true);
create policy "auth_full" on companies for all to authenticated using (true) with check (true);
create policy "auth_full" on departments for all to authenticated using (true) with check (true);
create policy "auth_full" on tasks for all to authenticated using (true) with check (true);
create policy "auth_full" on comments for all to authenticated using (true) with check (true);
create policy "auth_full" on evaluations for all to authenticated using (true) with check (true);
create policy "auth_full" on activity_log for all to authenticated using (true) with check (true);
create policy "auth_full" on prompt_log for all to authenticated using (true) with check (true);
create policy "auth_full" on ceo_insights for all to authenticated using (true) with check (true);
create policy "auth_full" on knowledge_base for all to authenticated using (true) with check (true);

alter table services enable row level security;
alter table portfolio_projects enable row level security;
alter table tech_stack enable row level security;
alter table career enable row level security;
create policy "auth_full" on services for all to authenticated using (true) with check (true);
create policy "auth_full" on portfolio_projects for all to authenticated using (true) with check (true);
create policy "auth_full" on tech_stack for all to authenticated using (true) with check (true);
create policy "auth_full" on career for all to authenticated using (true) with check (true);
create policy "auth_full" on claude_settings for all to authenticated using (true) with check (true);

-- ============================================================
-- 5. Views
-- ============================================================

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
