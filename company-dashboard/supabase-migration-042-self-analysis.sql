-- Migration 042: Self-analysis results table

CREATE TABLE IF NOT EXISTS self_analysis (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('mbti', 'big5', 'strengths', 'emotion_triggers', 'values')),
  result JSONB NOT NULL DEFAULT '{}',
  summary TEXT,
  data_count INT NOT NULL DEFAULT 0,
  model_used TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);

-- RLS
ALTER TABLE self_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "self_analysis_owner" ON self_analysis FOR ALL USING (owner_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_self_analysis_owner ON self_analysis(owner_id);
CREATE INDEX IF NOT EXISTS idx_self_analysis_type ON self_analysis(analysis_type);
