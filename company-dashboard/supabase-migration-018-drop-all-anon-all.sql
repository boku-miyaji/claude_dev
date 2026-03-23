-- ============================================================
-- Migration 018: 残存する anon_all ポリシーを全て削除
-- ============================================================
-- 問題: migration-010, 007, 008, 011 で作成された anon_all ポリシーが
-- migration-014 では削除されていなかった（anon_select のみ削除）
-- 結果: anon key だけで全データの読み書き削除が可能な状態だった
-- ============================================================

-- === migration-010 で作成された anon_all ===
drop policy if exists "anon_all_companies" on companies;
drop policy if exists "anon_all_departments" on departments;
drop policy if exists "anon_all_tasks" on tasks;
drop policy if exists "anon_all_comments" on comments;
drop policy if exists "anon_all_evaluations" on evaluations;
drop policy if exists "anon_all_ceo_insights" on ceo_insights;
drop policy if exists "anon_all_knowledge_base" on knowledge_base;
drop policy if exists "anon_all_categories" on categories;
drop policy if exists "anon_all_hr_proposals" on hr_proposals;
drop policy if exists "anon_all_hr_retrospectives" on hr_retrospectives;

-- === migration-007 ===
drop policy if exists "anon_all_slash_commands" on slash_commands;

-- === migration-008 ===
drop policy if exists "anon_all" on projects;
drop policy if exists "anon_all" on invoices;
drop policy if exists "anon_all" on expenses;
drop policy if exists "anon_all" on time_entries;
drop policy if exists "anon_all" on tax_payments;

-- === migration-011 ===
drop policy if exists "anon_all_pipeline_runs" on pipeline_runs;

-- === secretary_notes: migration-014 で anon_insert に縮小済みだが念のため ===
drop policy if exists "anon_all_secretary_notes" on secretary_notes;

-- === claude_settings: migration-015 で anon_insert/update に縮小済みだが念のため ===
drop policy if exists "anon_all_claude_settings" on claude_settings;

-- ============================================================
-- 残存すべき anon ポリシー（ingest-key 付き INSERT/UPDATE のみ）
-- ============================================================
-- anon_insert_prompt_log_with_key       | prompt_log       | INSERT
-- anon_insert_activity_log_with_key     | activity_log     | INSERT
-- anon_insert_claude_settings_with_key  | claude_settings  | INSERT
-- anon_update_claude_settings_with_key  | claude_settings  | UPDATE
-- anon_insert_secretary_notes_with_key  | secretary_notes  | INSERT

-- ============================================================
-- secretary_notes CHECK 制約を更新（intelligence_report を追加）
-- ============================================================
alter table secretary_notes drop constraint if exists secretary_notes_type_check;
alter table secretary_notes add constraint secretary_notes_type_check
  check (type in ('inbox', 'decision', 'learning', 'note', 'intelligence_report'));

-- ============================================================
-- 確認用
-- ============================================================
-- SELECT policyname, tablename, cmd
-- FROM pg_policies
-- WHERE roles @> ARRAY['anon']::name[]
-- ORDER BY tablename, policyname;
--
-- 期待: 5件のみ（全て _with_key 付き INSERT/UPDATE）
-- ============================================================
