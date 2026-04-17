-- Migration 055: Add timeline fields to tasks table
-- Enables time-bound task management and Google Tasks sync

-- scheduled_at: when to work on this task (optional, e.g. "14:00から")
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- deadline_at: must be done by this time (optional, e.g. "10:00までに")
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deadline_at timestamptz;

-- estimated_minutes: how long this task takes (optional)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_minutes integer;

-- time_slot: rough time-of-day preference (optional)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS time_slot text
  CHECK (time_slot IS NULL OR time_slot IN ('morning', 'afternoon', 'evening', 'anytime'));

-- google_task_id: link to synced Google Task (for one-way sync Supabase → GCal)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS google_task_id text;

-- Index for timeline queries (tasks with time info for a given date)
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_at ON tasks (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deadline_at ON tasks (deadline_at) WHERE deadline_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_google_task_id ON tasks (google_task_id) WHERE google_task_id IS NOT NULL;
