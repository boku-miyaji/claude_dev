-- ============================================================
-- Migration 037: secretary_notes の RLS ポリシー修正
-- 問題: SELECT ポリシーがないため、ダッシュボードから読めない
--        INSERT も check_ingest_key() が正しく動作していない可能性
-- ============================================================

-- SELECT: x-ingest-key ヘッダーで読み取り許可
create policy "anon_select_secretary_notes_with_key"
  on secretary_notes for select to anon
  using (public.check_ingest_key());

-- INSERT: 既存ポリシーを再作成（念のため）
drop policy if exists "anon_insert_secretary_notes_with_key" on secretary_notes;
create policy "anon_insert_secretary_notes_with_key"
  on secretary_notes for insert to anon
  with check (public.check_ingest_key());

-- authenticated ユーザーに全操作を許可（ダッシュボードログインユーザー）
create policy "auth_full_secretary_notes"
  on secretary_notes for all to authenticated
  using (true)
  with check (true);

-- ============================================================
-- テスト:
--   x-ingest-key ヘッダーありで SELECT → 200 + データ
--   x-ingest-key ヘッダーありで INSERT → 201
--   x-ingest-key ヘッダーなしで SELECT → 200 + 空配列
--   x-ingest-key ヘッダーなしで INSERT → 403
-- ============================================================
