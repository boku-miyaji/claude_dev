-- ============================================================
-- Migration 005: Portfolio (services, projects, tech_stack) + Career
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

-- Indexes
create index if not exists idx_services_category on services(category);
create index if not exists idx_services_company on services(company_id);
create index if not exists idx_portfolio_projects_company on portfolio_projects(company_id);
create index if not exists idx_portfolio_projects_status on portfolio_projects(status);
create index if not exists idx_tech_stack_category on tech_stack(category);
create index if not exists idx_career_type on career(type);
create index if not exists idx_career_status on career(status);

-- Triggers
create or replace trigger services_updated_at
  before update on services for each row execute function update_updated_at();
create or replace trigger career_updated_at
  before update on career for each row execute function update_updated_at();

-- RLS
alter table services enable row level security;
alter table portfolio_projects enable row level security;
alter table tech_stack enable row level security;
alter table career enable row level security;
create policy "auth_full" on services for all to authenticated using (true) with check (true);
create policy "auth_full" on portfolio_projects for all to authenticated using (true) with check (true);
create policy "auth_full" on tech_stack for all to authenticated using (true) with check (true);
create policy "auth_full" on career for all to authenticated using (true) with check (true);
