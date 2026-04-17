-- ============================================================
-- Migration 015: anon INSERT に API Key ヘッダーチェックを追加
-- ============================================================
-- 目的: anon key だけでは INSERT もできないようにする
-- Hook / collect.py は x-ingest-key ヘッダーを付与する必要がある
--
-- 適用前に実行:
--   ALTER DATABASE postgres SET app.ingest_api_key = '<your-random-uuid>';
--   SELECT pg_reload_conf();
-- ============================================================

-- ============================================================
-- Step 0: データベースに ingest API key を設定（手動で実行）
-- ============================================================
-- 以下を SQL Editor で実行してください（migration とは別に）:
--
--   ALTER DATABASE postgres SET app.ingest_api_key = '<ランダムなUUID>';
--   SELECT pg_reload_conf();
--
-- UUID の生成:  SELECT gen_random_uuid();
-- ============================================================

-- ============================================================
-- Step 1: ヘッダー検証関数
-- ============================================================
create or replace function public.check_ingest_key()
returns boolean
language plpgsql
security definer
as $$
declare
  provided_key text;
  expected_key text;
begin
  -- リクエストヘッダーから x-ingest-key を取得
  provided_key := coalesce(
    current_setting('request.headers', true)::json->>'x-ingest-key',
    ''
  );

  -- データベース設定から期待値を取得
  expected_key := coalesce(
    current_setting('app.ingest_api_key', true),
    ''
  );

  -- 空の場合は拒否（設定ミス防止）
  if expected_key = '' then
    return false;
  end if;

  return provided_key = expected_key;
end;
$$;

-- ============================================================
-- Step 2: 既存の anon INSERT/UPDATE/ALL ポリシーを削除
-- ============================================================

-- prompt_log
drop policy if exists "anon_insert_prompt_log" on prompt_log;

-- activity_log
drop policy if exists "anon_insert_activity_log" on activity_log;

-- claude_settings (migration-014 で作成)
drop policy if exists "anon_insert_claude_settings" on claude_settings;
drop policy if exists "anon_update_claude_settings" on claude_settings;
-- (migration-010 で作成されたものがまだ残っている場合)
drop policy if exists "anon_all_claude_settings" on claude_settings;

-- secretary_notes (migration-014 で作成)
drop policy if exists "anon_insert_secretary_notes" on secretary_notes;
-- (migration-010 で作成されたものがまだ残っている場合)
drop policy if exists "anon_all_secretary_notes" on secretary_notes;

-- ============================================================
-- Step 3: API Key チェック付き anon INSERT ポリシーを作成
-- ============================================================

-- prompt_log: Hook (UserPromptSubmit) から INSERT
create policy "anon_insert_prompt_log_with_key"
  on prompt_log for insert to anon
  with check (public.check_ingest_key());

-- activity_log: Hook (SessionStart) から INSERT
create policy "anon_insert_activity_log_with_key"
  on activity_log for insert to anon
  with check (public.check_ingest_key());

-- claude_settings: Hook (SessionStart) から UPSERT
create policy "anon_insert_claude_settings_with_key"
  on claude_settings for insert to anon
  with check (public.check_ingest_key());

create policy "anon_update_claude_settings_with_key"
  on claude_settings for update to anon
  using (public.check_ingest_key())
  with check (public.check_ingest_key());

-- secretary_notes: intelligence collect.py から INSERT
create policy "anon_insert_secretary_notes_with_key"
  on secretary_notes for insert to anon
  with check (public.check_ingest_key());

-- ============================================================
-- 確認用クエリ
-- ============================================================
-- SELECT policyname, tablename, cmd
-- FROM pg_policies
-- WHERE roles @> ARRAY['anon']::name[]
-- ORDER BY tablename, policyname;
--
-- 期待される結果:
--   anon_insert_activity_log_with_key     | activity_log     | INSERT
--   anon_insert_claude_settings_with_key  | claude_settings  | INSERT
--   anon_update_claude_settings_with_key  | claude_settings  | UPDATE
--   anon_insert_prompt_log_with_key       | prompt_log       | INSERT
--   anon_insert_secretary_notes_with_key  | secretary_notes  | INSERT
--
-- テスト:
--   x-ingest-key ヘッダーなしで INSERT → 403
--   x-ingest-key ヘッダーありで INSERT → 201
-- ============================================================
