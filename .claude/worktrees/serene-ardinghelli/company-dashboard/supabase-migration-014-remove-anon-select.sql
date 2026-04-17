-- ============================================================
-- Migration 014: anon SELECT ポリシー削除（セキュリティ強化）
-- ============================================================
-- 目的: anon key だけではデータを読めないようにする
-- ダッシュボードは GitHub OAuth (authenticated) で接続するため
-- authenticated の SELECT ポリシーだけで十分。
--
-- 残すもの:
--   - anon INSERT on prompt_log        (Hook: UserPromptSubmit)
--   - anon INSERT/UPDATE on claude_settings (Hook: SessionStart)
--   - anon INSERT on activity_log      (Hook: SessionStart)
--   - anon INSERT on secretary_notes   (GitHub Actions: intelligence collect)
--
-- 削除するもの:
--   - anon SELECT on 全テーブル
--   - anon ALL on secretary_notes → INSERT のみに縮小
-- ============================================================

-- ============================================================
-- Step 1: anon SELECT ポリシーを削除
-- ============================================================

-- migration-006 で作成された anon SELECT
drop policy if exists "anon_select_companies" on companies;
drop policy if exists "anon_select_categories" on categories;
drop policy if exists "anon_select_departments" on departments;
drop policy if exists "anon_select_tasks" on tasks;
drop policy if exists "anon_select_comments" on comments;
drop policy if exists "anon_select_evaluations" on evaluations;
drop policy if exists "anon_select_ceo_insights" on ceo_insights;
drop policy if exists "anon_select_knowledge_base" on knowledge_base;
drop policy if exists "anon_select_services" on services;
drop policy if exists "anon_select_portfolio_projects" on portfolio_projects;
drop policy if exists "anon_select_tech_stack" on tech_stack;
drop policy if exists "anon_select_career" on career;
drop policy if exists "anon_select_prompt_log" on prompt_log;
drop policy if exists "anon_select_activity_log" on activity_log;

-- ============================================================
-- Step 2: secretary_notes の anon ALL → INSERT のみに縮小
-- ============================================================

-- 現在: anon_all_secretary_notes (ALL) → 削除
drop policy if exists "anon_all_secretary_notes" on secretary_notes;

-- 新規: anon は INSERT のみ（intelligence collect 用）
create policy "anon_insert_secretary_notes"
  on secretary_notes for insert to anon with check (true);

-- ============================================================
-- Step 3: claude_settings の anon ALL → INSERT/UPDATE のみに縮小
-- ============================================================

drop policy if exists "anon_all_claude_settings" on claude_settings;

-- Hook が UPSERT するため INSERT + UPDATE が必要
create policy "anon_insert_claude_settings"
  on claude_settings for insert to anon with check (true);
create policy "anon_update_claude_settings"
  on claude_settings for update to anon using (true) with check (true);

-- ============================================================
-- Step 4: finance 系テーブルの anon SELECT も削除（存在する場合）
-- ============================================================

drop policy if exists "anon_select_invoices" on invoices;
drop policy if exists "anon_select_expenses" on expenses;
drop policy if exists "anon_select_work_hours" on work_hours;
drop policy if exists "anon_select_tax_simulations" on tax_simulations;

-- ============================================================
-- Step 5: hr 系テーブル（存在する場合）
-- ============================================================

drop policy if exists "anon_select_hr_proposals" on hr_proposals;
drop policy if exists "anon_select_hr_retrospectives" on hr_retrospectives;

-- ============================================================
-- 確認用: 残っている anon ポリシー一覧（実行後にこのクエリで確認）
-- ============================================================
-- SELECT policyname, tablename, cmd
-- FROM pg_policies
-- WHERE roles @> ARRAY['anon']::name[]
-- ORDER BY tablename, policyname;
--
-- 期待される結果:
--   anon_insert_prompt_log       | prompt_log       | INSERT
--   anon_insert_activity_log     | activity_log     | INSERT
--   anon_insert_claude_settings  | claude_settings  | INSERT
--   anon_update_claude_settings  | claude_settings  | UPDATE
--   anon_insert_secretary_notes  | secretary_notes  | INSERT
-- ============================================================
