-- Migration 046: Wishlist table for tracking desired purchases
CREATE TABLE IF NOT EXISTS wishlist (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL DEFAULT 0, -- estimated cost in JPY
  url TEXT, -- product link
  category TEXT DEFAULT 'other', -- equipment, software, furniture, experience, other
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),
  status TEXT DEFAULT 'want' CHECK (status IN ('want', 'considering', 'purchased', 'dropped')),
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  owner_id UUID DEFAULT auth.uid()
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all" ON wishlist FOR ALL USING (owner_id = auth.uid());
