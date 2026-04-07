-- ============================================================
-- Migration 053: skill_candidates テーブル
-- ============================================================
-- prompt_log のパターン分析から検出されたスキル候補を蓄積する。
-- バッチ間をまたいで count を蓄積し、閾値到達で社長に提案する。

create table if not exists skill_candidates (
  id uuid primary key default gen_random_uuid(),
  pattern_name text not null,                    -- パターンの短い名前 (例: "mtg-prep-flow")
  pattern_description text not null,             -- パターンの説明
  example_prompts text[] not null default '{}',  -- 検出元のプロンプト例（最大5件）
  detection_count int not null default 1,        -- 検出回数（バッチをまたいで蓄積）
  threshold int not null default 3,              -- 提案までの閾値
  status text not null default 'candidate'
    check (status in (
      'candidate',    -- 蓄積中
      'proposed',     -- 社長に提案済み
      'approved',     -- 承認済み → SKILL.md 生成へ
      'rejected',     -- 却下
      'created'       -- SKILL.md 生成完了
    )),
  skill_draft text,                              -- LLM が生成した SKILL.md のドラフト
  created_skill_path text,                       -- 生成された SKILL.md のパス
  proposed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_skill_candidates_status on skill_candidates(status);

-- RLS
alter table skill_candidates enable row level security;
create policy "owner_full" on skill_candidates for all to authenticated using (is_owner()) with check (is_owner());
create policy "anon_full_skill_candidates" on skill_candidates for all to anon using (true) with check (true);
