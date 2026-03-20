-- ============================================================
-- Migration 011: pipeline_runs - パイプライン実行実績の記録
-- ============================================================
-- 見積もり時間と実績時間を記録し、見積もり精度を向上させる。
-- /company の実行プロトコルが完了時に自動 INSERT する。
-- ============================================================

create table if not exists pipeline_runs (
  id serial primary key,
  company_id text references companies(id) on delete set null,
  pipeline_type text not null
    check (pipeline_type in ('A', 'B', 'C', 'D')),
  complexity text not null default 'medium'
    check (complexity in ('small', 'medium', 'large')),
  task_summary text not null,
  execution_mode text not null default 'checkpoint'
    check (execution_mode in ('full-auto', 'checkpoint', 'step-by-step')),
  steps jsonb not null default '[]',
  -- steps format: [{"dept": "research/tech", "estimated_min": 3, "actual_min": 2}, ...]
  total_estimated_minutes numeric(6,1),
  total_actual_minutes numeric(6,1),
  accuracy_pct numeric(5,1),
  -- accuracy = 100 - abs(estimated - actual) / estimated * 100
  checkpoints_used text[] not null default '{}',
  rework_count int not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pipeline_runs_company on pipeline_runs(company_id);
create index if not exists idx_pipeline_runs_type on pipeline_runs(pipeline_type);
create index if not exists idx_pipeline_runs_complexity on pipeline_runs(complexity);
create index if not exists idx_pipeline_runs_created on pipeline_runs(created_at desc);

-- RLS
alter table pipeline_runs enable row level security;

drop policy if exists "auth_full" on pipeline_runs;
create policy "auth_full" on pipeline_runs for all to authenticated using (true) with check (true);

drop policy if exists "anon_all_pipeline_runs" on pipeline_runs;
create policy "anon_all_pipeline_runs" on pipeline_runs for all to anon using (true) with check (true);

-- View: 見積もり精度サマリー（会社・パイプライン・複雑さ別）
create or replace view pipeline_estimation_stats as
select
  company_id,
  pipeline_type,
  complexity,
  count(*) as run_count,
  round(percentile_cont(0.5) within group (order by total_actual_minutes)::numeric, 1) as median_actual_min,
  round(avg(total_actual_minutes)::numeric, 1) as avg_actual_min,
  round(avg(accuracy_pct)::numeric, 1) as avg_accuracy_pct,
  round(stddev(total_actual_minutes)::numeric, 1) as stddev_min
from pipeline_runs
where total_actual_minutes is not null
group by company_id, pipeline_type, complexity;
