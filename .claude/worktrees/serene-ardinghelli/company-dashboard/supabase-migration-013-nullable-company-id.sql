-- ============================================================
-- Migration 013: Allow HD-level tasks (nullable company_id)
-- ============================================================
-- tasks.company_id was NOT NULL, preventing HD-level (cross-company)
-- task creation. This migration makes it nullable so tasks can belong
-- to HD (company_id = NULL) or a specific company.
-- ============================================================

-- Allow NULL company_id for HD-level tasks
ALTER TABLE tasks ALTER COLUMN company_id DROP NOT NULL;

-- Also fix comments table if it has the same constraint
ALTER TABLE comments ALTER COLUMN company_id DROP NOT NULL;
