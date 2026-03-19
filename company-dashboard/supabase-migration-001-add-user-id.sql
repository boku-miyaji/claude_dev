-- ============================================================
-- Migration 001: Add user_id to all tables + RLS per user
-- ============================================================
-- Run this in Supabase SQL Editor if you already have the tables.
-- For new installations, use supabase-setup.sql instead.
-- ============================================================

-- 1. Add user_id column to all tables
-- default auth.uid() ensures API inserts auto-fill the current user
alter table categories     add column if not exists user_id uuid default auth.uid();
alter table companies      add column if not exists user_id uuid default auth.uid();
alter table departments    add column if not exists user_id uuid default auth.uid();
alter table tasks          add column if not exists user_id uuid default auth.uid();
alter table comments       add column if not exists user_id uuid default auth.uid();
alter table evaluations    add column if not exists user_id uuid default auth.uid();
alter table activity_log   add column if not exists user_id uuid default auth.uid();
alter table claude_settings add column if not exists user_id uuid default auth.uid();

-- 2. Add indexes on user_id
create index if not exists idx_categories_user on categories(user_id);
create index if not exists idx_companies_user on companies(user_id);
create index if not exists idx_departments_user on departments(user_id);
create index if not exists idx_tasks_user on tasks(user_id);
create index if not exists idx_comments_user on comments(user_id);
create index if not exists idx_evaluations_user on evaluations(user_id);
create index if not exists idx_activity_log_user on activity_log(user_id);
create index if not exists idx_claude_settings_user on claude_settings(user_id);

-- 3. Drop old permissive policies
drop policy if exists "auth_full_categories" on categories;
drop policy if exists "auth_full_companies" on companies;
drop policy if exists "auth_full_departments" on departments;
drop policy if exists "auth_full_tasks" on tasks;
drop policy if exists "auth_full_comments" on comments;
drop policy if exists "auth_full_evaluations" on evaluations;
drop policy if exists "auth_full_activity_log" on activity_log;
drop policy if exists "auth_full_claude_settings" on claude_settings;

-- 4. Create new per-user policies
-- Each user can only see and modify their own data
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

-- 5. Recreate views with user_id filtering
drop view if exists company_task_summary;
create view company_task_summary with (security_invoker = true) as
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

drop view if exists recent_activity;
create view recent_activity with (security_invoker = true) as
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

-- 6. Update log_activity function to include user_id
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
