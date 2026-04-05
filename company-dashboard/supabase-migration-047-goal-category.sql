-- Migration 047: Add category to goals for unified categorization with dreams
ALTER TABLE goals ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
