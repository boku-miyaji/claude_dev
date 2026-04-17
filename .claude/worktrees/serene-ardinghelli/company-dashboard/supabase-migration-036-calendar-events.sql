-- ============================================================
-- Migration 036: calendar_events テーブル追加
-- ============================================================
-- 目的: Google Calendar のイベントを Supabase にキャッシュし、
--       ダッシュボードから閲覧可能にする。
--       /company 起動時に MCP 経由で同期される。
-- ============================================================

-- === テーブル作成 ===
create table if not exists calendar_events (
  id text not null,
  calendar_id text not null,
  summary text,
  start_time timestamptz,
  end_time timestamptz,
  all_day boolean default false,
  location text,
  description text,
  status text default 'confirmed',
  response_status text,
  calendar_type text default 'primary',  -- primary, work, secondary
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  primary key (id, calendar_id)
);

-- === RLS 有効化 ===
alter table calendar_events enable row level security;

-- === authenticated ユーザー向けポリシー ===
create policy "calendar_events_auth_select"
  on calendar_events for select to authenticated
  using (true);

-- === ingest key 経由の CLI アクセス ===
create policy "calendar_events_ingest_select"
  on calendar_events for select to anon
  using (public.check_ingest_key());

create policy "calendar_events_ingest_insert"
  on calendar_events for insert to anon
  with check (public.check_ingest_key());

create policy "calendar_events_ingest_update"
  on calendar_events for update to anon
  using (public.check_ingest_key())
  with check (public.check_ingest_key());

create policy "calendar_events_ingest_delete"
  on calendar_events for delete to anon
  using (public.check_ingest_key());

-- === インデックス ===
create index if not exists idx_calendar_events_start
  on calendar_events (start_time);

create index if not exists idx_calendar_events_type
  on calendar_events (calendar_type);
