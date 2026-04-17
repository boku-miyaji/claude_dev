-- Migration 040: Simplify task types to 'task' and 'request' only
-- - todo → task (same concept)
-- - milestone → task (unused in tasks table)

-- 1. Migrate existing data
UPDATE tasks SET type = 'task' WHERE type IN ('todo', 'milestone');

-- 2. Replace check constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (type IN ('task', 'request'));

-- 3. Update default
ALTER TABLE tasks ALTER COLUMN type SET DEFAULT 'task';
