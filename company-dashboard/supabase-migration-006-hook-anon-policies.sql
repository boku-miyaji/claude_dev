-- ============================================================
-- Migration 006: Hook用 anon RLS ポリシー追加
-- ============================================================
-- 前提: migration-005 (portfolio/career テーブル) が未適用の場合、
--       先にテーブルを作成してから RLS ポリシーを追加する。
-- ============================================================

-- ============================================================
-- Part A: migration-005 のテーブル作成（未適用の場合のみ）
-- ============================================================

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

-- Indexes (migration-005)
create index if not exists idx_services_category on services(category);
create index if not exists idx_services_company on services(company_id);
create index if not exists idx_portfolio_projects_company on portfolio_projects(company_id);
create index if not exists idx_portfolio_projects_status on portfolio_projects(status);
create index if not exists idx_tech_stack_category on tech_stack(category);
create index if not exists idx_career_type on career(type);
create index if not exists idx_career_status on career(status);

-- Triggers (migration-005)
create or replace trigger services_updated_at
  before update on services for each row execute function update_updated_at();
create or replace trigger career_updated_at
  before update on career for each row execute function update_updated_at();

-- RLS enable (migration-005)
alter table services enable row level security;
alter table portfolio_projects enable row level security;
alter table tech_stack enable row level security;
alter table career enable row level security;

-- authenticated policies (migration-005, IF NOT EXISTS で重複回避)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'auth_full' and tablename = 'services') then
    create policy "auth_full" on services for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'auth_full' and tablename = 'portfolio_projects') then
    create policy "auth_full" on portfolio_projects for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'auth_full' and tablename = 'tech_stack') then
    create policy "auth_full" on tech_stack for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'auth_full' and tablename = 'career') then
    create policy "auth_full" on career for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ============================================================
-- Part B: Hook用 anon RLS ポリシー追加
-- ============================================================
-- Claude Code の Hook (UserPromptSubmit, SessionStart) は
-- anon キーで Supabase REST API を呼ぶため、
-- Hook が書き込むテーブルに anon ポリシーを追加する。
-- ============================================================

-- prompt_log: Hook から INSERT + ダッシュボードから SELECT
create policy "anon_insert_prompt_log"
  on prompt_log for insert to anon with check (true);
create policy "anon_select_prompt_log"
  on prompt_log for select to anon using (true);

-- claude_settings: Hook から UPSERT (INSERT + UPDATE)
create policy "anon_all_claude_settings"
  on claude_settings for all to anon using (true) with check (true);

-- activity_log: Hook から INSERT + ダッシュボードから SELECT
create policy "anon_insert_activity_log"
  on activity_log for insert to anon with check (true);
create policy "anon_select_activity_log"
  on activity_log for select to anon using (true);

-- ============================================================
-- Part C: ダッシュボード読み取り用 anon SELECT
-- (ダッシュボードも anon キーで接続するため)
-- ============================================================

create policy "anon_select_companies"
  on companies for select to anon using (true);
create policy "anon_select_categories"
  on categories for select to anon using (true);
create policy "anon_select_departments"
  on departments for select to anon using (true);
create policy "anon_select_tasks"
  on tasks for select to anon using (true);
create policy "anon_select_comments"
  on comments for select to anon using (true);
create policy "anon_select_evaluations"
  on evaluations for select to anon using (true);
create policy "anon_select_ceo_insights"
  on ceo_insights for select to anon using (true);
create policy "anon_select_knowledge_base"
  on knowledge_base for select to anon using (true);
create policy "anon_select_services"
  on services for select to anon using (true);
create policy "anon_select_portfolio_projects"
  on portfolio_projects for select to anon using (true);
create policy "anon_select_tech_stack"
  on tech_stack for select to anon using (true);
create policy "anon_select_career"
  on career for select to anon using (true);
