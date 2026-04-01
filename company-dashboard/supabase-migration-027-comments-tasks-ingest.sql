-- ============================================================
-- Migration 027: comments / tasks に ingest-key ポリシー追加
-- ============================================================
-- 目的: CLI (anon + x-ingest-key) から comments / tasks を読み書きできるようにする
-- 既存の owner_full (authenticated) ポリシーはそのまま維持
-- ============================================================

-- === comments: SELECT with ingest key ===
create policy "comments_ingest_select"
  on comments for select to anon
  using (public.check_ingest_key());

-- === comments: INSERT with ingest key ===
create policy "comments_ingest_insert"
  on comments for insert to anon
  with check (public.check_ingest_key());

-- === comments: UPDATE with ingest key ===
create policy "comments_ingest_update"
  on comments for update to anon
  using (public.check_ingest_key())
  with check (public.check_ingest_key());

-- === tasks: SELECT with ingest key ===
create policy "tasks_ingest_select"
  on tasks for select to anon
  using (public.check_ingest_key());

-- === tasks: INSERT with ingest key ===
create policy "tasks_ingest_insert"
  on tasks for insert to anon
  with check (public.check_ingest_key());

-- === tasks: UPDATE with ingest key ===
create policy "tasks_ingest_update"
  on tasks for update to anon
  using (public.check_ingest_key())
  with check (public.check_ingest_key());
