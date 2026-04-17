-- ============================================================
-- Migration 039: Add prompt_sessions + session tracking
-- ============================================================
-- Groups prompt_log entries by Claude Code session.
-- Enables session-level knowledge extraction.
-- ============================================================

-- Session metadata table
CREATE TABLE IF NOT EXISTS prompt_sessions (
  id TEXT PRIMARY KEY,                    -- Claude Code sessionId (UUID)
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,                   -- updated on each prompt
  company_id TEXT REFERENCES companies(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',               -- aggregated tags from all prompts
  prompt_count INTEGER DEFAULT 0,
  server_host TEXT,
  cwd TEXT,
  knowledge_extracted BOOLEAN DEFAULT FALSE,  -- true after knowledge auto-extraction
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add session_id to prompt_log
ALTER TABLE prompt_log ADD COLUMN IF NOT EXISTS session_id TEXT REFERENCES prompt_sessions(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_log_session ON prompt_log(session_id);
CREATE INDEX IF NOT EXISTS idx_prompt_sessions_company ON prompt_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_prompt_sessions_started ON prompt_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_sessions_knowledge ON prompt_sessions(knowledge_extracted) WHERE NOT knowledge_extracted;

-- RLS
ALTER TABLE prompt_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full" ON prompt_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Anon INSERT/UPDATE for hook upsert (uses existing check_ingest_key function)
CREATE POLICY "anon_insert_prompt_sessions"
  ON prompt_sessions FOR INSERT TO anon
  WITH CHECK (public.check_ingest_key());

CREATE POLICY "anon_update_prompt_sessions"
  ON prompt_sessions FOR UPDATE TO anon
  USING (public.check_ingest_key())
  WITH CHECK (public.check_ingest_key());

-- Anon SELECT for dashboard reads
CREATE POLICY "anon_select_prompt_sessions"
  ON prompt_sessions FOR SELECT TO anon
  USING (public.check_ingest_key());

-- Add source_session to knowledge_base for traceability
ALTER TABLE knowledge_base ADD COLUMN IF NOT EXISTS source_session_id TEXT REFERENCES prompt_sessions(id) ON DELETE SET NULL;

-- Trigger: auto-increment prompt_count and merge tags on upsert
CREATE OR REPLACE FUNCTION prompt_sessions_upsert_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is an UPDATE (conflict on id), increment count and merge tags
  IF TG_OP = 'UPDATE' THEN
    NEW.prompt_count := OLD.prompt_count + 1;
    NEW.ended_at := now();
    -- Merge tags: union of old and new, deduplicated
    NEW.tags := ARRAY(SELECT DISTINCT unnest(OLD.tags || COALESCE(NEW.tags, '{}')));
    -- Keep original started_at and company_id if already set
    NEW.started_at := OLD.started_at;
    IF OLD.company_id IS NOT NULL AND NEW.company_id IS NULL THEN
      NEW.company_id := OLD.company_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER prompt_sessions_upsert
  BEFORE UPDATE ON prompt_sessions
  FOR EACH ROW EXECUTE FUNCTION prompt_sessions_upsert_trigger();

-- View: unprocessed sessions with feedback-tagged prompts
CREATE OR REPLACE VIEW v_sessions_pending_knowledge AS
SELECT
  ps.id AS session_id,
  ps.started_at,
  ps.ended_at,
  ps.company_id,
  ps.tags AS session_tags,
  ps.prompt_count,
  json_agg(
    json_build_object(
      'prompt', pl.prompt,
      'tags', pl.tags,
      'created_at', pl.created_at
    ) ORDER BY pl.created_at
  ) AS prompts
FROM prompt_sessions ps
JOIN prompt_log pl ON pl.session_id = ps.id
WHERE ps.knowledge_extracted = FALSE
  AND ps.prompt_count >= 3  -- skip very short sessions
  AND EXISTS (
    SELECT 1 FROM prompt_log pl2
    WHERE pl2.session_id = ps.id
      AND (
        pl2.tags && ARRAY['intent:fix', 'intent:design', 'intent:brainstorm']
        OR pl2.prompt ~* '(しないで|じゃなくて|違う|やめて|常に|必ず|〜して$|の方がいい|を使って|ではなく)'
      )
  )
GROUP BY ps.id, ps.started_at, ps.ended_at, ps.company_id, ps.tags, ps.prompt_count
ORDER BY ps.started_at DESC
LIMIT 10;

-- Function: mark sessions as knowledge-extracted
CREATE OR REPLACE FUNCTION mark_sessions_extracted(session_ids TEXT[])
RETURNS void AS $$
BEGIN
  UPDATE prompt_sessions
  SET knowledge_extracted = TRUE
  WHERE id = ANY(session_ids);
END;
$$ LANGUAGE plpgsql;
