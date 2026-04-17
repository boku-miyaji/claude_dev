-- Migration 041: Habits tracking tables
-- Tables: habits, habit_logs

CREATE TABLE IF NOT EXISTS habits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'life' CHECK (category IN ('life', 'work', 'health', 'learning', 'mindfulness')),
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'weekdays')),
  target_count INT NOT NULL DEFAULT 1,
  icon TEXT NOT NULL DEFAULT '✅',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  habit_id BIGINT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);

-- RLS
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "habits_owner" ON habits FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "habit_logs_owner" ON habit_logs FOR ALL USING (owner_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_habits_owner ON habits(owner_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_completed ON habit_logs(completed_at);
