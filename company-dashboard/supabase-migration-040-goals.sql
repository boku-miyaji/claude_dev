-- Migration 040: goals table
-- Hierarchical goal management: life -> yearly -> quarterly -> monthly -> weekly

CREATE TABLE IF NOT EXISTS goals (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,

  level TEXT NOT NULL DEFAULT 'monthly'
    CHECK (level IN ('life', 'yearly', 'quarterly', 'monthly', 'weekly')),

  parent_id BIGINT REFERENCES goals(id) ON DELETE SET NULL,
  dream_id UUID REFERENCES dreams(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'achieved', 'paused', 'dropped')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),

  target_date DATE,
  achieved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID DEFAULT auth.uid()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_level ON goals(level);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_id);
CREATE INDEX IF NOT EXISTS idx_goals_dream ON goals(dream_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner_id);

-- RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goals"
  ON goals FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own goals"
  ON goals FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own goals"
  ON goals FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own goals"
  ON goals FOR DELETE
  USING (owner_id = auth.uid());
