-- ============================================================
-- Migration 052: slash_commands に skill_content カラム追加
-- ============================================================
-- SKILL.md の全文をダッシュボードから閲覧可能にする。
-- Hook (sync-slash-commands.sh) が anon key で同期するため、anon ポリシーも追加。

alter table slash_commands add column if not exists skill_content text;

-- Hook が anon key で upsert するためのポリシー
-- （slash_commands は設定データであり個人情報を含まない）
create policy if not exists "anon_upsert_slash_commands"
  on slash_commands for all to anon using (true) with check (true);
