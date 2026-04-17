-- ============================================================
-- Migration 024: diary テーブル（日記 + AI分析）
-- ============================================================

-- === diary_entries: 日記エントリー ===
create table if not exists diary_entries (
  id serial primary key,
  entry_date date not null,
  body text not null,                        -- 日記本文
  entry_type text not null default 'full'
    check (entry_type in ('full', 'fragment')),  -- フル入力 or 断片

  -- AI分析結果（/company の分析部が更新）
  emotions jsonb,                            -- Plutchik 8感情 {joy:80, trust:60, ...}
  perma_v jsonb,                             -- PERMA+V 8軸 {P:7, E:8, R:6, M:7, A:8, V:7, Au:6, St:5}
  wbi numeric(3,1),                          -- ウェルビーイングインデックス（8軸平均）
  topics text[],                             -- 検出されたトピック
  ai_summary text,                           -- AI要約
  personality_signals jsonb,                 -- Big Five シグナル

  -- カレンダー連携
  calendar_events jsonb,                     -- その日のカレンダーイベント（スナップショット）

  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- === diary_analysis: 定期分析レポート ===
create table if not exists diary_analysis (
  id serial primary key,
  period_type text not null
    check (period_type in ('weekly', 'monthly', 'quarterly', 'yearly')),
  period_start date not null,
  period_end date not null,

  -- 分析結果
  entry_count int not null default 0,
  avg_wbi numeric(3,1),
  emotion_distribution jsonb,               -- 期間内の感情出現分布
  perma_v_trend jsonb,                       -- 期間内のPERMA+V推移
  highlights jsonb,                          -- ベストデイ、チャレンジデイ
  topic_summary jsonb,                       -- トピック頻度
  personality_profile jsonb,                 -- Big Five プロファイル（30エントリー以上）
  growth_story text,                         -- 成長ストーリー（四半期・年次）
  ai_insights text,                          -- AI提言
  calendar_correlation jsonb,                -- カレンダー予定との相関分析
  prompt_correlation jsonb,                  -- 仕事量(prompt_log)との相関分析

  created_at timestamptz not null default now(),
  unique(period_type, period_start)
);

-- === RLS ===
alter table diary_entries enable row level security;
alter table diary_analysis enable row level security;

create policy "owner_full" on diary_entries for all to authenticated
  using (public.is_owner()) with check (public.is_owner());
create policy "owner_full" on diary_analysis for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Hook (anon + ingest key)
create policy "anon_insert_diary_entries_with_key"
  on diary_entries for insert to anon with check (public.check_ingest_key());
create policy "anon_update_diary_entries_with_key"
  on diary_entries for update to anon
  using (public.check_ingest_key()) with check (public.check_ingest_key());
create policy "anon_select_diary_entries_with_key"
  on diary_entries for select to anon using (public.check_ingest_key());

create policy "anon_insert_diary_analysis_with_key"
  on diary_analysis for insert to anon with check (public.check_ingest_key());
create policy "anon_update_diary_analysis_with_key"
  on diary_analysis for update to anon
  using (public.check_ingest_key()) with check (public.check_ingest_key());
create policy "anon_select_diary_analysis_with_key"
  on diary_analysis for select to anon using (public.check_ingest_key());

-- Indexes
create index idx_diary_entries_date on diary_entries(entry_date desc);
create index idx_diary_analysis_period on diary_analysis(period_type, period_start);
