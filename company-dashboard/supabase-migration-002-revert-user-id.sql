-- ============================================================
-- Migration 002: Revert user_id (single-tenant, user_id不要)
-- ============================================================
-- Run this if you previously ran migration-001-add-user-id.sql.
-- Each user has their own Supabase project, so row-level user isolation is unnecessary.
-- ============================================================

-- Drop user_id columns
alter table categories drop column if exists user_id;
alter table companies drop column if exists user_id;
alter table departments drop column if exists user_id;
alter table tasks drop column if exists user_id;
alter table comments drop column if exists user_id;
alter table evaluations drop column if exists user_id;
alter table activity_log drop column if exists user_id;
alter table claude_settings drop column if exists user_id;

-- Drop user_id indexes
drop index if exists idx_categories_user;
drop index if exists idx_companies_user;
drop index if exists idx_departments_user;
drop index if exists idx_tasks_user;
drop index if exists idx_comments_user;
drop index if exists idx_evaluations_user;
drop index if exists idx_activity_log_user;
drop index if exists idx_claude_settings_user;

-- Replace own_data policies with simple auth_full policies
drop policy if exists "own_data" on categories;
drop policy if exists "own_data" on companies;
drop policy if exists "own_data" on departments;
drop policy if exists "own_data" on tasks;
drop policy if exists "own_data" on comments;
drop policy if exists "own_data" on evaluations;
drop policy if exists "own_data" on activity_log;
drop policy if exists "own_data" on claude_settings;

create policy "auth_full" on categories for all to authenticated using (true) with check (true);
create policy "auth_full" on companies for all to authenticated using (true) with check (true);
create policy "auth_full" on departments for all to authenticated using (true) with check (true);
create policy "auth_full" on tasks for all to authenticated using (true) with check (true);
create policy "auth_full" on comments for all to authenticated using (true) with check (true);
create policy "auth_full" on evaluations for all to authenticated using (true) with check (true);
create policy "auth_full" on activity_log for all to authenticated using (true) with check (true);
create policy "auth_full" on claude_settings for all to authenticated using (true) with check (true);

-- Add mcp_servers column to claude_settings if not exists
alter table claude_settings add column if not exists mcp_servers jsonb not null default '{}';

-- Recreate views without security_invoker (not needed for single-tenant)
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

-- Recreate helper function without security definer
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
