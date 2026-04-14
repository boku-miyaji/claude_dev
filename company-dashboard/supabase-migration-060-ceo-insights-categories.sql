-- Migration 060: ceo_insights.category の CHECK 制約に週次分析用カテゴリを追加
--
-- 背景: .claude/hooks/weekly-insights.sh が 8 種の週次分析結果を
-- ceo_insights に書き込もうとして CHECK 制約違反でブロックされていた。

ALTER TABLE ceo_insights
  DROP CONSTRAINT IF EXISTS ceo_insights_category_check;

ALTER TABLE ceo_insights
  ADD CONSTRAINT ceo_insights_category_check
  CHECK (category = ANY (ARRAY[
    -- 既存（HD 運営由来）
    'pattern', 'preference', 'strength', 'tendency', 'feedback',
    'work_rhythm', 'weekly_digest', 'mood_cycle', 'trigger', 'correlation',
    'disconnect', 'value', 'drift', 'fading', 'focus', 'recurring',
    'shift', 'blind_spot', 'design_philosophy',
    -- 新規: weekly-insights.sh (プロダクト週次分析)
    'habits_mood_correlation', 'event_density_mood', 'perma_v_trend',
    'task_completion_trend', 'dreams_progress', 'api_cost_monthly',
    'time_estimation_habit', 'mood_turning_points'
  ]::text[]));
