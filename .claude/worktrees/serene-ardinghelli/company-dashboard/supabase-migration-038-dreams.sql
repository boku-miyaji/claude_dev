-- Migration 038: dreams table for Self-Focus Platform
-- Phase 1: 100の夢リスト機能

CREATE TABLE IF NOT EXISTS dreams (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'other', -- career, travel, skill, health, relationship, creative, financial, experience, other
  status TEXT DEFAULT 'active', -- active, in_progress, achieved, paused
  achieved_at TIMESTAMPTZ,
  priority INT DEFAULT 50, -- 1-100
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID DEFAULT auth.uid()
);

ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON dreams FOR ALL USING (owner_id = auth.uid());
