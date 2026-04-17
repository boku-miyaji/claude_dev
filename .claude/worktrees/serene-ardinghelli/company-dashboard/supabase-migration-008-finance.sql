-- ============================================================
-- Migration 008: 財務管理テーブル
-- ============================================================
-- 売上・経費・稼働時間・税金を一元管理。
-- /invoice スキルから操作、ダッシュボードで可視化。
-- ============================================================

-- 案件マスター
create table if not exists projects (
  id serial primary key,
  name text not null,                     -- 案件名（例: "○○システム開発"）
  client_name text not null,              -- 会社名（例: "A社"）
  description text,                       -- 案件概要
  contract_type text not null default 'project'
    check (contract_type in ('project', 'monthly', 'hourly', 'consulting')),
  default_rate integer,                   -- 目標時給（円）
  budget integer,                         -- 予算（円・税込）
  start_date date,
  end_date date,
  status text not null default 'active'
    check (status in ('active', 'completed', 'paused', 'cancelled')),
  company_id text references companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 請求書（売上）
create table if not exists invoices (
  id serial primary key,
  project_id integer references projects(id) on delete set null,
  invoice_number text,                    -- 請求書番号
  client_name text not null,              -- 請求先
  amount integer not null,                -- 請求額（税込・円）
  tax_amount integer default 0,           -- うち消費税額
  invoice_date date not null,             -- 請求日
  due_date date,                          -- 支払期日
  paid_date date,                         -- 入金日
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled')),
  file_url text,                          -- 請求書ファイルURL
  notes text,
  company_id text references companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 経費
create table if not exists expenses (
  id serial primary key,
  project_id integer references projects(id) on delete set null,
  category text not null
    check (category in (
      'equipment',      -- 機材・ソフトウェア
      'transportation', -- 交通費
      'communication',  -- 通信費
      'office',         -- 事務所・家賃
      'outsourcing',    -- 外注費
      'supplies',       -- 消耗品
      'insurance',      -- 保険
      'tax_payment',    -- 税金支払い
      'subscription',   -- サブスクリプション
      'education',      -- 研修・書籍
      'entertainment',  -- 交際費
      'other'           -- その他
    )),
  description text not null,              -- 内容
  amount integer not null,                -- 金額（税込・円）
  tax_amount integer default 0,           -- うち消費税額
  expense_date date not null,             -- 支出日
  is_deductible boolean not null default true,  -- 経費算入可否
  receipt_url text,                       -- レシート画像URL
  notes text,
  company_id text references companies(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 稼働記録
create table if not exists time_entries (
  id serial primary key,
  project_id integer references projects(id) on delete set null,
  work_date date not null,                -- 稼働日
  hours numeric(4,2) not null,            -- 稼働時間
  description text,                       -- 作業内容
  source text not null default 'manual'
    check (source in ('calendar', 'manual')),
  calendar_event_id text,                 -- Google Calendar イベントID（重複防止）
  company_id text references companies(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(calendar_event_id)               -- 同じイベントを二重登録しない
);

-- 税金支払いスケジュール
create table if not exists tax_payments (
  id serial primary key,
  tax_year integer not null,              -- 対象年度
  tax_type text not null
    check (tax_type in (
      'income_tax',         -- 所得税
      'consumption_tax',    -- 消費税
      'resident_tax',       -- 住民税
      'business_tax',       -- 個人事業税
      'estimated_tax'       -- 予定納税
    )),
  period text,                            -- 期（例: "第1期", "確定申告"）
  amount integer not null,                -- 金額（円）
  due_date date not null,                 -- 納付期限
  paid_date date,                         -- 支払日
  status text not null default 'upcoming'
    check (status in ('upcoming', 'paid', 'overdue')),
  notes text,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_projects_client on projects(client_name);
create index if not exists idx_invoices_project on invoices(project_id);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_date on invoices(invoice_date);
create index if not exists idx_expenses_project on expenses(project_id);
create index if not exists idx_expenses_date on expenses(expense_date);
create index if not exists idx_expenses_category on expenses(category);
create index if not exists idx_time_entries_project on time_entries(project_id);
create index if not exists idx_time_entries_date on time_entries(work_date);
create index if not exists idx_time_entries_calendar on time_entries(calendar_event_id);
create index if not exists idx_tax_payments_year on tax_payments(tax_year);
create index if not exists idx_tax_payments_due on tax_payments(due_date);

-- Triggers
create or replace trigger projects_updated_at
  before update on projects for each row execute function update_updated_at();
create or replace trigger invoices_updated_at
  before update on invoices for each row execute function update_updated_at();

-- RLS
alter table projects enable row level security;
alter table invoices enable row level security;
alter table expenses enable row level security;
alter table time_entries enable row level security;
alter table tax_payments enable row level security;

-- Auth policies
create policy "auth_full" on projects for all to authenticated using (true) with check (true);
create policy "auth_full" on invoices for all to authenticated using (true) with check (true);
create policy "auth_full" on expenses for all to authenticated using (true) with check (true);
create policy "auth_full" on time_entries for all to authenticated using (true) with check (true);
create policy "auth_full" on tax_payments for all to authenticated using (true) with check (true);

-- Anon policies (for hooks/skills)
create policy "anon_all" on projects for all to anon using (true) with check (true);
create policy "anon_all" on invoices for all to anon using (true) with check (true);
create policy "anon_all" on expenses for all to anon using (true) with check (true);
create policy "anon_all" on time_entries for all to anon using (true) with check (true);
create policy "anon_all" on tax_payments for all to anon using (true) with check (true);
