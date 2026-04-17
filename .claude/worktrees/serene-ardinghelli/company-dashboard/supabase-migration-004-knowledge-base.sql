-- ============================================================
-- Migration 004: Add knowledge_base + claude_md_content
-- ============================================================

-- ナレッジベース
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

-- Indexes
create index if not exists idx_knowledge_base_category on knowledge_base(category);
create index if not exists idx_knowledge_base_scope on knowledge_base(scope);
create index if not exists idx_knowledge_base_status on knowledge_base(status);
create index if not exists idx_knowledge_base_company on knowledge_base(company_id);

-- Trigger
create or replace trigger knowledge_base_updated_at
  before update on knowledge_base
  for each row execute function update_updated_at();

-- RLS
alter table knowledge_base enable row level security;
create policy "auth_full" on knowledge_base for all to authenticated using (true) with check (true);

-- Add claude_md_content to claude_settings
alter table claude_settings add column if not exists claude_md_content text;
