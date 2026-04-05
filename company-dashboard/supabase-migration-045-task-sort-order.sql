-- Migration 045: Add sort_order to tasks for drag-and-drop reordering
-- Higher sort_order = lower in list. Default to id so existing order is preserved.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order integer;

-- Initialize sort_order from existing id (preserves current order)
UPDATE tasks SET sort_order = id WHERE sort_order IS NULL;

-- Make it not null with default
ALTER TABLE tasks ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE tasks ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks (type, status, sort_order);
