-- Migration 032: Execution metrics for AI Chat + Claude Code
-- Tracks TTFT, total time, tool usage, cost per request
-- Enables optimization of tools, skills, and response time

CREATE TABLE IF NOT EXISTS execution_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('ai_chat', 'claude_code')),

  -- Timing (milliseconds)
  time_to_first_token_ms INTEGER,       -- TTFT: send → first text chunk
  total_time_ms INTEGER,                -- send → response complete

  -- Model / routing
  model TEXT,
  reasoning_effort TEXT,
  routing_complexity TEXT,               -- simple/moderate/complex (auto-route result)

  -- Tool usage
  tools_used JSONB,                      -- [{name, duration_ms, input_summary}]
  tool_count INTEGER DEFAULT 0,
  step_count INTEGER DEFAULT 0,

  -- Skills (Claude Code)
  skills_used JSONB,                     -- [{name, duration_ms}]
  skill_count INTEGER DEFAULT 0,

  -- Token usage
  tokens_input INTEGER,
  tokens_output INTEGER,
  tokens_reasoning INTEGER,
  cost_usd NUMERIC(10, 6),

  -- Context
  conversation_id UUID,
  prompt_summary TEXT,                   -- first 100 chars of prompt
  company_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE execution_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "execution_metrics_auth" ON execution_metrics
  FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "execution_metrics_ingest" ON execution_metrics
  FOR ALL USING (current_setting('request.headers', true)::json->>'x-ingest-key' IS NOT NULL);

-- Indexes
CREATE INDEX idx_exec_metrics_source ON execution_metrics(source, created_at DESC);
CREATE INDEX idx_exec_metrics_model ON execution_metrics(model, created_at DESC);
