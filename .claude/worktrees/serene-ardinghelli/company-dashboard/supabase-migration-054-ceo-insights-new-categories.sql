-- Add new diary-based and prompt-based insight categories to ceo_insights
-- Categories: mood_cycle, trigger, correlation, disconnect, value, drift, fading (diary)
--             focus, recurring, shift, blind_spot (prompt_log)
--             design_philosophy (developer-only)

ALTER TABLE ceo_insights DROP CONSTRAINT IF EXISTS ceo_insights_category_check;
ALTER TABLE ceo_insights ADD CONSTRAINT ceo_insights_category_check CHECK (
  category = ANY (ARRAY[
    -- Legacy categories
    'pattern', 'preference', 'strength', 'tendency', 'feedback', 'work_rhythm', 'weekly_digest',
    -- Diary-based (inner state analysis)
    'mood_cycle', 'trigger', 'correlation', 'disconnect', 'value', 'drift', 'fading',
    -- Prompt-based (interest/behavior analysis)
    'focus', 'recurring', 'shift', 'blind_spot',
    -- Developer-only
    'design_philosophy'
  ])
);
