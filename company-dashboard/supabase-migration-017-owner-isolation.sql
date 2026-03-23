-- ============================================================
-- Migration 017: オーナー限定 RLS（ユーザー分離）
-- ============================================================
-- 目的: user_settings に登録されたユーザーだけがデータにアクセスできるようにする
-- 他の GitHub ユーザーがログインしても一切データが見えない
--
-- 仕組み:
--   is_owner() = user_settings テーブルに自分の user_id があるか確認
--   全テーブルの authenticated ポリシーを is_owner() に差し替え
--   user_settings 自体は auth.uid() で制御（自分の行のみ）
-- ============================================================

-- ============================================================
-- Step 1: is_owner() 関数を作成
-- ============================================================
create or replace function public.is_owner()
returns boolean
language plpgsql
security definer
stable  -- キャッシュ可能（同一トランザクション内で結果が変わらない）
as $$
begin
  return exists (
    select 1 from public.user_settings
    where user_id = auth.uid()
  );
end;
$$;

-- ============================================================
-- Step 2: 全テーブルの "auth_full" を "owner_full" に差し替え
-- ============================================================

-- --- Core tables (migration-002) ---
drop policy if exists "auth_full" on categories;
create policy "owner_full" on categories for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on companies;
create policy "owner_full" on companies for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on departments;
create policy "owner_full" on departments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on tasks;
create policy "owner_full" on tasks for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on comments;
create policy "owner_full" on comments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on evaluations;
create policy "owner_full" on evaluations for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on activity_log;
create policy "owner_full" on activity_log for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- --- Prompt & Insights (migration-003) ---
drop policy if exists "auth_full" on prompt_log;
create policy "owner_full" on prompt_log for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on ceo_insights;
create policy "owner_full" on ceo_insights for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- --- Knowledge (migration-004) ---
drop policy if exists "auth_full" on knowledge_base;
create policy "owner_full" on knowledge_base for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- --- Portfolio & Career (migration-005) ---
drop policy if exists "auth_full" on services;
create policy "owner_full" on services for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on portfolio_projects;
create policy "owner_full" on portfolio_projects for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on tech_stack;
create policy "owner_full" on tech_stack for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on career;
create policy "owner_full" on career for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- --- Slash Commands (migration-007) ---
drop policy if exists "auth_full" on slash_commands;
create policy "owner_full" on slash_commands for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- --- Finance (migration-008) ---
drop policy if exists "auth_full" on projects;
create policy "owner_full" on projects for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on invoices;
create policy "owner_full" on invoices for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on expenses;
create policy "owner_full" on expenses for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on time_entries;
create policy "owner_full" on time_entries for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on tax_payments;
create policy "owner_full" on tax_payments for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- --- Company State (migration-010) ---
drop policy if exists "auth_full" on secretary_notes;
create policy "owner_full" on secretary_notes for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on hr_proposals;
create policy "owner_full" on hr_proposals for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "auth_full" on hr_retrospectives;
create policy "owner_full" on hr_retrospectives for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- --- Pipeline Runs (migration-011) ---
drop policy if exists "auth_full" on pipeline_runs;
create policy "owner_full" on pipeline_runs for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- --- Claude Settings ---
drop policy if exists "auth_full" on claude_settings;
create policy "owner_full" on claude_settings for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ============================================================
-- Step 3: user_settings は自分の行のみ（migration-016 で設定済み）
-- ============================================================
-- user_settings_select_own: user_id = auth.uid()
-- user_settings_insert_own: user_id = auth.uid()
-- user_settings_update_own: user_id = auth.uid()
-- → 変更不要

-- ============================================================
-- 確認用クエリ
-- ============================================================
-- SELECT tablename, policyname, qual, with_check
-- FROM pg_policies
-- WHERE roles @> ARRAY['authenticated']::name[]
--   AND policyname LIKE 'owner_%'
-- ORDER BY tablename;
--
-- 期待: 全テーブルが owner_full で is_owner() を使用
--
-- テスト:
--   1. user_settings に登録済みユーザーでログイン → 全データ見える
--   2. 未登録ユーザーでログイン → 何も見えない
-- ============================================================
