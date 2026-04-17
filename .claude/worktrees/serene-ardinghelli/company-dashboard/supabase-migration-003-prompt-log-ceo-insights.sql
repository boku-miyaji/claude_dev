-- ============================================================
-- Migration 003: Add prompt_log + ceo_insights tables
-- ============================================================
-- Run this in SQL Editor if you already have the base schema.
-- ============================================================

-- 社長プロンプト履歴
create table if not exists prompt_log (
  id serial primary key,
  company_id text references companies(id) on delete set null,
  prompt text not null,
  context text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- 社長分析
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

-- Indexes
create index if not exists idx_prompt_log_company on prompt_log(company_id);
create index if not exists idx_prompt_log_created on prompt_log(created_at desc);
create index if not exists idx_prompt_log_tags on prompt_log using gin(tags);
create index if not exists idx_ceo_insights_category on ceo_insights(category);
create index if not exists idx_ceo_insights_company on ceo_insights(company_id);

-- Trigger
create or replace trigger ceo_insights_updated_at
  before update on ceo_insights
  for each row execute function update_updated_at();

-- RLS
alter table prompt_log enable row level security;
alter table ceo_insights enable row level security;
create policy "auth_full" on prompt_log for all to authenticated using (true) with check (true);
create policy "auth_full" on ceo_insights for all to authenticated using (true) with check (true);

-- Add mcp_servers to claude_settings if missing
alter table claude_settings add column if not exists mcp_servers jsonb not null default '{}';
