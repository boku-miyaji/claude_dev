-- ============================================================
-- Migration 021: companies / departments に ingest-key INSERT/UPDATE ポリシー追加
-- ============================================================
-- 目的: company-sync.sh Hook から anon + x-ingest-key で
--       companies / departments テーブルに upsert できるようにする
-- 背景: migration-018 で anon_all を削除したが、Hook からの
--       自動同期（SessionStart）に必要なポリシーが未追加だった
-- ============================================================

-- === companies: INSERT with ingest key ===
create policy "anon_insert_companies_with_key"
  on companies for insert to anon
  with check (public.check_ingest_key());

-- === companies: UPDATE with ingest key ===
create policy "anon_update_companies_with_key"
  on companies for update to anon
  using (public.check_ingest_key())
  with check (public.check_ingest_key());

-- === departments: INSERT with ingest key ===
create policy "anon_insert_departments_with_key"
  on departments for insert to anon
  with check (public.check_ingest_key());

-- === departments: UPDATE with ingest key ===
create policy "anon_update_departments_with_key"
  on departments for update to anon
  using (public.check_ingest_key())
  with check (public.check_ingest_key());

-- ============================================================
-- 確認用
-- ============================================================
-- SELECT policyname, tablename, cmd
-- FROM pg_policies
-- WHERE roles @> ARRAY['anon']::name[]
-- ORDER BY tablename, policyname;
--
-- 期待: companies 2件 + departments 2件 が追加
-- ============================================================
