-- Migration 053: Fix wishlist RLS policy for INSERT
-- The original "owner_all" policy with FOR ALL USING only does not
-- include WITH CHECK, which can block INSERT operations.

DROP POLICY IF EXISTS "owner_all" ON wishlist;

CREATE POLICY "wishlist_select" ON wishlist FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "wishlist_insert" ON wishlist FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "wishlist_update" ON wishlist FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "wishlist_delete" ON wishlist FOR DELETE USING (owner_id = auth.uid());
