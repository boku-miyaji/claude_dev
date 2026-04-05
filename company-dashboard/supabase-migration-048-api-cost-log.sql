-- Migration 048: Unified API cost log for all AI calls
CREATE TABLE IF NOT EXISTS api_cost_log (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL, -- 'ai_chat', 'self_analysis', 'ai_partner', 'dream_classify', 'emotion_analysis', 'briefing', 'other'
  model TEXT,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  prompt_summary TEXT, -- first 100 chars of prompt
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID DEFAULT auth.uid()
);

ALTER TABLE api_cost_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON api_cost_log FOR ALL USING (owner_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_api_cost_log_source ON api_cost_log (source);
CREATE INDEX IF NOT EXISTS idx_api_cost_log_created ON api_cost_log (created_at);
