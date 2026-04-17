-- ============================================================
-- Migration 020: intelligence_sources にスコア・フィードバック機能追加
-- ============================================================

-- スコア・フィードバックカラム追加
alter table intelligence_sources add column if not exists score float not null default 1.0;
alter table intelligence_sources add column if not exists feedback_count int not null default 0;
alter table intelligence_sources add column if not exists useful_count int not null default 0;
alter table intelligence_sources add column if not exists noise_count int not null default 0;
alter table intelligence_sources add column if not exists last_feedback_at timestamptz;

-- フィードバック履歴テーブル
create table if not exists intelligence_feedback (
  id serial primary key,
  source_id int references intelligence_sources(id) on delete cascade,
  feedback text not null check (feedback in ('useful', 'noise')),
  report_date date,
  item_context text,  -- どのレポートアイテムに対するFBか
  created_at timestamptz not null default now()
);

create index if not exists idx_intelligence_feedback_source on intelligence_feedback(source_id);

-- RLS
alter table intelligence_feedback enable row level security;

create policy "owner_full" on intelligence_feedback for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- Anon: ingest-key で INSERT（collect.py からの自動FB用）
create policy "anon_insert_feedback_with_key"
  on intelligence_feedback for insert to anon
  with check (public.check_ingest_key());

-- ============================================================
-- スコア更新関数
-- ============================================================
-- フィードバック時にスコアを即時更新する
create or replace function public.apply_source_feedback(
  p_source_id int,
  p_feedback text,
  p_item_context text default null
)
returns void
language plpgsql
security definer
as $$
declare
  current_score float;
  new_score float;
  delta float := 0.3;
begin
  select score into current_score from intelligence_sources where id = p_source_id;
  if not found then return; end if;

  if p_feedback = 'useful' then
    new_score := least(current_score + delta, 2.0);
    update intelligence_sources set
      score = new_score,
      feedback_count = feedback_count + 1,
      useful_count = useful_count + 1,
      last_feedback_at = now()
    where id = p_source_id;
  elsif p_feedback = 'noise' then
    new_score := greatest(current_score - delta, 0.1);
    update intelligence_sources set
      score = new_score,
      feedback_count = feedback_count + 1,
      noise_count = noise_count + 1,
      last_feedback_at = now()
    where id = p_source_id;
  end if;

  -- 履歴に記録
  insert into intelligence_feedback (source_id, feedback, item_context)
  values (p_source_id, p_feedback, p_item_context);
end;
$$;

-- ============================================================
-- 日次減衰関数（cron or 手動で実行）
-- ============================================================
-- 7日以上 FB がないソースのスコアをデフォルト(1.0)に向かって 15% 減衰
create or replace function public.decay_source_scores()
returns int
language plpgsql
security definer
as $$
declare
  affected int;
begin
  update intelligence_sources
  set score = score + (1.0 - score) * 0.15,
      updated_at = now()
  where enabled = true
    and (last_feedback_at is null or last_feedback_at < now() - interval '7 days')
    and abs(score - 1.0) > 0.05;  -- スキップ: 既にデフォルト付近

  get diagnostics affected = row_count;
  return affected;
end;
$$;

-- ============================================================
-- 確認用
-- ============================================================
-- スコア確認:
-- SELECT name, source_type, score, feedback_count, useful_count, noise_count, last_feedback_at
-- FROM intelligence_sources ORDER BY score DESC;
--
-- 減衰実行:
-- SELECT decay_source_scores();
--
-- フィードバック適用:
-- SELECT apply_source_feedback(1, 'useful', 'Claude Code v2.1.76 release');
