-- ============================================================
-- Migration 040: Dedicated news_items table with click tracking
-- ============================================================
-- Replaces activity_log-based news storage with a proper table.
-- Enables click tracking and personalization.
-- ============================================================

CREATE TABLE IF NOT EXISTS news_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,                              -- source URL
  source TEXT,                           -- e.g. "TechCrunch", "公式ブログ"
  topic TEXT,                            -- e.g. "Claude", "Snowflake", "LLM"
  published_date DATE,                   -- estimated publication date
  click_count INTEGER DEFAULT 0,
  clicked_at TIMESTAMPTZ,                -- last click timestamp
  collected_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_items_collected ON news_items(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_topic ON news_items(topic);
CREATE INDEX IF NOT EXISTS idx_news_items_clicks ON news_items(click_count DESC);

ALTER TABLE news_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full" ON news_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_insert_news" ON news_items FOR INSERT TO anon WITH CHECK (public.check_ingest_key());
CREATE POLICY "anon_select_news" ON news_items FOR SELECT TO anon USING (public.check_ingest_key());
CREATE POLICY "anon_update_news" ON news_items FOR UPDATE TO anon
  USING (public.check_ingest_key()) WITH CHECK (public.check_ingest_key());

-- Topic interest scores (CEO分析部が更新)
CREATE TABLE IF NOT EXISTS news_preferences (
  id SERIAL PRIMARY KEY,
  topic TEXT NOT NULL UNIQUE,
  interest_score REAL DEFAULT 0.5,       -- 0.0 = no interest, 1.0 = high interest
  click_total INTEGER DEFAULT 0,
  impression_total INTEGER DEFAULT 0,    -- times shown
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE news_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full" ON news_preferences FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_news_pref" ON news_preferences FOR ALL TO anon
  USING (public.check_ingest_key()) WITH CHECK (public.check_ingest_key());
