-- Migration 030: Career detail fields for timeline & notes
-- Adds completed_at (when it was done) and notes (detailed description of what was done)

ALTER TABLE career ADD COLUMN IF NOT EXISTS completed_at DATE;
ALTER TABLE career ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE career ADD COLUMN IF NOT EXISTS company_id TEXT;
