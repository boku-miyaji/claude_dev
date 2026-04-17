-- Migration 039: emotion_analysis table
-- Records: AI-generated emotion analysis for each diary entry.

CREATE TABLE IF NOT EXISTS emotion_analysis (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  diary_entry_id UUID NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,

  -- Plutchik 8 emotions (0-100)
  joy INT DEFAULT 0 CHECK (joy BETWEEN 0 AND 100),
  trust INT DEFAULT 0 CHECK (trust BETWEEN 0 AND 100),
  fear INT DEFAULT 0 CHECK (fear BETWEEN 0 AND 100),
  surprise INT DEFAULT 0 CHECK (surprise BETWEEN 0 AND 100),
  sadness INT DEFAULT 0 CHECK (sadness BETWEEN 0 AND 100),
  disgust INT DEFAULT 0 CHECK (disgust BETWEEN 0 AND 100),
  anger INT DEFAULT 0 CHECK (anger BETWEEN 0 AND 100),
  anticipation INT DEFAULT 0 CHECK (anticipation BETWEEN 0 AND 100),

  -- Russell circumplex
  valence REAL DEFAULT 0 CHECK (valence BETWEEN -1 AND 1),
  arousal REAL DEFAULT 0 CHECK (arousal BETWEEN -1 AND 1),

  -- PERMA+V (0-10)
  perma_p REAL DEFAULT 0 CHECK (perma_p BETWEEN 0 AND 10),
  perma_e REAL DEFAULT 0 CHECK (perma_e BETWEEN 0 AND 10),
  perma_r REAL DEFAULT 0 CHECK (perma_r BETWEEN 0 AND 10),
  perma_m REAL DEFAULT 0 CHECK (perma_m BETWEEN 0 AND 10),
  perma_a REAL DEFAULT 0 CHECK (perma_a BETWEEN 0 AND 10),
  perma_v REAL DEFAULT 0 CHECK (perma_v BETWEEN 0 AND 10),

  -- Overall
  wbi_score REAL DEFAULT 0,
  model_used TEXT DEFAULT 'gpt-4o-mini',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID DEFAULT auth.uid()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_diary ON emotion_analysis(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_created ON emotion_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emotion_analysis_owner ON emotion_analysis(owner_id);

-- RLS
ALTER TABLE emotion_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own emotion_analysis"
  ON emotion_analysis FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own emotion_analysis"
  ON emotion_analysis FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own emotion_analysis"
  ON emotion_analysis FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own emotion_analysis"
  ON emotion_analysis FOR DELETE
  USING (owner_id = auth.uid());
