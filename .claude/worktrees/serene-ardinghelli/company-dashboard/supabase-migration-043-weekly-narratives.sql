-- Migration 043: Weekly narratives table

CREATE TABLE IF NOT EXISTS weekly_narratives (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  narrative TEXT NOT NULL,
  stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);

-- RLS
ALTER TABLE weekly_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "weekly_narratives_owner" ON weekly_narratives FOR ALL USING (owner_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weekly_narratives_owner ON weekly_narratives(owner_id);
CREATE INDEX IF NOT EXISTS idx_weekly_narratives_week ON weekly_narratives(week_start);
