-- Migration 025: Tab click tracking for mobile nav priority
-- Tracks how many times each tab/page is clicked to reorder mobile navigation

CREATE TABLE IF NOT EXISTS tab_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 1,
  last_clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, page)
);

-- RLS
ALTER TABLE tab_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tab_clicks"
  ON tab_clicks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX idx_tab_clicks_user_count ON tab_clicks(user_id, click_count DESC);

-- RPC function: upsert tab click (increment count or insert)
CREATE OR REPLACE FUNCTION upsert_tab_click(p_user_id UUID, p_page TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO tab_clicks (user_id, page, click_count, last_clicked_at)
  VALUES (p_user_id, p_page, 1, now())
  ON CONFLICT (user_id, page)
  DO UPDATE SET click_count = tab_clicks.click_count + 1,
                last_clicked_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
