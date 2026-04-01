-- Migration 031: Portfolio edit support + learning log
-- tech_stack gets learned_at (when you learned it) and notes (what you studied)

ALTER TABLE tech_stack ADD COLUMN IF NOT EXISTS learned_at DATE;
ALTER TABLE tech_stack ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE tech_stack ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- portfolio_projects gets notes too
ALTER TABLE portfolio_projects ADD COLUMN IF NOT EXISTS notes TEXT;
