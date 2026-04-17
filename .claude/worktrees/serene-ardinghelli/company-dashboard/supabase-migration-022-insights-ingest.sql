-- ============================================================
-- Migration 022: ceo_insights / knowledge_base に ingest-key ポリシー追加
-- ============================================================
-- Hook/company スキルから anon + x-ingest-key で書き込めるようにする
-- ============================================================

-- === ceo_insights ===
create policy "anon_insert_ceo_insights_with_key"
  on ceo_insights for insert to anon
  with check (public.check_ingest_key());

create policy "anon_update_ceo_insights_with_key"
  on ceo_insights for update to anon
  using (public.check_ingest_key())
  with check (public.check_ingest_key());

create policy "anon_select_ceo_insights_with_key"
  on ceo_insights for select to anon
  using (public.check_ingest_key());

-- === knowledge_base ===
create policy "anon_insert_knowledge_base_with_key"
  on knowledge_base for insert to anon
  with check (public.check_ingest_key());

create policy "anon_update_knowledge_base_with_key"
  on knowledge_base for update to anon
  using (public.check_ingest_key())
  with check (public.check_ingest_key());

create policy "anon_select_knowledge_base_with_key"
  on knowledge_base for select to anon
  using (public.check_ingest_key());
